import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { create, act } from 'react-test-renderer';
import ClayButton from '../../components/ClayButton';
import DesktopSidebar from '../../components/DesktopSidebar';

declare const global: { IS_REACT_ACT_ENVIRONMENT?: boolean };
global.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
  Platform: { OS: 'web', select: (obj: any) => obj.web || obj.default },
  Vibration: { vibrate: vi.fn() },
  ActivityIndicator: 'ActivityIndicator',
  useWindowDimensions: () => ({ width: 1200, height: 800 }),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, color, size, ...props }: any) =>
    React.createElement('Ionicons', { name, color, size, ...props }),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/(tabs)',
}));

vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        tabHome: 'Beranda',
        tabStats: 'Statistik',
        tabSettings: 'Pengaturan',
      };
      return dict[key] || key;
    },
    language: 'id',
  }),
}));

vi.mock('@/components/OtterMascot', () => ({
  default: ({ variant }: any) => React.createElement('OtterMascot', { variant }),
}));

describe('ClayButton component', () => {
  it('renders primary clay button with icon and label', async () => {
    const handlePress = vi.fn();
    let renderer: any;
    await act(async () => {
      renderer = create(
        React.createElement(ClayButton, {
          variant: 'primary',
          label: '+ Transaksi',
          icon: 'add',
          onPress: handlePress,
        })
      );
    });

    const str = JSON.stringify(renderer.toJSON());
    expect(str).toContain('+ Transaksi');
    expect(str).toContain('"name":"add"');
  });

  it('renders secondary clay button for export CSV', async () => {
    const handlePress = vi.fn();
    let renderer: any;
    await act(async () => {
      renderer = create(
        React.createElement(ClayButton, {
          variant: 'secondary',
          label: 'Export CSV',
          icon: 'download-outline',
          onPress: handlePress,
        })
      );
    });

    const str = JSON.stringify(renderer.toJSON());
    expect(str).toContain('Export CSV');
    expect(str).toContain('"name":"download-outline"');
  });

  it('fires onPress callback when interactive', async () => {
    const handlePress = vi.fn();
    let renderer: any;
    await act(async () => {
      renderer = create(
        React.createElement(ClayButton, {
          variant: 'primary',
          label: 'Klik Saya',
          onPress: handlePress,
        })
      );
    });

    const pressable = renderer.root.findByType('Pressable');
    await act(async () => {
      pressable.props.onPress();
    });

    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('prevents onPress when disabled or loading', async () => {
    const handlePress = vi.fn();
    let renderer: any;
    await act(async () => {
      renderer = create(
        React.createElement(ClayButton, {
          variant: 'primary',
          label: 'Terkunci',
          disabled: true,
          onPress: handlePress,
        })
      );
    });

    const pressable = renderer.root.findByType('Pressable');
    expect(pressable.props.onPress).toBeUndefined();
    expect(pressable.props.accessibilityState.disabled).toBe(true);
  });

  it('renders ActivityIndicator when loading', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(
        React.createElement(ClayButton, {
          variant: 'primary',
          label: 'Menyimpan...',
          loading: true,
        })
      );
    });

    const str = JSON.stringify(renderer.toJSON());
    expect(str).toContain('ActivityIndicator');
  });
});

describe('DesktopSidebar component & Image 2 verification', () => {
  it('removes windowDots (fake macOS traffic lights) completely', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(DesktopSidebar));
    });
    const str = JSON.stringify(renderer.toJSON());

    // Verify windowDots and red/yellow/green macOS dots are absent
    expect(str).not.toContain('#FF5F56');
    expect(str).not.toContain('#FFBD2E');
    expect(str).not.toContain('#27C93F');
    expect(str).not.toContain('windowDots');
  });

  it('renders brand identity, navigation items and otter motivator', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(DesktopSidebar));
    });
    const str = JSON.stringify(renderer.toJSON());

    // Brand header
    expect(str).toContain('DompetBareng');
    expect(str).toContain('Finansial Keluarga');

    // Navigation links
    expect(str).toContain('Beranda');
    expect(str).toContain('Statistik');
    expect(str).toContain('Pengaturan');

    // Mascot motivator card
    expect(str).toContain('OtterMascot');
    expect(str).toContain('Keuangan lebih mudah kalau dilakukan Bareng-bareng');
  });
});
