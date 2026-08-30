/** Opening beat of the space load bar (shadcn Progress demo feel). */
export const SPACE_LOAD_START_PERCENT = 13;
export const SPACE_LOAD_MID_PERCENT = 66;
export const SPACE_LOAD_DONE_PERCENT = 100;

export const SPACE_LOAD_MID_AT_MS = 500;
export const SPACE_LOAD_MIN_MS = 600;
export const SPACE_LOAD_FALLBACK_MS = 4_000;

export function spaceLoadPercent(elapsedMs: number, spaceReady: boolean): number {
  if (elapsedMs >= SPACE_LOAD_FALLBACK_MS) return SPACE_LOAD_DONE_PERCENT;
  if (elapsedMs < SPACE_LOAD_MID_AT_MS) return SPACE_LOAD_START_PERCENT;
  if (spaceReady && elapsedMs >= SPACE_LOAD_MIN_MS) return SPACE_LOAD_DONE_PERCENT;
  return SPACE_LOAD_MID_PERCENT;
}

export function spaceLoadShouldDismiss(elapsedMs: number, spaceReady: boolean): boolean {
  return elapsedMs >= SPACE_LOAD_FALLBACK_MS
    || (spaceReady && elapsedMs >= SPACE_LOAD_MIN_MS);
}
