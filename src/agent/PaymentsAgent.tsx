import React, { useEffect, useRef } from 'react';
import { z } from 'zod';
import {
  useAgent,
  useAgentContext,
  useFrontendTool,
  type JsonSerializable,
} from '@copilotkit/react-native/headless';
import { COPILOTKIT_RUNTIME_URL } from '../config';
import { useFlow } from '../flow';
import { parsePayment, looksLikePayment } from '../paymentParser';
import type { NotificationEvent } from '../types';

const notificationEventSchema = z.object({
  packageName: z.string(),
  title: z.string().optional(),
  text: z.string().optional(),
  timestamp: z.number(),
});

const peopleSchema = z.object({
  people: z.number(),
});

const paymentEventSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  merchant: z.string().optional(),
  timestamp: z.number(),
  source: z.object({
    packageName: z.string(),
    title: z.string().optional(),
    text: z.string().optional(),
  }),
});

let messageSeq = 0;
function nextMessageId(): string {
  messageSeq += 1;
  return `pay-msg-${Date.now()}-${messageSeq}`;
}

/**
 * Registers CopilotKit frontend tools that map 1:1 onto the split flow
 * actions. When a runtime is configured, the agent can decide autonomously
 * which tool to call; when no runtime is present the tools are inert and the
 * deterministic flow drives directly.
 */
export function PaymentsAgent({ event }: { event: NotificationEvent | null }) {
  const { api: flow } = useFlow();
  const { agent, isReady } = useAgent({ agentId: 'splitpay' });
  const lastHandledTimestamp = useRef<number | null>(null);

  useAgentContext({
    description: 'Latest payment event detected on this device',
    value: event !== null ? (event as unknown as JsonSerializable) : null,
  });

  useFrontendTool(
    {
      name: 'showSplitPayment',
      description:
        'Present the detected payment card and ask whether the user wants to split it.',
      parameters: notificationEventSchema,
      handler: async args => {
        const parsed = parsePayment(args);
        if (parsed) {
          flow.onPaymentDetected(parsed);
          return `Showing split UI for ${parsed.amount} ${parsed.currency}`;
        }
        return 'Payment could not be parsed from the event';
      },
      render: ({ args }) => {
        const parsed = parsePayment(args as unknown as NotificationEvent);
        if (!parsed) return null;
        return <></>;
      },
    },
    [flow],
  );

  useFrontendTool(
    {
      name: 'dismissPayment',
      description: 'Dismiss the current payment and return to idle.',
      parameters: undefined as never,
      handler: async () => {
        flow.onDismiss();
        return 'Dismissed';
      },
    },
    [flow],
  );

  useFrontendTool(
    {
      name: 'preparePaymentRequest',
      description:
        'The user chose to split the bill. Prepare the split between the specified number of people.',
      parameters: peopleSchema,
      handler: async ({ people }) => {
        flow.onPeople(people);
        return `Preparing ${people}-way split`;
      },
    },
    [flow],
  );

  useFrontendTool(
    {
      name: 'sharePaymentRequest',
      description: 'Generate the QR and prepare the share payload.',
      parameters: paymentEventSchema,
      handler: async () => {
        flow.onGenerateCharges();
        return 'Payment request ready to share';
      },
    },
    [flow],
  );

  useEffect(() => {
    if (!event || !isReady) return;
    if (lastHandledTimestamp.current === event.timestamp) return;
    if (!looksLikePayment(event)) return;
    lastHandledTimestamp.current = event.timestamp;

    agent.setState({ latestPaymentEvent: event });
    agent.addMessage({
      id: nextMessageId(),
      role: 'user',
      content:
        'A payment was detected on this device: ' +
        JSON.stringify(event) +
        '. Decide the next action using the tools available.',
    });
    agent.runAgent().catch(() => {});
  }, [event, isReady, agent]);

  return null;
}

/**
 * Whether CopilotKit runtime integration is enabled in this deployment.
 * When true the app renders the provider boundary; when false the
 * deterministic flow is the sole driver.
 */
export function isRuntimeEnabled(): boolean {
  return Boolean(COPILOTKIT_RUNTIME_URL);
}