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

/** How ECharts formats a value-axis tick, near enough to size things. */
export function formatTick(v: number): string {
  if (!Number.isFinite(v)) return '';
  if (Math.abs(v) >= 1e9 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(2);
  return Number(v.toPrecision(6)).toLocaleString('en-US');
}

/**
 * Gap between a vertical axis and its title, wide enough for the widest tick
 * label the axis is likely to show (its extremes), so the title never sits on
 * the labels however long the numbers get.
 */
export function verticalNameGap(values: ArrayLike<number> | undefined, minimum = 30): number {
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
    measureLabel(formatTick(lo)),
    measureLabel(formatTick(hi)),
    measureLabel(formatTick(Math.max(Math.abs(lo), Math.abs(hi)))),
  );
  return Math.max(minimum, Math.ceil(widest) + 14);
}
