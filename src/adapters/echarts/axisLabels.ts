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
