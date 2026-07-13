/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#450084'; // JMU Purple (light mode primary)
const tintColorDark = '#CBB677'; // Muted JMU Gold (dark mode accent for contrast)

// The JMU brand colors themselves, for chrome that stays constant regardless
// of light/dark mode (e.g. header bands) rather than swapping with the theme.
export const BrandColors = {
  purple: tintColorLight,
  gold: tintColorDark,
};

// Parking availability status — same meaning in both themes, so not split
// by light/dark like Colors below.
export const StatusColors = {
  available: '#4CAF50',
  limited: '#FF9800',
  full: '#F44336',
  unknown: '#9E9E9E',
};

// The "downtown data unavailable" warning banner — shared by explore.tsx and
// list.tsx, previously duplicated with matching hex values in both files.
export const WarningColors = {
  background: '#fff8e1',
  border: '#e6c15c',
  text: '#7a5b00',
  buttonBackground: '#e6c15c',
  buttonText: '#4a3800',
};

export const Colors = {
  light: {
    text: '#11181C',
    textSecondary: '#666666',
    background: '#fff',
    surface: '#f8f9fa',
    border: '#e9ecef',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    // Additional brand accent for use in UI when needed
    accent: '#CBB677',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#9BA1A6',
    background: '#151718',
    surface: '#1f2022',
    border: '#2a2c2f',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    // Additional brand accent for use in UI when needed
    accent: '#CBB677',
  },
};
