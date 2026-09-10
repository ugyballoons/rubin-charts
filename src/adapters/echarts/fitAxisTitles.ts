import { measureLabel } from './axisLabels';

/** The parts of an ECharts instance this needs; typed loosely because getModel is not in the public typings. */
interface ChartLike {
  getModel(): {
    getComponent(name: string, index?: number): AxisComponent | undefined;
  };
  setOption(
    option: unknown,
    opts?: { notMerge?: boolean; lazyUpdate?: boolean; silent?: boolean },
  ): void;
}
interface AxisComponent {
  axis: { scale: { getTicks(): { value: number }[]; getLabel(tick: { value: number }): string } };
  get(path: string[] | string): unknown;
}

const TITLE_PAD = 12;

/**
 * After a render, size the gap between each vertical axis and its title from
 * the tick labels ECharts actually drew, so the title sits just outside them
 * whatever the numbers look like. Call after every setOption that may change
 * the axis extent. Returns true when a gap changed.
 */
export function fitVerticalAxisTitles(chart: ChartLike): boolean {
  const model = chart.getModel();
  let changed = false;
  const patch: Record<string, unknown[]> = {};
  for (const name of ['yAxis', 'xAxis'] as const) {
    for (let i = 0; i < 4; i++) {
      const comp = model.getComponent(name, i);
      if (!comp) break;
      const position = comp.get('position') as string | undefined;
      const vertical =
        name === 'yAxis'
          ? position !== 'top' && position !== 'bottom'
          : position === 'left' || position === 'right';
      if (!vertical) continue;
      const formatter = comp.get(['axisLabel', 'formatter']) as
        ((v: number) => string) | string | undefined;
      let widest = 0;
      for (const t of comp.axis.scale.getTicks()) {
        const text =
          typeof formatter === 'function' ? formatter(t.value) : comp.axis.scale.getLabel(t);
        widest = Math.max(widest, measureLabel(String(text)));
      }
      const wanted = Math.ceil(widest) + TITLE_PAD;
      const current = comp.get('nameGap') as number | undefined;
      if (current !== wanted) {
        (patch[name] ??= [])[i] = { nameGap: wanted };
        changed = true;
      }
    }
  }
  if (changed) chart.setOption(patch, { notMerge: false, lazyUpdate: false, silent: true });
  return changed;
}
