export interface InputHandlers {
  /** Key pressed (auto-repeat is filtered out). */
  onKey(code: string): void;
  onLook(dx: number, dy: number): void;
  onWheel(direction: 1 | -1): void;
}

const GAME_KEYS = new Set([
  'Space',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

/**
 * Keyboard and mouse state. Mouse look uses pointer lock; when the browser
 * refuses it, look falls back to tracking the cursor over the canvas.
 */
export class Input {
  readonly keys = new Set<string>();
  triggerHeld = false;
  enabled = false;
  fallbackLook = false;
  private lastPointer: { x: number; y: number } | null = null;
  private readonly canvas: HTMLCanvasElement;
  private readonly handlers: InputHandlers;

  constructor(canvas: HTMLCanvasElement, handlers: InputHandlers) {
    this.canvas = canvas;
    this.handlers = handlers;
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('mousemove', (e) => this.mouseMove(e));
    window.addEventListener('mousedown', (e) => {
      if (
        e.button === 0 &&
        this.enabled &&
        (this.locked || (this.fallbackLook && e.target === canvas))
      )
        this.triggerHeld = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.triggerHeld = false;
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        this.handlers.onWheel(e.deltaY > 0 ? 1 : -1);
      },
      { passive: false },
    );
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** -1…1 on both axes from WASD. */
  moveAxes(): { forward: number; strafe: number } {
    return {
      forward: (this.isDown('KeyW') ? 1 : 0) - (this.isDown('KeyS') ? 1 : 0),
      strafe: (this.isDown('KeyD') ? 1 : 0) - (this.isDown('KeyA') ? 1 : 0),
    };
  }

  clear(): void {
    this.keys.clear();
    this.triggerHeld = false;
    this.lastPointer = null;
  }

  private keyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    this.keys.add(e.code);
    if (!e.repeat) this.handlers.onKey(e.code);
  }

  private mouseMove(e: MouseEvent): void {
    if (!this.enabled) return;
    if (this.locked) {
      this.handlers.onLook(e.movementX, e.movementY);
      return;
    }
    if (this.fallbackLook && e.target === this.canvas) {
      if (this.lastPointer)
        this.handlers.onLook(e.clientX - this.lastPointer.x, e.clientY - this.lastPointer.y);
      this.lastPointer = { x: e.clientX, y: e.clientY };
    } else this.lastPointer = null;
  }
}
