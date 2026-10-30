import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: 'ios', select: (obj: any) => obj.ios },
}));

import { MASCOT_SOURCES, SIZE_MAP, type OtterVariant } from '../../components/OtterMascot';

const variants: OtterVariant[] = [
  'welcome',
  'happy',
  'rich',
  'thinking',
  'crying',
  'panic',
  'reminder',
  'sleeping',
];

describe('OtterMascot variants and asset integrity', () => {
  it.each(variants)('provides a valid numeric asset handle for variant %s', (variant) => {
    const asset = MASCOT_SOURCES[variant];
    expect(typeof asset).toBe('number');
    expect(Number.isFinite(asset)).toBe(true);
    expect(asset).toBeGreaterThan(0);
  });

  it('defines correct proportional size values in SIZE_MAP', () => {
    expect(SIZE_MAP.sm).toBe(48);
    expect(SIZE_MAP.md).toBe(72);
    expect(SIZE_MAP.lg).toBe(104);
    expect(SIZE_MAP.xl).toBe(140);
  });
});
