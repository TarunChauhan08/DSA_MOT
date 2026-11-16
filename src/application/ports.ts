/** Injected so use cases stay deterministic under test (no hidden clock or randomness). */
export interface Clock {
  now(): number;
}

export interface IdGenerator {
  next(): string;
}

export const systemClock: Clock = { now: () => Date.now() };
export const randomIds: IdGenerator = { next: () => crypto.randomUUID() };
