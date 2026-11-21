import { useEffect, useRef } from "react";

function useIdleLogout(isLoggedIn, onIdle, timeout = 15 * 60 * 1000) {
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!isLoggedIn || !timeout || timeout <= 0) {
      return undefined;
    }

    let timerId = null;
    let lastActivity = Date.now();

    const logoutIfInactive = () => {
      const inactiveTime = Date.now() - lastActivity;

      if (inactiveTime >= timeout) {
        onIdleRef.current();
        return;
      }

      timerId = window.setTimeout(logoutIfInactive, timeout - inactiveTime);
    };

    const resetTimer = () => {
      lastActivity = Date.now();

      if (timerId) {
        window.clearTimeout(timerId);
      }

      timerId = window.setTimeout(logoutIfInactive, timeout);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const inactiveTime = Date.now() - lastActivity;

        if (inactiveTime >= timeout) {
          onIdleRef.current();
        }
      }
    };

    const events = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "pointerdown",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, {
        passive: true,
      });
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);

    resetTimer();

    return () => {
      if (timerId) {
        window.clearTimeout(timerId);
      }

      events.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isLoggedIn, timeout]);
}

export default useIdleLogout;
