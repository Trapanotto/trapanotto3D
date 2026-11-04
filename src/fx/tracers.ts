import * as THREE from 'three';

const LIFETIME = 0.055;
const COLOUR = new THREE.Color(0xffcb86).multiplyScalar(0.8);

/** Bullet tracers as one line-segment buffer. Faded segments turn black, which additive blending hides. */
export class TracerPool {
  readonly lines: THREE.LineSegments;
  private readonly capacity: number;
  private readonly positions: Float32Array;
  private readonly colours: Float32Array;
  private readonly life: Float32Array;
  private next = 0;
  private alive = 0;

  constructor(parent: THREE.Object3D, capacity = 64) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 6);
    this.colours = new Float32Array(capacity * 6);
    this.life = new Float32Array(capacity);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colours, 3));
    this.lines = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.lines.frustumCulled = false;
    parent.add(this.lines);
  }

  add(from: THREE.Vector3, to: THREE.Vector3): void {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    if (this.life[i] <= 0) this.alive++;
    this.life[i] = LIFETIME;
    const k = i * 6;
    const pos = this.positions;
    pos[k] = from.x;
    pos[k + 1] = from.y;
    pos[k + 2] = from.z;
    pos[k + 3] = to.x;
    pos[k + 4] = to.y;
    pos[k + 5] = to.z;
    this.paint(i, 1);
    this.flush();
  }

  update(dt: number): void {
    if (!this.alive) return;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) this.alive--;
      this.paint(i, Math.max(0, this.life[i] / LIFETIME));
    }
    this.flush();
  }

  clear(): void {
    this.life.fill(0);
    this.colours.fill(0);
    this.alive = 0;
    this.flush();
  }

  private paint(i: number, strength: number): void {
    const c = this.colours;
    for (let k = i * 6; k < i * 6 + 6; k += 3) {
      c[k] = COLOUR.r * strength;
      c[k + 1] = COLOUR.g * strength;
      c[k + 2] = COLOUR.b * strength;
    }
  }

  private flush(): void {
    const geometry = this.lines.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }
}
