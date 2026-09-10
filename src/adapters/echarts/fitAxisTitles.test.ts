import { fitVerticalAxisTitles } from './fitAxisTitles';

function fakeChart(labels: string[], nameGap = 30) {
  const calls: unknown[] = [];
  const comp = {
    axis: {
      scale: {
        getTicks: () => labels.map((_, i) => ({ value: i })),
        getLabel: (t: { value: number }) => labels[t.value],
      },
    },
    get: (path: string[] | string) =>
      path === 'nameGap' ? nameGap : path === 'position' ? undefined : undefined,
  };
  return {
    calls,
    getModel: () => ({
      getComponent: (name: string, i = 0) => (name === 'yAxis' && i === 0 ? comp : undefined),
    }),
    setOption: (o: unknown) => calls.push(o),
  };
}

describe('fitVerticalAxisTitles', () => {
  it('sets the y-axis title gap from the widest drawn tick label', () => {
    const chart = fakeChart(['2', '4', '6', '8']);
    expect(fitVerticalAxisTitles(chart)).toBe(true);
    const gap = (chart.calls[0] as { yAxis: { nameGap: number }[] }).yAxis[0].nameGap;
    expect(gap).toBeGreaterThanOrEqual(12);
    expect(gap).toBeLessThan(30);
    const wide = fakeChart(['100,000', '80,000']);
    fitVerticalAxisTitles(wide);
    expect((wide.calls[0] as { yAxis: { nameGap: number }[] }).yAxis[0].nameGap).toBeGreaterThan(
      gap,
    );
  });
  it('does nothing when the gap already fits', () => {
    const chart = fakeChart(['2'], 19);
    expect(fitVerticalAxisTitles(chart)).toBe(false);
  });
});
