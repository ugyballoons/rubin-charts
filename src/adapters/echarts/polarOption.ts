import type { EChartsCoreOption } from 'echarts/core';
import type { AxisSpec, SeriesSpec } from '../../adapter';
import type { DataIdKey } from '../../core/dataId';
import { SELECTION_SERIES_ID } from './scatterOption';
import { tickLabelStyle } from './axisLabels';

export type AngleUnit = 'degrees' | 'radians';

export interface PolarOptionInput {
  /** x = angle, y = radius in each series. */
  readonly series: readonly SeriesSpec[];
  readonly radialAxis: AxisSpec;
  readonly angularAxis: AxisSpec;
  readonly angleUnit?: AngleUnit;
  readonly selected: ReadonlySet<DataIdKey>;
  readonly drillDown: ReadonlySet<DataIdKey> | null;
  readonly largeThreshold?: number;
}

/** ECharts polar data is [radius, angle] with the angle in degrees. */
function toPolarRows(
  s: SeriesSpec,
  unit: AngleUnit,
  keep: ReadonlySet<DataIdKey> | null,
): Float64Array {
  const k = unit === 'radians' ? 180 / Math.PI : 1;
  const x = s.x as Float64Array;
  let n = 0;
  for (let i = 0; i < x.length; i++) if (!keep || keep.has(s.dataIds[i])) n++;
  const out = new Float64Array(n * 2);
  let j = 0;
  for (let i = 0; i < x.length; i++) {
    if (keep && !keep.has(s.dataIds[i])) continue;
    out[j++] = s.y[i];
    out[j++] = x[i] * k;
  }
  return out;
}

export function polarSelectionOverlaySeries(
  series: readonly SeriesSpec[],
  selected: ReadonlySet<DataIdKey>,
  angleUnit: AngleUnit = 'degrees',
  largeThreshold = 5000,
): Record<string, unknown> {
  const data: number[][] = [];
  const k = angleUnit === 'radians' ? 180 / Math.PI : 1;
  if (selected.size > 0) {
    for (const s of series) {
      for (let i = 0; i < s.dataIds.length; i++) {
        if (selected.has(s.dataIds[i])) data.push([s.y[i], (s.x as Float64Array)[i] * k]);
      }
    }
  }
  const large = data.length > largeThreshold;
  return {
    id: SELECTION_SERIES_ID,
    name: 'selected',
    type: 'scatter',
    coordinateSystem: 'polar',
    data,
    symbolSize: large ? 4 : 8,
    itemStyle: large
      ? { color: '#111', opacity: 0.85 }
      : { color: 'transparent', borderColor: '#111', borderWidth: 2 },
    large,
    silent: true,
    zlevel: 1,
    z: 10,
  };
}

/**
 * Polar scatter with the astronomy convention used by the Flutter package:
 * angle zero at the top increasing clockwise (e.g. azimuth), and a radial axis
 * that can be inverted so its maximum sits at the centre (e.g. altitude, so
 * zenith is the middle of the plot).
 */
export function buildPolarOption(input: PolarOptionInput): EChartsCoreOption {
  const unit = input.angleUnit ?? 'degrees';
  const largeThreshold = input.largeThreshold ?? 5000;
  const datasets = input.series.map((s) => ({
    id: `base-${s.id}`,
    source: toPolarRows(s, unit, input.drillDown),
    dimensions: ['r', 'theta'],
  }));
  const series: Record<string, unknown>[] = input.series.map((s, i) => {
    const n = datasets[i].source.length / 2;
    const large = n > largeThreshold;
    return {
      id: s.id,
      name: s.name,
      type: 'scatter',
      coordinateSystem: 'polar',
      datasetIndex: i,
      symbolSize: s.marker.size,
      itemStyle: { color: s.marker.color, borderColor: s.marker.edgeColor },
      large,
      largeThreshold,
      progressive: large ? 20_000 : 0,
      silent: true,
    };
  });
  series.push(polarSelectionOverlaySeries(input.series, input.selected, unit, largeThreshold));

  const radial = input.radialAxis;
  const radiusAxis: Record<string, unknown> = {
    type: radial.mapping === 'linear' ? 'value' : 'log',
    ...(radial.mapping !== 'linear' && { logBase: radial.mapping === 'log10' ? 10 : Math.E }),
    name: radial.label,
    nameLocation: 'middle',
    nameGap: 22,
    inverse: radial.inverted,
    scale: true,
    axisLabel: tickLabelStyle(radial.mapping === 'linear' ? 'number' : 'log'),
    ...(radial.fixedBounds && { min: radial.fixedBounds.min, max: radial.fixedBounds.max }),
  };
  const angleAxis: Record<string, unknown> = {
    type: 'value',
    min: 0,
    max: 360,
    interval: 45,
    startAngle: 90, // zero at the top
    clockwise: !input.angularAxis.inverted,
    axisLabel: tickLabelStyle('number', {
      formatter:
        unit === 'radians'
          ? (v: number) => radiansLabel(v)
          : (v: number) => (v === 360 ? '' : `${v}°`),
    }),
  };

  return {
    animation: false,
    dataset: datasets,
    polar: { radius: ['0%', '80%'] },
    radiusAxis,
    angleAxis,
    series,
  };
}

/** Labels multiples of π/4 as fractions of π. */
export function radiansLabel(degrees: number): string {
  const eighths = Math.round(degrees / 45);
  if (eighths === 0 || eighths === 8) return '0';
  const num = eighths % 2 === 0 ? eighths / 2 : eighths;
  const den = eighths % 2 === 0 ? 2 : 4;
  const n = num === 1 ? '' : String(num);
  return den === 2 && num === 2 ? 'π' : `${n}π/${den}`;
}
