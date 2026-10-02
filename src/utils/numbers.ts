/** Numeric value of a field such as a card cost or nemesis difficulty; missing or non-numeric values count as 0. */
export function toNumber(value: string | number | undefined): number {
  return Number(value) || 0;
}
