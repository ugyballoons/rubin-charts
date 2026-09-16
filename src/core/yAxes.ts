/**
 * Which y axis each series of a cartesian chart is drawn against when the
 * series plot different quantities. Sky background in counts and wind speed in
 * m/s share nothing but the x axis; on one scale the smaller flattens into a
 * line. So the policy is:
 *
 * - series of the same quantity share an axis;
 * - the first quantity takes the primary (left) axis, the second the secondary
 *   (right) one;
 * - any further quantity has no axis of its own and shares the primary, and is
 *   reported so the chart can say so.
 *
 * A quantity key is whatever the caller considers "the same scale": a unit when
 * the column has one, otherwise the column itself.
 */
export type YAxisIndex = 0 | 1;

export interface YAxisAssignment {
  /** Per series, aligned with the input keys. */
  readonly index: readonly YAxisIndex[];
  /** Input positions of series whose quantity got no axis of its own. */
  readonly overflow: readonly number[];
  /** True when any series uses the secondary axis. */
  readonly hasSecondary: boolean;
}

export function assignYAxes(keys: readonly string[]): YAxisAssignment {
  const axisOf = new Map<string, YAxisIndex | null>();
  const index: YAxisIndex[] = [];
  const overflow: number[] = [];
  keys.forEach((key, i) => {
    if (!axisOf.has(key)) {
      const n = axisOf.size;
      axisOf.set(key, n === 0 ? 0 : n === 1 ? 1 : null);
    }
    const axis = axisOf.get(key)!;
    if (axis === null) overflow.push(i);
    index.push(axis ?? 0);
  });
  return { index, overflow, hasSecondary: index.includes(1) };
}
