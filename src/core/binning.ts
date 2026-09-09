import type { Mapping } from './mapping';

export interface Bounds {
  readonly min: number;
  readonly max: number;
}

/**
 * Bin edges that are equally spaced on screen, not in data space.
 * On a log axis this yields log-spaced edges so every bar has the same
 * pixel width, matching the behaviour of the Flutter rubin_chart histogram.
 * Returns nBins + 1 edges in increasing data order.
 */
export function pixelSpaceBinEdges(nBins: number, bounds: Bounds, mapping: Mapping): number[] {
  if (!Number.isInteger(nBins) || nBins < 1)
    throw new RangeError(`nBins must be >= 1, got ${nBins}`);
  const lo = mapping.forward(bounds.min);
  const hi = mapping.forward(bounds.max);
  const edges = Array.from({ length: nBins + 1 }, (_, i) =>
    mapping.inverse(lo + ((hi - lo) * i) / nBins),
  );
  // Guard against floating-point drift at the ends so bounds are exactly reproduced.
  edges[0] = bounds.min;
  edges[nBins] = bounds.max;
  return edges;
}

/** Index of the bin containing `value`, or -1 when outside [edges[0], edges[n]]. */
export function binIndex(edges: readonly number[], value: number): number {
  const n = edges.length - 1;
  if (value < edges[0] || value > edges[n]) return -1;
  if (value === edges[n]) return n - 1; // right edge is inclusive for the last bin
  let lo = 0;
  let hi = n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (value < edges[mid]) hi = mid;
    else lo = mid;
  }
  return lo;
}

export interface BinCounts {
  readonly edges: readonly number[];
  readonly counts: Uint32Array;
  /** Point indices grouped by bin, so bin selection can resolve to data ids. */
  readonly members: readonly (readonly number[])[];
}

export function binValues(values: ArrayLike<number>, edges: readonly number[]): BinCounts {
  const n = edges.length - 1;
  const counts = new Uint32Array(n);
  const members: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < values.length; i++) {
    const b = binIndex(edges, values[i]);
    if (b >= 0) {
      counts[b]++;
      members[b].push(i);
    }
  }
  return { edges, counts, members };
}
