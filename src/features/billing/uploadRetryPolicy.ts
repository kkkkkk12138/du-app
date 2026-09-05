const retryDelaysMs = [
  5_000,
  30_000,
  120_000,
  600_000,
  3_600_000,
] as const;

const steadyStateDelayMs = 21_600_000;

export function retryDelayMs(
  attemptCount: number,
  random: () => number = Math.random,
) {
  const normalizedAttempt = Math.max(1, Math.floor(attemptCount));
  const baseDelay =
    retryDelaysMs[normalizedAttempt - 1] ?? steadyStateDelayMs;
  const jitter = 0.8 + Math.min(1, Math.max(0, random())) * 0.4;
  return Math.round(baseDelay * jitter);
}
