import { buildScatterOption, msToMjd, selectionOverlaySeries, superscript } from './scatterOption';
import type { AxisSpec, SeriesSpec } from '../../adapter';
import { dataIdKey } from '../../core/dataId';

const ids = [1, 2, 3].map((s) => dataIdKey({ dayObs: 20240101, seqNum: s }));
const series: SeriesSpec = {
  id: 's1',
  name: 'ra vs dec',
  x: new Float64Array([1, 2, 3]),
  y: new Float64Array([4, 5, 6]),
  dataIds: ids,
  marker: { color: '#058b8c', size: 5 },
};
const xAxis: AxisSpec = {
  location: 'bottom',
  label: 'ra',
  mapping: 'linear',
  inverted: false,
  kind: 'number',
};
const yAxis: AxisSpec = {
  location: 'left',
  label: 'dec',
  mapping: 'log10',
  inverted: true,
  kind: 'number',
};

describe('buildScatterOption', () => {
  it('maps axes, inversion and log mapping', () => {
    const opt = buildScatterOption({
      series: [series],
      xAxis,
      yAxis,
      selected: new Set(),
      drillDown: null,
    }) as any;
    expect(opt.xAxis.type).toBe('value');
    expect(opt.yAxis).toEqual([
      expect.objectContaining({ type: 'log', logBase: 10, inverse: true }),
    ]);
    expect(opt.dataZoom[0]).toMatchObject({ moveOnMouseWheel: true, zoomOnMouseWheel: 'shift' });
  });

  it('draws selection as an overlay instead of touching the base dataset', () => {
    const opt = buildScatterOption({
      series: [series],
      xAxis,
      yAxis,
      selected: new Set([ids[1]]),
      drillDown: null,
    }) as any;
    expect(opt.dataset[0].source).toBeInstanceOf(Float64Array);
    expect(opt.dataset[0].source.length).toBe(6);
    const overlay = opt.series.find((s: any) => s.id === '__selected__');
    expect(overlay.data).toEqual([[2, 5]]);
  });

  it('drill-down filters the base data', () => {
    const opt = buildScatterOption({
      series: [series],
      xAxis,
      yAxis,
      selected: new Set(),
      drillDown: new Set([ids[0], ids[2]]),
    }) as any;
    expect(Array.from(opt.dataset[0].source)).toEqual([1, 4, 3, 6]);
  });

  it('enables large mode above the threshold', () => {
    const opt = buildScatterOption({
      series: [series],
      xAxis,
      yAxis,
      selected: new Set(),
      drillDown: null,
      largeThreshold: 2,
    }) as any;
    expect(opt.series[0].large).toBe(true);
  });

  it('exposes the overlay alone for merge updates', () => {
    const overlays = selectionOverlaySeries([series], new Set([ids[0], ids[2]])) as any[];
    expect(overlays).toHaveLength(1);
    expect(overlays[0].id).toBe('__selected__');
    expect(overlays[0].data).toEqual([
      [1, 4],
      [3, 6],
    ]);
  });

  it('labels category axes from the spec', () => {
    const opt = buildScatterOption({
      series: [series],
      xAxis: { ...xAxis, kind: 'category', categories: ['a', 'b', 'c'] },
      yAxis,
      selected: new Set(),
      drillDown: null,
    }) as any;
    expect(opt.xAxis).toMatchObject({ type: 'category', data: ['a', 'b', 'c'] });
  });

  it('formats MJD and base-e labels', () => {
    expect(msToMjd(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(51544.5, 6);
    expect(superscript(-12)).toBe('⁻¹²');
  });
});

describe('integer axes', () => {
  it('ticks only on whole numbers', () => {
    const opt = buildScatterOption({
      series: [series],
      xAxis: { ...xAxis, integer: true },
      yAxis: { ...yAxis, mapping: 'linear', integer: true },
      selected: new Set(),
      drillDown: null,
    }) as any;
    expect(opt.xAxis.minInterval).toBe(1);
    expect(opt.yAxis[0].minInterval).toBe(1);
    expect(
      (
        buildScatterOption({
          series: [series],
          xAxis,
          yAxis,
          selected: new Set(),
          drillDown: null,
        }) as any
      ).xAxis.minInterval,
    ).toBeUndefined();
  });
});

describe('time axes', () => {
  it('tick and label in UTC, matching the data and tooltips', () => {
    const opt = buildScatterOption({
      series: [series],
      xAxis: { ...xAxis, kind: 'datetime' },
      yAxis,
      selected: new Set(),
      drillDown: null,
    }) as any;
    expect(opt.useUTC).toBe(true);
    expect(opt.xAxis.type).toBe('time');
  });
});

describe('identifier axes', () => {
  it('label ticks as plain digits without thousands separators', () => {
    const opt = buildScatterOption({
      series: [series],
      xAxis: { ...xAxis, integer: true, plainDigits: true },
      yAxis: { ...yAxis, mapping: 'linear', integer: true },
      selected: new Set(),
      drillDown: null,
    }) as any;
    expect(opt.xAxis.axisLabel.formatter(2025090800004)).toBe('2025090800004');
    expect(opt.yAxis[0].axisLabel.formatter).toBeUndefined();
  });
});

describe('twin y axes', () => {
  const wind: SeriesSpec = {
    ...series,
    id: 's2',
    name: 'wind',
    y: new Float64Array([0.1, 0.2, 0.3]),
    dataIds: [4, 5, 6].map((n) => dataIdKey({ dayObs: 20240101, seqNum: n })),
    marker: { color: '#e6194b', size: 5 },
    yAxisIndex: 1,
  };
  const secondaryYAxis: AxisSpec = {
    location: 'right',
    label: 'wind_speed',
    mapping: 'linear',
    inverted: false,
    kind: 'number',
  };
  const twin = () =>
    buildScatterOption({
      series: [series, wind],
      xAxis,
      yAxis,
      secondaryYAxis,
      selected: new Set([ids[0], wind.dataIds[1]]),
      drillDown: null,
    }) as any;

  it('draws a right-hand axis and points each series at its own', () => {
    const opt = twin();
    expect(opt.yAxis).toHaveLength(2);
    expect(opt.yAxis[1]).toMatchObject({ position: 'right', name: 'wind_speed', type: 'value' });
    expect(opt.series.find((s: any) => s.id === 's1').yAxisIndex).toBe(0);
    expect(opt.series.find((s: any) => s.id === 's2').yAxisIndex).toBe(1);
    expect(opt.dataZoom[1].yAxisIndex).toEqual([0, 1]);
  });

  it('colours each axis after the series drawn against it', () => {
    const opt = twin();
    expect(opt.yAxis[0].axisLine.lineStyle.color).toBe('#058b8c');
    expect(opt.yAxis[0].axisLabel.color).toBe('#058b8c');
    expect(opt.yAxis[1].nameTextStyle.color).toBe('#e6194b');
    // A lone axis stays in the default colour.
    const single = buildScatterOption({
      series: [series],
      xAxis,
      yAxis,
      selected: new Set(),
      drillDown: null,
    }) as any;
    expect(single.yAxis[0].axisLine).toBeUndefined();
    expect(single.yAxis[0].axisLabel.color).toBeUndefined();
  });

  it('marks selected points against the axis of their series', () => {
    const opt = twin();
    const left = opt.series.find((s: any) => s.id === '__selected__');
    const right = opt.series.find((s: any) => s.id === '__selected__1');
    expect(left).toMatchObject({ yAxisIndex: 0, data: [[1, 4]] });
    expect(right).toMatchObject({ yAxisIndex: 1, data: [[2, 0.2]] });
  });

  it('ignores yAxisIndex without a secondary axis to draw against', () => {
    const opt = buildScatterOption({
      series: [series, wind],
      xAxis,
      yAxis,
      selected: new Set(),
      drillDown: null,
    }) as any;
    expect(opt.yAxis).toHaveLength(1);
    expect(opt.series.find((s: any) => s.id === 's2').yAxisIndex).toBe(0);
    expect(opt.series.filter((s: any) => s.name === 'selected')).toHaveLength(1);
  });
});
