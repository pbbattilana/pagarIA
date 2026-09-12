import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFlow } from '../flow';
import { DetectedView, PeopleView, SummaryView, ReadyView } from '../components/FlowViews';
import { colors, radius } from '../theme';
import { hideBubble } from '../native/paymentEvents';

/**
 * Second React root rendered inside the floating system overlay. It subscribes
 * to the same global flow store as the main app, so the flow that appears in
 * the bubble is the exact same deterministic state machine.
 */
function BubbleFlow() {
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
      return <View style={styles.empty} />;
  }
}

export default function BubbleRoot() {
  const { state } = useFlow();

  useEffect(() => {
    if (state.status === 'idle') {
      hideBubble().catch(() => {});
    }
  }, [state.status]);

  return (
    <View style={styles.root}>
      <BubbleFlow />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    backgroundColor: colors.background,
  },
});