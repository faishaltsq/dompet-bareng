/**
 * Design Tokens — DompetBareng (FinWise Light Mode adaptation)
 * Palette: Emerald/mint primary, white surface, soft backgrounds
 */
export const Colors = {
  primary: '#059669',
  primaryDark: '#047857',
  primaryLight: '#10B981',
  primaryMuted: '#6EE7B7',
  primarySoft: '#ECFDF5',
  primaryGradientStart: '#059669',
  primaryGradientEnd: '#047857',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#F1F5F9',
  textDark: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textLight: '#FFFFFF',
  textOnPrimary: '#FFFFFF',
  income: '#10B981',
  incomeSoft: '#ECFDF5',
  expense: '#EF4444',
  expenseSoft: '#FEF2F2',
  savings: '#F59E0B',
  savingsSoft: '#FFFBEB',
  savings2: '#3B82F6',
  savings2Soft: '#EFF6FF',
  accentBlue: '#3B82F6',
  accentBlueSoft: '#EFF6FF',
  accentTeal: '#14B8A6',
  accentTealSoft: '#F0FDFA',
  accentPurple: '#8B5CF6',
  accentPurpleSoft: '#F5F3FF',
  accentOrange: '#F97316',
  accentOrangeSoft: '#FFF7ED',
  border: '#E2E8F0',
  borderDark: '#CBD5E1',
  borderLight: '#F1F5F9',
  skeletonBase: '#E2E8F0',
  skeletonHighlight: '#F8FAFC',
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
