export const colors = {
  background: "#0a0a0a",
  surface: "#141414",
  border: "#1f1f1f",
  primary: "#FF3D00",
  secondary: "#a259ff",
  textPrimary: "#FFFFFF",
  textSecondary: "#888888",
  success: "#00ff88",
  danger: "#ff4444",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const space = spacing;

export const typography = {
  screenTitle: { fontSize: 30, lineHeight: 36 },
  sectionTitle: { fontSize: 22, lineHeight: 28 },
  cardTitle: { fontSize: 18, lineHeight: 24 },
  headline: { fontSize: 32, lineHeight: 38 },
  subheadline: { fontSize: 20, lineHeight: 26 },
  body: { fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontSize: 16, lineHeight: 22 },
  meta: { fontSize: 13, lineHeight: 18 },
  bodySmall: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 14, lineHeight: 20 },
} as const;

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  button: {
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  round: 999,
} as const;

export const ui = {
  screenPadding: spacing.md,
  sectionGap: spacing.lg,
  cardGap: spacing.md,
  stackGap: spacing.md,
  compactGap: spacing.sm,
  cardPadding: spacing.md,
  cardRadius: radii.md,
  cardBorderWidth: 1,
  buttonHeight: 56,
} as const;

export const motion = {
  pressScale: 0.985,
  pressScaleStrong: 0.98,
  pressOpacity: 0.9,
  pressOpacityLight: 0.85,
  quick: 140,
  standard: 220,
} as const;
