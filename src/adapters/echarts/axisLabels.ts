/**
 * Tick-label policy shared by every builder: overlapping labels are hidden
 * rather than drawn on top of each other, and category labels are truncated
 * with an ellipsis past a fixed width (the full text stays in tooltips).
 */
export const TICK_LABEL_MAX_PX = 84;

export function tickLabelStyle(
  kind: 'number' | 'category' | 'datetime' | 'log',
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const base: Record<string, unknown> = { hideOverlap: true, ...extra };
  if (kind === 'category') {
    return { ...base, interval: 0, overflow: 'truncate', ellipsis: '…', width: TICK_LABEL_MAX_PX };
  }
  return base;
}

const FONT = '12px sans-serif';
let ctx: CanvasRenderingContext2D | null | undefined;

/** Pixel width of a label, measured with a canvas when one exists (browser), else ~7 px per character. */
export function measureLabel(text: string): number {
  if (ctx === undefined) {
    ctx =
      typeof document !== 'undefined'
        ? (document.createElement('canvas').getContext('2d') ?? null)
        : null;
    if (ctx) ctx.font = FONT;
  }
  return ctx ? ctx.measureText(text).width : text.length * 7;
}

/**
 * Roughly what ECharts draws for a "nice" tick near this value: a few
 * significant digits, thousands separators, exponent form for huge values.
 */
export function formatTick(v: number): string {
  if (!Number.isFinite(v)) return '';
  if (Math.abs(v) >= 1e9 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(2);
  return Number(v.toPrecision(3)).toLocaleString('en-US');
}

/**
 * Grid margin on the sides that carry a vertical axis. ECharts 6 keeps tick
 * labels and axis titles inside the chart on its own (`outerBoundsContain`
 * defaults to 'all'; the old `containLabel` is deprecated), so this is only
 * breathing room between the title and the edge.
 */
export const GRID_MARGIN = 16;

/**
 * Gap between a vertical axis and its title, wide enough for the widest tick
 * label the axis is likely to show (its extremes), so the title never sits on
 * the labels however long the numbers get.
 */
export function verticalNameGap(
  values: ArrayLike<number> | undefined,
  minimum = 30,
  format: (v: number) => string = formatTick,
): number {
  if (!values || values.length === 0) return minimum;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!Number.isFinite(lo)) return minimum;
  const widest = Math.max(
    measureLabel(format(lo)),
    measureLabel(format(hi)),
    measureLabel(format(Math.max(Math.abs(lo), Math.abs(hi)))),
  );
  return Math.max(minimum, Math.ceil(widest) + 14);
}

/**
 * Tick label as plain digits, no thousands separators, for identifier axes
 * (exposure ids, visit ids): 2025090800004 rather than 2,025,090,800,004.
 */
export function plainDigitsLabel(v: number): string {
  return Number.isFinite(v) ? String(Number(v.toPrecision(15))) : '';
}

/** The tick formatter an axis measures and draws with: plain digits when asked for, else ECharts' default. */
export function tickFormatter(axis: { plainDigits?: boolean }): (v: number) => string {
  return axis.plainDigits ? plainDigitsLabel : formatTick;
}

/** axisLabel for a linear number axis: plain digits when the spec asks for them, else ECharts' default. */
export function numberAxisLabel(axis: { plainDigits?: boolean }): Record<string, unknown> {
  return tickLabelStyle('number', axis.plainDigits ? { formatter: plainDigitsLabel } : {});
}

/**
 * Twin y axes are told apart by colour: an axis takes the colour of the
 * series drawn against it when they all share one, else none. A lone axis is
 * never coloured, so callers pass `undefined` unless two axes are shown.
 */
export function sharedColor(colors: Iterable<string>): string | undefined {
  const set = new Set(colors);
  return set.size === 1 ? [...set][0] : undefined;
}

/** The axis option with its line, ticks, labels and title tinted in `color`; unchanged when none. */
export function tintAxis(
  axis: Record<string, unknown>,
  color: string | undefined,
): Record<string, unknown> {
  if (!color) return axis;
  return {
    ...axis,
    nameTextStyle: { ...(axis.nameTextStyle as object), color },
    axisLabel: { ...(axis.axisLabel as object), color },
    axisLine: { show: true, lineStyle: { color } },
    axisTick: { show: true, lineStyle: { color } },
  };
}
