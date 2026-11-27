"use client";

import { useCallback, useSyncExternalStore } from "react";

interface ClockBucket {
  now: number;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
}

const buckets = new Map<number, ClockBucket>();

function getBucket(ms: number): ClockBucket {
  let bucket = buckets.get(ms);
  if (!bucket) {
    bucket = {
      now: typeof window === "undefined" ? 0 : Date.now(),
      listeners: new Set(),
      timer: null,
    };
    buckets.set(ms, bucket);
  }
  return bucket;
}

/**
 * Reloj compartido y seguro para SSR/hidratación (`0` en servidor, `Date.now()` en cliente)
 * que se actualiza cada `ms` para textos tipo "hace 2 min" y cuentas regresivas.
 */
export function useNow(ms = 15_000): number {
  const subscribe = useCallback(
    (listener: () => void) => {
      const bucket = getBucket(ms);
      if (bucket.listeners.size === 0) {
        bucket.now = Date.now();
        bucket.timer = setInterval(() => {
          bucket.now = Date.now();
          bucket.listeners.forEach((l) => l());
        }, ms);
      }
      bucket.listeners.add(listener);
      return () => {
        bucket.listeners.delete(listener);
        if (bucket.listeners.size === 0 && bucket.timer !== null) {
          clearInterval(bucket.timer);
          bucket.timer = null;
        }
      };
    },
    [ms],
  );

  const getSnapshot = useCallback(() => getBucket(ms).now, [ms]);

  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
