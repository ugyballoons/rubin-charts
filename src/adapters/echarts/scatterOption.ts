import type { EChartsCoreOption } from 'echarts/core';
import type { AxisSpec, SeriesSpec } from '../../adapter';
import type { DataIdKey } from '../../core/dataId';
import { GRID_LEFT, tickLabelStyle, verticalNameGap } from './axisLabels';

const MJD_EPOCH_MS = Date.UTC(1858, 10, 17);
export const msToMjd = (ms: number): number => (ms - MJD_EPOCH_MS) / 86_400_000;

function axisOption(axis: AxisSpec, values?: ArrayLike<number>) {
  const vertical = axis.location === 'left' || axis.location === 'right';
  const base: Record<string, unknown> = {
    name: axis.label,
    inverse: axis.inverted,
    scale: true,
    nameLocation: 'middle',
    nameGap: vertical ? verticalNameGap(values) : 30,
    nameTextStyle: { fontWeight: 'bold' },
  };
  if (axis.kind === 'category') {
    return {
      ...base,
      type: 'category',
      data: axis.categories ? [...axis.categories] : undefined,
      scale: undefined,
      axisLabel: tickLabelStyle('category'),
    };
  }
  if (axis.kind === 'datetime') {
    return {
      ...base,
      type: 'time',
      axisLabel: tickLabelStyle(
        'datetime',
        axis.mjdLabels ? { formatter: (v: number) => msToMjd(v).toFixed(3) } : {},
      ),
    };
  }
  if (axis.mapping === 'linear')
    return {
      ...base,
      type: 'value',
      axisLabel: tickLabelStyle('number'),
      ...(axis.integer && { minInterval: 1 }),
    };
  const logBase = axis.mapping === 'log10' ? 10 : Math.E;
  return {
    ...base,
    type: 'log',
    logBase,
    axisLabel: tickLabelStyle(
      'log',
      axis.mapping === 'logE'
        ? { formatter: (v: number) => `e${superscript(Math.round(Math.log(v)))}` }
        : {},
    ),
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

  series.push(selectionOverlaySeries(input.series, input.selected));

  return {
    animation: false,
    dataset: datasets,
    xAxis: axisOption(input.xAxis),
    yAxis: axisOption(input.yAxis, input.series[0]?.y),
    grid: { containLabel: true, left: GRID_LEFT, right: 16, top: 16, bottom: 36 },
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

export const SELECTION_SERIES_ID = '__selected__';

/**
 * The overlay series that marks selected points. Send it alone through
 * `setOption({ series: [overlay] })` (merge mode) on every selection change so
 * the base datasets are never re-uploaded.
 */
export function selectionOverlaySeries(
  series: readonly SeriesSpec[],
  selected: ReadonlySet<DataIdKey>,
  largeThreshold = 5000,
): Record<string, unknown> {
  const data = series.flatMap((s) => pickSelected(s, selected));
  const large = data.length > largeThreshold;
  return {
    id: SELECTION_SERIES_ID,
    name: 'selected',
    type: 'scatter',
    data,
    // A few points get a ring; a large brush gets a solid, smaller mark so the
    // overlay stays legible and cheap to draw.
    symbolSize: large ? 4 : 8,
    itemStyle: large
      ? { color: '#111', opacity: 0.85 }
      : { color: 'transparent', borderColor: '#111', borderWidth: 2 },
    large,
    silent: true,
    // Own canvas layer: repainting the overlay must not repaint the 100k-point base.
    zlevel: 1,
    z: 10,
  };
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
