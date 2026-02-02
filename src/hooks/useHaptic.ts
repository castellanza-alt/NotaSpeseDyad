import { useCallback } from "react";

export function useHaptic() {
  const trigger = useCallback((pattern: number | number[]) => {
    // Verifica se l'API vibrazione è supportata e se l'utente ha interagito con la pagina
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Fallimento silenzioso su dispositivi non supportati
      }
    }
  }, []);

  const success = useCallback(() => {
    // Singola vibrazione leggera e secca (Light)
    trigger(15); 
  }, [trigger]);

  const impact = useCallback(() => {
    // Vibrazione quasi impercettibile per interazioni UI (Soft)
    trigger(5);
  }, [trigger]);

  const error = useCallback(() => {
    // Doppio impulso deciso (Double-Tap)
    trigger([50, 70, 50]);
  }, [trigger]);

  return { success, impact, error };
}