import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CopilotKitProvider } from '@copilotkit/react-native/headless';
import { useFlow } from './src/flow';
import { usePaymentEvents } from './src/hooks/usePaymentEvents';
import { parsePayment, looksLikePayment } from './src/paymentParser';
import {
  hasNotificationAccess,
  openNotificationAccessSettings,
  simulatePayment,
  showBubble,
  hideBubble,
  isOverlayPermissionGranted,
  openOverlayPermissionSettings,
} from './src/native/paymentEvents';
import { COPILOTKIT_RUNTIME_URL, DEMO_PAYMENTS } from './src/config';
import { PaymentsAgent } from './src/agent/PaymentsAgent';
import { DetectedView, PeopleView, SummaryView, ReadyView } from './src/components/FlowViews';
import { Button, Card } from './src/components/ui';
import { colors, spacing } from './src/theme';
import type { NotificationEvent, Payment } from './src/types';

function FlowSurface() {
  const { state, api } = useFlow();
  switch (state.status) {
    case 'detected':
      return <DetectedView payment={state.payment} onDismiss={api.onDismiss} onSplit={api.onSplit} />;
    case 'people':
      return <PeopleView payment={state.payment} onPeople={api.onPeople} />;
    case 'summary':
      return (
        <SummaryView
          payment={state.payment}
          people={state.people}
          amountPerPerson={state.amountPerPerson}
          onGenerateCharges={api.onGenerateCharges}
        />
      );
    case 'ready':
      return <ReadyView split={state.split} onReset={api.onReset} />;
    default:
      return null;
  }
}

/**
 * Consumes the payment event stream. In deterministic mode (no CopilotKit
 * runtime) it parses each event and drives the flow directly. In agent mode it
 * hands the latest event to the CopilotKit agent, which decides the action.
 */
function PaymentEventsBridge({
  events,
  runtimeEnabled,
  onParsed,
}: {
  events: NotificationEvent[];
  runtimeEnabled: boolean;
  onParsed: (payment: Payment) => void;
}) {
  const seen = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (runtimeEnabled) return;
    for (const event of events) {
      if (seen.current.has(event.timestamp)) continue;
      seen.current.add(event.timestamp);
      if (looksLikePayment(event)) {
        const parsed = parsePayment(event);
        if (parsed) {
          onParsed(parsed);
          return;
        }
      }
    }
  }, [events, runtimeEnabled, onParsed]);

  return null;
}

function BubbleBridge() {
  const { state } = useFlow();

  useEffect(() => {
    if (state.status !== 'idle') {
      showBubble().catch(() => {});
    } else {
      hideBubble().catch(() => {});
    }
  }, [state.status]);

  return null;
}

function IdleScreen({
  notifAccess,
  overlayGranted,
  onDevToggle,
  devOpen,
}: {
  notifAccess: boolean | null;
  overlayGranted: boolean;
  onDevToggle: () => void;
  devOpen: boolean;
}) {
  const { api } = useFlow();

  return (
    <Card>
      <Text style={styles.question}>Notificaciones</Text>
      <Text style={styles.subhead}>
        {notifAccess === true
          ? 'SplitPay está escuchando notificaciones de pago en este dispositivo.'
          : 'Aún no has otorgado acceso a notificaciones.'}
      </Text>
      {notifAccess !== true && (
        <View style={styles.marginTop}>
          <Button label="Otorgar acceso a notificaciones" onPress={openNotificationAccessSettings} />
        </View>
      )}

      {!overlayGranted && (
        <View style={styles.marginTop}>
          <Button label="Permitir superposición (burbuja)" onPress={openOverlayPermissionSettings} />
        </View>
      )}

      <Pressable onPress={onDevToggle} style={styles.devToggle}>
        <Text style={styles.devLabel}>Modo desarrollador</Text>
      </Pressable>
      {devOpen && (
        <View style={styles.devArea}>
          <Text style={styles.subhead}>Simular una notificación de pago</Text>
          {DEMO_PAYMENTS.map(demo => (
            <View key={demo.text} style={styles.marginTop}>
              <Button
                label={demo.label}
                variant="secondary"
                onPress={() => simulatePayment(demo.text)}
              />
            </View>
          ))}
          <View style={styles.marginTop}>
            <Button label="Volver al inicio" variant="ghost" onPress={api.onReset} />
          </View>
        </View>
      )}
    </Card>
  );
}

function useNotificationAccess(): boolean | null {
  const [granted, setGranted] = useState<boolean | null>(null);
  useEffect(() => {
    hasNotificationAccess(setGranted);
  }, []);
  return granted;
}

function useOverlayPermission(): boolean {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    isOverlayPermissionGranted().then(setGranted);
  }, []);
  return granted;
}

function AppRoot() {
  const insets = useSafeAreaInsets();
  const { state, api } = useFlow();
  const [devOpen, setDevOpen] = useState(false);
  const notifAccess = useNotificationAccess();
  const overlayGranted = useOverlayPermission();

  const runtimeEnabled = COPILOTKIT_RUNTIME_URL != null;

  const handleParsed = useCallback((payment: Payment) => api.onPaymentDetected(payment), [api]);

  const events = usePaymentEvents();
  const latestEvent = events[0] ?? null;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}>
      <View style={styles.header}>
        <Text style={styles.logo}>SplitPay</Text>
        <Text style={styles.subhead}>Agente contextual de pagos compartidos</Text>
      </View>

      <PaymentEventsBridge events={events} runtimeEnabled={runtimeEnabled} onParsed={handleParsed} />
      <BubbleBridge />
      {runtimeEnabled && latestEvent ? <PaymentsAgent event={latestEvent} /> : null}

      <FlowSurface />
      {state.status === 'idle' && (
        <IdleScreen
          notifAccess={notifAccess}
          overlayGranted={overlayGranted}
          devOpen={devOpen}
          onDevToggle={() => setDevOpen(v => !v)}
        />
      )}
    </View>
  );
}

function App() {
  const runtimeEnabled = COPILOTKIT_RUNTIME_URL != null;

  const content = runtimeEnabled ? (
    <CopilotKitProvider runtimeUrl={COPILOTKIT_RUNTIME_URL!}>
      <AppRoot />
    </CopilotKitProvider>
  ) : (
    <AppRoot />
  );

  return (
    <SafeAreaProvider>
      {content}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  logo: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
  },
  subhead: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  question: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  devToggle: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  devLabel: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  devArea: {
    marginTop: spacing.md,
  },
  marginTop: {
    marginTop: spacing.sm,
  },
});

export default App;
