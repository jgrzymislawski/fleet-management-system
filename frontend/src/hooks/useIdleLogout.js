import { useEffect } from "react";

function useIdleLogout(isLoggedIn, onIdle, timeout) {
  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    let timer;

    const resetTimer = () => {
      clearTimeout(timer);

      timer = setTimeout(() => {
        onIdle();
      }, timeout);
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      clearTimeout(timer);

      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isLoggedIn, onIdle, timeout]);
}

export default useIdleLogout;
