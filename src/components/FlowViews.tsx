import React, { useState } from 'react';
import {
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, Card, Chip } from './ui';
import { colors, radius, spacing } from '../theme';
import { formatAmount } from '../paymentParser';
import type { Payment, SplitRequest } from '../types';

function MerchantLine({ merchant }: { merchant?: string }) {
  return merchant ? (
    <Text style={styles.merchant}>{merchant}</Text>
  ) : null;
}

export function DetectedView({
  payment,
  onDismiss,
  onSplit,
}: {
  payment: Payment;
  onDismiss: () => void;
  onSplit: () => void;
}) {
  return (
    <Card>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Pago detectado</Text>
        </View>
        <Text style={styles.source}>{payment.source.packageName}</Text>
      </View>
      <Text style={styles.amount}>
        {formatAmount(payment.amount, payment.currency)}
      </Text>
      <MerchantLine merchant={payment.merchant} />
      <Text style={styles.question}>¿Compartiste este gasto?</Text>
      <View style={styles.row}>
        <Button label="No" variant="secondary" onPress={onDismiss} />
        <Button label="Dividir" onPress={onSplit} />
      </View>
    </Card>
  );
}

const PRESET_PEOPLE = [2, 3, 4, 5];

export function PeopleView({
  payment,
  onPeople,
}: {
  payment: Payment;
  onPeople: (people: number) => void;
}) {
  const [showInput, setShowInput] = useState(false);
  const [custom, setCustom] = useState('');

  const commitCustom = () => {
    const parsed = parseInt(custom, 10);
    if (Number.isFinite(parsed) && parsed >= 2 && parsed <= 99) {
      onPeople(parsed);
    }
    setShowInput(false);
    setCustom('');
  };

  return (
    <Card>
      <Text style={styles.headline}>
        {formatAmount(payment.amount, payment.currency)}
      </Text>
      <MerchantLine merchant={payment.merchant} />
      <Text style={styles.question}>¿Entre cuántas personas?</Text>
      <View style={styles.chipRow}>
        {PRESET_PEOPLE.map(n => (
          <Chip key={n} label={`${n}`} selected={false} onPress={() => onPeople(n)} />
        ))}
        <Chip
          label="+"
          selected={false}
          onPress={() => {
            setShowInput(v => !v);
            setCustom('');
          }}
        />
      </View>
      {showInput && (
        <TextInput
          style={styles.input}
          value={custom}
          onChangeText={setCustom}
          keyboardType="number-pad"
          placeholder="Cantidad de personas"
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={commitCustom}
          autoFocus
        />
      )}
      {Number.isFinite(parseInt(custom, 10)) &&
        parseInt(custom, 10) >= 2 &&
        parseInt(custom, 10) <= 99 && (
          <Button label="Aceptar" onPress={commitCustom} />
        )}
    </Card>
  );
}

export function SummaryView({
  payment,
  people,
  amountPerPerson,
  onGenerateCharges,
}: {
  payment: Payment;
  people: number;
  amountPerPerson: number;
  onGenerateCharges: () => void;
}) {
  return (
    <Card>
      <Text style={styles.headline}>
        {formatAmount(payment.amount, payment.currency)}
      </Text>
      <MerchantLine merchant={payment.merchant} />
      <View style={styles.splitBox}>
        <Text style={styles.splitMain}>
          {formatAmount(amountPerPerson, payment.currency)}
        </Text>
        <Text style={styles.splitSub}>por persona · {people} personas</Text>
      </View>
      <Button label="Generar cobros" large onPress={onGenerateCharges} />
    </Card>
  );
}

export function ReadyView({
  split,
  onReset,
}: {
  split: SplitRequest;
  onReset: () => void;
}) {
  const { payment, amountPerPerson, people, payload } = split;

  const share = () => {
    const message = `Te corresponde ${formatAmount(
      amountPerPerson,
      payment.currency,
    )} de la cuenta de ${payment.merchant ?? 'la cuenta compartida'}. ${payload}`;
    Share.share({ message }).catch(() => {});
  };

  return (
    <Card>
      <Text style={styles.headline}>
        {formatAmount(amountPerPerson, payment.currency)}
      </Text>
      <Text style={styles.merchant}>{payment.merchant}</Text>
      <View style={styles.qrWrap}>
        <View style={styles.qrBox}>
          <QRCode value={payload} size={220} color={colors.text} backgroundColor={colors.white} />
        </View>
      </View>
      <Text style={styles.qrHint}>{payload}</Text>
      <Button label="Compartir" large onPress={share} />
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          {people} personas · {formatAmount(payment.amount, payment.currency)}
        </Text>
        <Button label="Inicio" variant="ghost" onPress={onReset} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  badge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  source: {
    color: colors.textMuted,
    fontSize: 12,
  },
  amount: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  headline: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  merchant: {
    color: colors.textMuted,
    fontSize: 17,
    marginBottom: spacing.md,
  },
  question: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end',
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.md,
    fontSize: 16,
  },
  splitBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  splitMain: {
    color: colors.success,
    fontSize: 40,
    fontWeight: '800',
  },
  splitSub: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  qrWrap: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  qrBox: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  qrHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 13,
  },
});