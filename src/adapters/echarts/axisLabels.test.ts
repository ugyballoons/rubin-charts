import { buildScatterOption } from './scatterOption';
import { buildHistogramOption } from './histogramOption';
import { plainDigitsLabel, tickLabelStyle, TICK_LABEL_MAX_PX, verticalNameGap } from './axisLabels';
import type { AxisSpec, SeriesSpec } from '../../adapter';
import { dataIdKey } from '../../core/dataId';

const ids = [1, 2].map((s) => dataIdKey({ dayObs: 20240101, seqNum: s }));
const series: SeriesSpec = {
  id: 's',
  name: 's',
  x: new Float64Array([0, 1]),
  y: new Float64Array([1, 2]),
  dataIds: ids,
  marker: { color: '#000', size: 3 },
};
const num: AxisSpec = {
  location: 'bottom',
  label: 'x',
  mapping: 'linear',
  inverted: false,
  kind: 'number',
};

describe('tick labels', () => {
  it('hide overlapping labels on every axis and truncate long category labels', () => {
    expect(tickLabelStyle('number')).toEqual({ hideOverlap: true });
    expect(tickLabelStyle('category')).toMatchObject({
      hideOverlap: true,
      overflow: 'truncate',
      width: TICK_LABEL_MAX_PX,
    });
    const opt = buildScatterOption({
      series: [series],
      xAxis: { ...num, kind: 'category', categories: ['a long category label', 'b'] },
      yAxis: { ...num, location: 'left' },
      selected: new Set(),
      drillDown: null,
    }) as any;
    expect(opt.xAxis.axisLabel).toMatchObject({ overflow: 'truncate', hideOverlap: true });
    expect(opt.yAxis.axisLabel).toEqual({ hideOverlap: true });
    const h = buildHistogramOption({
      series: [{ id: 'h', name: 'h', values: new Float64Array([0, 1]), color: '#000' }],
      mainAxis: { ...num, kind: 'datetime', mjdLabels: true },
      nBins: 2,
      selected: new Map(),
    }) as any;
    expect(h.xAxis.axisLabel.hideOverlap).toBe(true);
    expect(typeof h.xAxis.axisLabel.formatter).toBe('function');
  });
});

describe('verticalNameGap', () => {
  it('grows with the widest extreme label and never shrinks below the minimum', async () => {
    const { verticalNameGap, formatTick } = await import('./axisLabels');
    expect(formatTick(100000)).toBe('100,000');
    expect(formatTick(-88.123456)).toBe('-88.1');
    expect(formatTick(2026071300013)).toBe('2.03e+12');
    expect(verticalNameGap([0, 1])).toBe(30);
    expect(verticalNameGap([0, 100000])).toBeGreaterThan(verticalNameGap([0, 10]));
    expect(verticalNameGap(new Float64Array([-100, 40]))).toBeGreaterThanOrEqual(30);
  });
});

describe('plainDigitsLabel', () => {
  it('writes whole numbers as digits only and drops float noise', () => {
    expect(plainDigitsLabel(2025090800004)).toBe('2025090800004');
    expect(plainDigitsLabel(0.1 + 0.2)).toBe('0.3');
    expect(plainDigitsLabel(NaN)).toBe('');
  });
  it('widens a vertical axis title gap for the unabbreviated label', () => {
    const plain = verticalNameGap([0, 2025090800004], 30, plainDigitsLabel);
    expect(plain).toBeGreaterThan(verticalNameGap([0, 2025090800004]));
  });
});
