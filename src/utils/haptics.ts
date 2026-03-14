type HapticStyle = 'light' | 'medium' | 'success' | 'error'

const PATTERNS: Record<HapticStyle, number | number[]> = {
  light:   10,
  medium:  25,
  success: [20, 40, 20],
  error:   [30, 20, 30, 20, 30],
}

export function haptic(style: HapticStyle = 'light') {
  try {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return
    navigator.vibrate(PATTERNS[style])
  } catch {
    // Silently ignore — some browsers throw on vibrate()
  }
}
