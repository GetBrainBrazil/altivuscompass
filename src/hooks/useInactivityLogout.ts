import { useEffect, useRef, useCallback } from "react";

const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours in ms
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"] as const;

export function useInactivityLogout(onInactivityLogout: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onInactivityLogout();
    }, INACTIVITY_TIMEOUT);
  }, [onInactivityLogout]);

  useEffect(() => {
    resetTimer();

    const handler = () => resetTimer();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handler, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handler);
      }
    };
  }, [resetTimer]);
}
