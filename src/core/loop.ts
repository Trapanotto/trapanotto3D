/**
 * Fixed-step simulation clock. The game logic always advances in equal steps,
 * independent of the display refresh rate; rendering interpolates between the
 * last two steps with the returned alpha.
 */
export class FixedLoop {
  readonly step: number;
  readonly maxSteps: number;
  private accumulator = 0;

  constructor(step: number, maxSteps = 5) {
    this.step = step;
    this.maxSteps = maxSteps;
  }

  /** Runs as many steps as fit into the elapsed time and returns the interpolation alpha (0–1). */
  advance(frameSeconds: number, simulate: (dt: number) => void): number {
    this.accumulator += Math.min(Math.max(frameSeconds, 0), 0.25);
    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxSteps) {
      simulate(this.step);
      this.accumulator -= this.step;
      steps++;
    }
    // Very slow frames drop the remainder instead of spiralling into ever more steps.
    if (steps === this.maxSteps) this.accumulator = Math.min(this.accumulator, this.step);
    return this.accumulator / this.step;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
