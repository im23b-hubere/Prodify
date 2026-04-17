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

export const typography = {
  headline: { fontSize: 32, lineHeight: 38 },
  subheadline: { fontSize: 20, lineHeight: 26 },
  body: { fontSize: 16, lineHeight: 22 },
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
