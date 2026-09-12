import React, { useCallback, useEffect } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useFlow } from '../flow';
import { DetectedView, PeopleView, SummaryView, ReadyView } from '../components/FlowViews';
import { hideBubble, resizeBubble, subscribeToBubbleClose } from '../native/paymentEvents';

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
      return null;
  }
}

export default function BubbleRoot() {
  const { state, api } = useFlow();

  useEffect(() => {
    if (state.status === 'idle') {
      hideBubble().catch(() => {});
    }
  }, [state.status]);

  // Let the overlay window hug the rendered card: whenever the content's
  // measured height changes, resize the native window to match.
  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    if (height > 0) {
      resizeBubble(height);
    }
  }, []);

  // Native close (✕) resets the flow so a future payment reopens the bubble.
  useEffect(() => subscribeToBubbleClose(api.onReset), [api]);

  return (
    <View style={styles.root}>
      <View style={styles.content} onLayout={onContentLayout}>
        <BubbleFlow />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    width: '100%',
  },
});