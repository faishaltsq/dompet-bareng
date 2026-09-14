/**
 * Design Tokens — DompetBareng (FinWise Light Mode adaptation)
 * Palette: Emerald/mint primary, white surface, soft backgrounds
 */
export const Colors = {
  // Primary — FinWise Emerald
  primary: '#1CAB68',
  primaryDark: '#15864F',
  primaryLight: '#2DD07E',
  primaryMuted: '#6EDBA8',
  primarySoft: '#E8F9F1',
  primaryGradientStart: '#1CAB68',
  primaryGradientEnd: '#0E9060',

  // Backgrounds
  background: '#F7F9FB',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#F0FAF5',

  // Typography
  textDark: '#0D1117',
  textSecondary: '#4A5568',
  textMuted: '#8896A4',
  textLight: '#FFFFFF',
  textOnPrimary: '#FFFFFF',

  // Financial Status
  income: '#1CAB68',
  incomeSoft: '#E8F9F1',
  expense: '#FF4757',
  expenseSoft: '#FFF0F1',
  savings: '#F59E0B',
  savingsSoft: '#FFF8E7',
  savings2: '#3B82F6',
  savings2Soft: '#EFF6FF',

  // Accents
  accentBlue: '#3B82F6',
  accentBlueSoft: '#EFF6FF',
  accentTeal: '#14B8A6',
  accentTealSoft: '#F0FDFA',
  accentPurple: '#8B5CF6',
  accentPurpleSoft: '#F5F3FF',
  accentOrange: '#F97316',
  accentOrangeSoft: '#FFF7ED',

  // Borders & Dividers
  border: '#E8EDF2',
  borderDark: '#D1D9E0',
  borderLight: '#F3F6F9',

  // Skeleton
  skeletonBase: '#E8EDF2',
  skeletonHighlight: '#F5F7FA',
};

export const Shadows = {
  card: {
    shadowColor: '#1CAB68',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  float: {
    shadowColor: '#1CAB68',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
};

export const Radius = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  full: 9999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
