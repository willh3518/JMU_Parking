import * as Haptics from 'expo-haptics';

// Gated to iOS only, matching the existing convention in components/HapticTab.tsx —
// Android already applies its own system-level haptics fairly liberally by default,
// so adding more here would be redundant on that platform.
const isIOS = () => process.env.EXPO_OS === 'ios';

export function hapticSelection() {
  if (isIOS()) {
    Haptics.selectionAsync();
  }
}

export function hapticImpact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (isIOS()) {
    Haptics.impactAsync(style);
  }
}
