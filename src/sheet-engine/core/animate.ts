type Key = string; // `${sheetId}:${r}:${c}`

class CellFadeAnimator {
  private active = new Map<Key, { start: number; dur: number }>();

  private animationFrameId: number | null = null;

  private onTick: (() => void) | null = null;

  constructor(private durationMs = 350) {
    this.durationMs = durationMs;
  }

  markChanged(sheetId: string, r: number, c: number) {
    this.active.set(`${sheetId}:${r}:${c}`, {
      start: performance.now(),
      dur: this.durationMs,
    });
    this.ensureTicking();
  }

  getOpacity(sheetId: string, r: number, c: number): number {
    const activeCellAnimationData = this.active.get(`${sheetId}:${r}:${c}`);
    if (!activeCellAnimationData) return 1;
    const animationProgress = Math.min(
      1,
      (performance.now() - activeCellAnimationData.start) /
        activeCellAnimationData.dur,
    );
    if (animationProgress >= 1) {
      this.active.delete(`${sheetId}:${r}:${c}`);
      return 1;
    }
    // ease-out cubic
    return Math.max(0.05, 1 - (1 - animationProgress) ** 3);
  }

  setOnTick(repaintFn: (() => void) | null) {
    this.onTick = repaintFn;
    this.ensureTicking();
  }

  private ensureTicking() {
    if (this.animationFrameId !== null) return;
    if (this.active.size === 0) return;

    const loop = () => {
      this.animationFrameId = null;

      if (this.active.size === 0) {
        return;
      }
      this.onTick?.();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }
}

export const cellFadeAnimator = new CellFadeAnimator(4000);

export function markCellChanged(sheetId: string, r: number, c: number) {
  cellFadeAnimator.markChanged(sheetId, r, c);
}
