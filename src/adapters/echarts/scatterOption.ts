import type { EChartsCoreOption } from 'echarts/core';
import type { AxisSpec, SeriesSpec } from '../../adapter';
import type { DataIdKey } from '../../core/dataId';
import {
  GRID_MARGIN,
  numberAxisLabel,
  sharedColor,
  tickFormatter,
  tintAxis,
  tickLabelStyle,
  verticalNameGap,
} from './axisLabels';

const MJD_EPOCH_MS = Date.UTC(1858, 10, 17);
export const msToMjd = (ms: number): number => (ms - MJD_EPOCH_MS) / 86_400_000;

function axisOption(axis: AxisSpec, values?: ArrayLike<number>, color?: string) {
  return tintAxis(plainAxisOption(axis, values), color);
}

function plainAxisOption(axis: AxisSpec, values?: ArrayLike<number>): Record<string, unknown> {
  const vertical = axis.location === 'left' || axis.location === 'right';
  const base: Record<string, unknown> = {
    name: axis.label,
    position: axis.location,
    inverse: axis.inverted,
    scale: true,
    nameLocation: 'middle',
    nameGap: vertical ? verticalNameGap(values, 30, tickFormatter(axis)) : 30,
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
      axisLabel: numberAxisLabel(axis),
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
  /**
   * A second y axis on the right for series with `yAxisIndex` 1. Without it
   * every series is drawn against `yAxis` whatever its index says.
   */
  readonly secondaryYAxis?: AxisSpec;
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
  const twin = !!input.secondaryYAxis;
  const axisIndexOf = (s: SeriesSpec) => (twin ? (s.yAxisIndex ?? 0) : 0);
  const onAxis = (k: 0 | 1) => input.series.filter((s) => axisIndexOf(s) === k);

  input.series.forEach((s, i) => {
    const filtered = input.drillDown ? maskSeries(s, input.drillDown) : s;
    datasets.push({ id: `base-${s.id}`, source: interleave(filtered), dimensions: ['x', 'y'] });
    const large = filtered.y.length > largeThreshold;
    series.push({
      id: s.id,
      name: s.name,
      type: 'scatter',
      datasetIndex: i,
      yAxisIndex: axisIndexOf(s),
      symbolSize: s.marker.size,
      itemStyle: { color: s.marker.color, borderColor: s.marker.edgeColor },
      large,
      largeThreshold,
      progressive: large ? 20_000 : 0,
      silent: true,
    });
  });

  series.push(...selectionOverlaySeries(input.series, input.selected, largeThreshold, twin));

  const colorOf = (k: 0 | 1) =>
    twin ? sharedColor(onAxis(k).map((s) => s.marker.color)) : undefined;
  const yAxes = [axisOption(input.yAxis, onAxis(0)[0]?.y, colorOf(0))];
  if (input.secondaryYAxis) {
    yAxes.push(
      axisOption({ ...input.secondaryYAxis, location: 'right' }, onAxis(1)[0]?.y, colorOf(1)),
    );
  }

  return {
    animation: false,
    // Time axes tick and label in UTC, the zone the data and tooltips use.
    useUTC: true,
    dataset: datasets,
    xAxis: axisOption(input.xAxis),
    yAxis: yAxes,
    // The right margin makes the same room for a secondary axis title as the left does.
    grid: {
      left: GRID_MARGIN,
      right: twin ? GRID_MARGIN : 16,
      top: 16,
      bottom: 36,
    },
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
        // One zoom drives both y axes so they stay in step.
        yAxisIndex: twin ? [0, 1] : 0,
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
/** Id of the overlay for the y axis at `index`: the primary keeps the bare id. */
export const selectionSeriesId = (index: 0 | 1): string =>
  index === 0 ? SELECTION_SERIES_ID : `${SELECTION_SERIES_ID}${index}`;

/**
 * The overlay series that mark selected points, one per y axis in use so each
 * point is drawn against the axis of its series. Send them alone through
 * `setOption({ series: overlays })` (merge mode) on every selection change so
 * the base datasets are never re-uploaded. The two overlays share one size
 * rule, so a large brush spanning both axes looks the same on each.
 */
export function selectionOverlaySeries(
  series: readonly SeriesSpec[],
  selected: ReadonlySet<DataIdKey>,
  largeThreshold = 5000,
  twinAxes = series.some((s) => s.yAxisIndex === 1),
): Record<string, unknown>[] {
  const axes: (0 | 1)[] = twinAxes ? [0, 1] : [0];
  const perAxis = axes.map((k) =>
    series
      .filter((s) => (twinAxes ? (s.yAxisIndex ?? 0) : 0) === k)
      .flatMap((s) => pickSelected(s, selected)),
  );
  const total = perAxis.reduce((n, d) => n + d.length, 0);
  const large = total > largeThreshold;
  return axes.map((k, i) => selectionOverlay(k, perAxis[i], large));
}

function selectionOverlay(
  axisIndex: 0 | 1,
  data: [number | string, number][],
  large: boolean,
): Record<string, unknown> {
  return {
    id: selectionSeriesId(axisIndex),
    name: 'selected',
    type: 'scatter',
    yAxisIndex: axisIndex,
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
