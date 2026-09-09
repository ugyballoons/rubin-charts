import type { EChartsCoreOption } from 'echarts/core';
import type { AxisSpec, SeriesSpec } from '../../adapter';
import type { DataIdKey } from '../../core/dataId';

const MJD_EPOCH_MS = Date.UTC(1858, 10, 17);
export const msToMjd = (ms: number): number => (ms - MJD_EPOCH_MS) / 86_400_000;

function axisOption(axis: AxisSpec) {
  const base: Record<string, unknown> = {
    name: axis.label,
    inverse: axis.inverted,
    scale: true,
    nameLocation: 'middle',
    nameGap: 28,
  };
  if (axis.kind === 'category') return { ...base, type: 'category' };
  if (axis.kind === 'datetime') {
    return axis.mjdLabels
      ? { ...base, type: 'time', axisLabel: { formatter: (v: number) => msToMjd(v).toFixed(3) } }
      : { ...base, type: 'time' };
  }
  if (axis.mapping === 'linear') return { ...base, type: 'value' };
  const logBase = axis.mapping === 'log10' ? 10 : Math.E;
  return {
    ...base,
    type: 'log',
    logBase,
    ...(axis.mapping === 'logE' && {
      axisLabel: { formatter: (v: number) => `e${superscript(Math.round(Math.log(v)))}` },
    }),
  };
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export function superscript(n: number): string {
  const s = String(Math.abs(n))
    .split('')
    .map((c) => SUP[Number(c)])
    .join('');
  return n < 0 ? `⁻${s}` : s;
}

/** Interleave x/y into the flat row-major array ECharts' large mode consumes without copying. */
function interleave(s: SeriesSpec): Float64Array | (string | number)[][] {
  if (s.x instanceof Float64Array) {
    const out = new Float64Array(s.x.length * 2);
    for (let i = 0; i < s.x.length; i++) {
      out[2 * i] = s.x[i];
      out[2 * i + 1] = s.y[i];
    }
    return out;
  }
  return Array.from(s.y, (y, i) => [s.x[i] as string, y]);
}

export interface ScatterOptionInput {
  readonly series: readonly SeriesSpec[];
  readonly xAxis: AxisSpec;
  readonly yAxis: AxisSpec;
  readonly selected: ReadonlySet<DataIdKey>;
  readonly drillDown: ReadonlySet<DataIdKey> | null;
  /** Above this many points per series, ECharts large mode and progressive rendering are enabled. */
  readonly largeThreshold?: number;
}

/**
 * Build the ECharts option for a cartesian scatter. Selected points are drawn as
 * a separate overlay series, so a selection change never re-uploads the base data.
 */
export function buildScatterOption(input: ScatterOptionInput): EChartsCoreOption {
  const largeThreshold = input.largeThreshold ?? 5000;
  const series: Record<string, unknown>[] = [];
  const datasets: Record<string, unknown>[] = [];

  input.series.forEach((s, i) => {
    const filtered = input.drillDown ? maskSeries(s, input.drillDown) : s;
    datasets.push({ id: `base-${s.id}`, source: interleave(filtered), dimensions: ['x', 'y'] });
    const large = filtered.y.length > largeThreshold;
    series.push({
      id: s.id,
      name: s.name,
      type: 'scatter',
      datasetIndex: i,
      symbolSize: s.marker.size,
      itemStyle: { color: s.marker.color, borderColor: s.marker.edgeColor },
      large,
      largeThreshold,
      progressive: large ? 20_000 : 0,
      silent: true,
    });
  });

  const overlay = input.series.flatMap((s) =>
    pickSelected(s, input.selected).map(([x, y]) => [x, y]),
  );
  series.push({
    id: '__selected__',
    name: 'selected',
    type: 'scatter',
    data: overlay,
    symbolSize: 7,
    itemStyle: { color: 'transparent', borderColor: '#000', borderWidth: 2 },
    silent: true,
    z: 10,
  });

  return {
    animation: false,
    dataset: datasets,
    xAxis: axisOption(input.xAxis),
    yAxis: axisOption(input.yAxis),
    grid: { containLabel: true, left: 12, right: 16, top: 16, bottom: 12 },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        moveOnMouseWheel: true,
        zoomOnMouseWheel: 'shift',
        moveOnMouseMove: false,
        disabled: !!input.xAxis.fixedBounds,
      },
      {
        type: 'inside',
        yAxisIndex: 0,
        moveOnMouseWheel: true,
        zoomOnMouseWheel: 'shift',
        moveOnMouseMove: false,
        disabled: !!input.yAxis.fixedBounds,
      },
    ],
    series,
  };
}

function maskSeries(s: SeriesSpec, keep: ReadonlySet<DataIdKey>): SeriesSpec {
  const idx: number[] = [];
  for (let i = 0; i < s.dataIds.length; i++) if (keep.has(s.dataIds[i])) idx.push(i);
  const y = new Float64Array(idx.length);
  idx.forEach((j, k) => (y[k] = s.y[j]));
  const x =
    s.x instanceof Float64Array
      ? (() => {
          const out = new Float64Array(idx.length);
          idx.forEach((j, k) => (out[k] = (s.x as Float64Array)[j]));
          return out;
        })()
      : idx.map((j) => (s.x as readonly string[])[j]);
  return { ...s, x, y, dataIds: idx.map((j) => s.dataIds[j]) };
}

function pickSelected(
  s: SeriesSpec,
  selected: ReadonlySet<DataIdKey>,
): [number | string, number][] {
  if (selected.size === 0) return [];
  const out: [number | string, number][] = [];
  for (let i = 0; i < s.dataIds.length; i++) {
    if (selected.has(s.dataIds[i])) out.push([s.x[i], s.y[i]]);
  }
  return out;
}
