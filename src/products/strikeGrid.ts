export interface StrikeAlignment {
  input: number;
  aligned: number;
  diff: number;
  diffBps: number;
}

export function alignToGrid(input: number, minStrike: number, tickSize: number): StrikeAlignment {
  const ticks = Math.round((input - minStrike) / tickSize);
  const aligned = minStrike + ticks * tickSize;
  const diff = aligned - input;
  const diffBps = input === 0 ? 0 : (diff / input) * 10_000;
  return { input, aligned, diff, diffBps };
}

export function buildStrikeLadder(input: {
  floor: number;
  target: number;
  step: number;
}): number[] {
  const strikes: number[] = [];
  for (let strike = input.floor; strike < input.target; strike += input.step) {
    strikes.push(strike);
  }
  return strikes;
}
