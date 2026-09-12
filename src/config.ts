/**
 * App-level configuration.
 *
 * Set COPILOTKIT_RUNTIME_URL to the CopilotKit runtime endpoint you deployed
 * (e.g. `https://your-copilotkit.cloud/api/copilotkit`). When it is set, the
 * agent receives payment context and can drive the split experience through
 * Generative UI tool calls. When it is empty, SplitPay runs in deterministic
 * mode using the same components and flow.
 */
export const COPILOTKIT_RUNTIME_URL: string | null = null;

/**
 * Pre-built demo payments for the hidden "Simulate payment" button.
 */
export const DEMO_PAYMENTS: ReadonlyArray<{ label: string; text: string }> = [
  {
    label: 'La Cabrera — ₲240.000',
    text: '₲240.000 - La Cabrera',
  },
  {
    label: 'Gasolinera — Gs. 300.000',
    text: 'Gs. 300.000 - Shell Loma',
  },
  {
    label: 'Supermercado — PYG 450000',
    text: 'PYG 450000 - Stock',
  },
];