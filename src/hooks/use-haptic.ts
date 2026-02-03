import { useCallback } from 'react';

type HapticType = 'light' | 'success' | 'error' | 'warning' | 'medium' | 'heavy';

export const useHaptic = () => {
  const trigger = useCallback((type: HapticType = 'light') => {
    if (typeof window === 'undefined' || !window.navigator?.vibrate) return;

    try {
      switch (type) {
        case 'light':
          window.navigator.vibrate(10);
          break;
        case 'medium':
          window.navigator.vibrate(20);
          break;
        case 'heavy':
          window.navigator.vibrate(40);
          break;
        case 'success':
          window.navigator.vibrate([10, 30, 10]);
          break;
        case 'warning':
          window.navigator.vibrate([30, 50, 10]);
          break;
        case 'error':
          window.navigator.vibrate([50, 50, 50]);
          break;
        default:
          window.navigator.vibrate(10);
      }
    } catch (e) {
      // Ignore errors on devices that don't support vibration or if permission issues
      console.debug('Haptic feedback failed', e);
    }
  }, []);

  return { trigger };
};
