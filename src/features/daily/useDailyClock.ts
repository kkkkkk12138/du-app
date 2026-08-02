import {useEffect, useState} from 'react';
import {AppState} from 'react-native';

const midnightBufferMs = 1000;

function millisecondsUntilTomorrow(now: Date) {
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  return tomorrow.getTime() - now.getTime() + midnightBufferMs;
}

export function useDailyClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout>;

    const scheduleMidnightRefresh = () => {
      clearTimeout(midnightTimer);
      const current = new Date();
      midnightTimer = setTimeout(() => {
        setNow(new Date());
        scheduleMidnightRefresh();
      }, millisecondsUntilTomorrow(current));
    };

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setNow(new Date());
        scheduleMidnightRefresh();
      }
    });

    scheduleMidnightRefresh();

    return () => {
      clearTimeout(midnightTimer);
      subscription.remove();
    };
  }, []);

  return now;
}
