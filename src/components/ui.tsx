import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  large?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  large = false,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        large && styles.btnLarge,
        isPrimary && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'ghost' && styles.btnGhost,
        pressed && styles.btnPressed,
        (disabled || loading) && styles.btnDisabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.text} />
      ) : (
        <Text
          style={[
            styles.btnLabel,
            isPrimary && styles.btnLabelPrimary,
            variant === 'ghost' && styles.btnLabelGhost,
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.btnPressed,
      ]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    minWidth: 120,
  },
  btnLarge: {
    paddingVertical: 16,
    borderRadius: radius.lg,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnSecondary: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.md,
    minWidth: 96,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  btnLabelPrimary: {
    color: colors.white,
  },
  btnLabelGhost: {
    color: colors.primary,
    fontWeight: '700',
  },
  chip: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: colors.white,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
});