import type { EChartsCoreOption } from 'echarts/core';
import type { AxisSpec } from '../../adapter';
import { binValues, pixelSpaceBinEdges, type BinCounts, type Bounds } from '../../core/binning';
import { mappingFor } from '../../core/mapping';

export interface HistogramSeriesInput {
  readonly id: string;
  readonly name: string;
  readonly values: ArrayLike<number>;
  readonly color: string;
}

export interface HistogramOptionInput {
  readonly series: readonly HistogramSeriesInput[];
  /** The binned (main) axis. Orientation follows its location: bottom/top → vertical bars. */
  readonly mainAxis: AxisSpec;
  readonly nBins: number;
  /** Bin over these bounds; defaults to the min/max across all series. */
  readonly bounds?: Bounds;
  /** Selected bin indices per series id. */
  readonly selected: ReadonlyMap<string, ReadonlySet<number>>;
}

export interface HistogramBins {
  readonly edges: readonly number[];
  readonly perSeries: ReadonlyMap<string, BinCounts>;
}

/** Compute the shared, pixel-uniform bin edges and per-series counts. */
export function computeHistogramBins(input: HistogramOptionInput): HistogramBins {
  const mapping = mappingFor(input.mainAxis.mapping);
  let bounds = input.bounds;
  if (!bounds) {
    let min = Infinity;
    let max = -Infinity;
    for (const s of input.series) {
      for (let i = 0; i < s.values.length; i++) {
        const v = s.values[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!Number.isFinite(min)) [min, max] = [0, 1];
    if (min === max) [min, max] = [min - 0.5, max + 0.5];
    bounds = { min, max };
  }
  const edges = pixelSpaceBinEdges(input.nBins, bounds, mapping);
  const perSeries = new Map(input.series.map((s) => [s.id, binValues(s.values, edges)]));
  return { edges, perSeries };
}

/**
 * Histogram as an ECharts `custom` series: one rectangle per bin spanning
 * [edge_i, edge_i+1] in data units, so bars are exact on log axes where a
 * `bar` series' fixed pixel widths would be wrong. Selected bins are drawn
 * fully opaque, others dimmed, matching the Flutter rubin_chart look.
 */
export function buildHistogramOption(
  input: HistogramOptionInput,
  bins = computeHistogramBins(input),
): EChartsCoreOption {
  const vertical = input.mainAxis.location === 'bottom' || input.mainAxis.location === 'top';
  const mainIndex = vertical ? 0 : 1; // encode index of the binned value in each datum
  const countIndex = 1 - mainIndex;

  const series = input.series.map((s) => {
    const counts = bins.perSeries.get(s.id)!.counts;
    const selected = input.selected.get(s.id);
    const anySelected = (selected?.size ?? 0) > 0;
    const data = Array.from(counts, (c, i) => {
      const lo = bins.edges[i];
      const hi = bins.edges[i + 1];
      return vertical ? [lo, c, hi, i] : [c, lo, hi, i];
    });
    return {
      id: s.id,
      name: s.name,
      type: 'custom',
      encode: vertical ? { x: [0, 2], y: 1 } : { y: [1, 2], x: 0 },
      data,
      clip: true,
      renderItem: (
        _params: unknown,
        api: { value(i: number): number; coord(v: number[]): number[] },
      ) => {
        const bin = api.value(3);
        const lo = api.value(vertical ? 0 : 1);
        const hi = api.value(2);
        const c = api.value(countIndex);
        const p0 = vertical ? api.coord([lo, 0]) : api.coord([0, lo]);
        const p1 = vertical ? api.coord([hi, c]) : api.coord([c, hi]);
        const x = Math.min(p0[0], p1[0]);
        const y = Math.min(p0[1], p1[1]);
        const w = Math.abs(p1[0] - p0[0]);
        const h = Math.abs(p1[1] - p0[1]);
        const dim = anySelected && !selected!.has(bin);
        return {
          type: 'rect',
          shape: { x: x + 0.5, y, width: Math.max(w - 1, 0.5), height: h },
          style: {
            fill: s.color,
            opacity: dim ? 0.35 : 1,
            stroke: '#fff',
            lineWidth: 0.5,
          },
        };
      },
    };
  });

  const mainOption = {
    type: input.mainAxis.mapping === 'linear' ? 'value' : 'log',
    ...(input.mainAxis.mapping !== 'linear' && {
      logBase: input.mainAxis.mapping === 'log10' ? 10 : Math.E,
    }),
    name: input.mainAxis.label,
    nameLocation: 'middle',
    nameGap: 30,
    nameTextStyle: { fontWeight: 'bold' },
    inverse: input.mainAxis.inverted,
    // Let the axis grow to nice ticks around the data, as the Flutter axes did.
    scale: true,
  };
  const countOption = {
    type: 'value',
    name: 'count',
    nameLocation: 'middle',
    nameGap: 40,
    nameTextStyle: { fontWeight: 'bold' },
    min: 0,
    // The Flutter histogram inverts the count axis for horizontal bars.
    inverse: !vertical,
  };

  return {
    animation: false,
    xAxis: vertical ? mainOption : countOption,
    yAxis: vertical ? countOption : mainOption,
    grid: { containLabel: true, left: 48, right: 16, top: 16, bottom: 36 },
    series,
  };
}
