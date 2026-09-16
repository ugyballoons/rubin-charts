import type { EChartsCoreOption } from 'echarts/core';
import type { AxisSpec } from '../../adapter';
import { binValues, integerBinEdges, pixelSpaceBinEdges, type Bounds } from '../../core/binning';
import { mappingFor } from '../../core/mapping';
import { GRID_LEFT, tickLabelStyle, verticalNameGap } from './axisLabels';

export interface BoxSeriesInput {
  readonly id: string;
  readonly name: string;
  /** Values along the binned (main) axis. */
  readonly main: ArrayLike<number>;
  /** Values summarised per bin (cross axis). */
  readonly cross: ArrayLike<number>;
  readonly color: string;
}

export interface BoxOptionInput {
  readonly series: readonly BoxSeriesInput[];
  readonly mainAxis: AxisSpec;
  readonly crossAxis: AxisSpec;
  readonly nBins: number;
  readonly bounds?: Bounds;
  readonly selected: ReadonlyMap<string, ReadonlySet<number>>;
}

/** Five-number summary of one bin: whiskers reach the true min and max, as in the Flutter package. */
export interface BoxStats {
  readonly min: number;
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  readonly max: number;
  readonly count: number;
}

export interface BoxBins {
  readonly edges: readonly number[];
  /** Per series: one BoxStats per bin, null for empty bins. */
  readonly perSeries: ReadonlyMap<string, (BoxStats | null)[]>;
  /** Per series: point indices per bin, for resolving selected bins to data ids. */
  readonly members: ReadonlyMap<string, readonly (readonly number[])[]>;
}

/** Linear-interpolation percentile on a sorted array (matches rubin_chart's box.dart). */
export function percentile(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const pos = (n - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function boxStats(values: ArrayLike<number>): BoxStats | null {
  if (values.length === 0) return null;
  const sorted = Float64Array.from(values).sort();
  return {
    min: sorted[0],
    q1: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    q3: percentile(sorted, 0.75),
    max: sorted[sorted.length - 1],
    count: sorted.length,
  };
}

/** Bin the main axis in pixel space and summarise the cross values in each bin. */
export function computeBoxBins(input: BoxOptionInput): BoxBins {
  const mapping = mappingFor(input.mainAxis.mapping);
  let bounds = input.bounds;
  if (!bounds) {
    let min = Infinity;
    let max = -Infinity;
    for (const s of input.series) {
      for (let i = 0; i < s.main.length; i++) {
        const v = s.main[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!Number.isFinite(min)) [min, max] = [0, 1];
    if (min === max) [min, max] = [min - 0.5, max + 0.5];
    bounds = { min, max };
  }
  const edges =
    input.mainAxis.integer && input.mainAxis.mapping === 'linear'
      ? integerBinEdges(input.nBins, bounds)
      : pixelSpaceBinEdges(input.nBins, bounds, mapping);
  const perSeries = new Map<string, (BoxStats | null)[]>();
  const members = new Map<string, readonly (readonly number[])[]>();
  for (const s of input.series) {
    const binned = binValues(s.main, edges);
    members.set(s.id, binned.members);
    perSeries.set(
      s.id,
      binned.members.map((idx) => boxStats(idx.map((i) => s.cross[i]))),
    );
  }
  return { edges, perSeries, members };
}

/**
 * Binned box chart as an ECharts `custom` series: for each bin a box from Q1
 * to Q3 spanning the bin's data range, a median line, and whiskers to the
 * min and max. Geometry goes through api.coord so it is right on log axes.
 * Selected bins are drawn opaque, others dimmed.
 */
export function buildBoxOption(
  input: BoxOptionInput,
  bins = computeBoxBins(input),
): EChartsCoreOption {
  const vertical = input.mainAxis.location === 'bottom' || input.mainAxis.location === 'top';
  const nSeries = input.series.length;

  const series = input.series.map((s, k) => {
    const stats = bins.perSeries.get(s.id)!;
    const selected = input.selected.get(s.id);
    const anySelected = (selected?.size ?? 0) > 0;
    const data: number[][] = [];
    stats.forEach((st, i) => {
      if (!st) return;
      // [lo, hi, min, q1, median, q3, max, bin]
      data.push([bins.edges[i], bins.edges[i + 1], st.min, st.q1, st.median, st.q3, st.max, i]);
    });
    return {
      id: s.id,
      name: s.name,
      type: 'custom',
      encode: vertical ? { x: [0, 1], y: [2, 6] } : { y: [0, 1], x: [2, 6] },
      data,
      clip: true,
      renderItem: (
        _params: unknown,
        api: { value(i: number): number; coord(v: number[]): number[] },
      ) => {
        const bin = api.value(7);
        const lo = api.value(0);
        const hi = api.value(1);
        // Side by side when there are several series: each takes a slice of the bin.
        const span = hi - lo;
        const inner = 0.8;
        const sLo = lo + span * (0.1 + (inner * k) / nSeries);
        const sHi = lo + span * (0.1 + (inner * (k + 1)) / nSeries);
        const mid = (sLo + sHi) / 2;
        const P = (m: number, c: number) => (vertical ? api.coord([m, c]) : api.coord([c, m]));
        const [xLo, yQ3] = P(sLo, api.value(5));
        const [xHi, yQ1] = P(sHi, api.value(3));
        const [xMid, yMin] = P(mid, api.value(2));
        const [, yMax] = P(mid, api.value(6));
        const [, yMed] = P(mid, api.value(4));
        const dim = anySelected && !selected!.has(bin);
        const stroke = { stroke: s.color, lineWidth: 1.5, opacity: dim ? 0.35 : 1 };
        const box = vertical
          ? {
              x: Math.min(xLo, xHi),
              y: Math.min(yQ1, yQ3),
              width: Math.abs(xHi - xLo),
              height: Math.abs(yQ3 - yQ1),
            }
          : {
              x: Math.min(yQ1, yQ3),
              y: Math.min(xLo, xHi),
              width: Math.abs(yQ3 - yQ1),
              height: Math.abs(xHi - xLo),
            };
        const line = (a: number[], b: number[]) => ({
          type: 'line',
          shape: vertical
            ? { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }
            : { x1: a[1], y1: a[0], x2: b[1], y2: b[0] },
          style: stroke,
        });
        const cap = 0.25 * Math.abs(xHi - xLo);
        return {
          type: 'group',
          children: [
            {
              type: 'rect',
              shape: box,
              style: { fill: s.color, opacity: dim ? 0.15 : 0.35, stroke: s.color, lineWidth: 1 },
            },
            line([xMid, yQ3], [xMid, yMax]),
            line([xMid, yQ1], [xMid, yMin]),
            line([xMid - cap, yMax], [xMid + cap, yMax]),
            line([xMid - cap, yMin], [xMid + cap, yMin]),
            line([xLo, yMed], [xHi, yMed]),
          ],
        };
      },
    };
  });

  const axis = (a: AxisSpec, extra: Record<string, unknown>) => ({
    type: a.mapping === 'linear' ? 'value' : 'log',
    ...(a.mapping !== 'linear' && { logBase: a.mapping === 'log10' ? 10 : Math.E }),
    name: a.label,
    nameLocation: 'middle',
    nameGap: 30,
    nameTextStyle: { fontWeight: 'bold' },
    inverse: a.inverted,
    scale: true,
    axisLabel: tickLabelStyle(a.mapping === 'linear' ? 'number' : 'log'),
    ...(a.mapping === 'linear' && a.integer && { minInterval: 1 }),
    ...extra,
  });
  const main = axis(input.mainAxis, {});
  const cross = axis(input.crossAxis, {
    nameGap: vertical ? verticalNameGap(input.series[0]?.cross) : 30,
  });
  return {
    animation: false,
    xAxis: vertical ? main : cross,
    yAxis: vertical ? cross : main,
    grid: { containLabel: true, left: GRID_LEFT, right: 16, top: 16, bottom: 36 },
    series,
  };
}
