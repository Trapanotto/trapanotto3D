import * as THREE from 'three';

const GRAVITY = 8;

/**
 * Spark and debris particles in one instanced mesh. Slots are reused in a ring,
 * so emitting never allocates and the oldest particle makes room when full.
 */
export class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private readonly capacity: number;
  private readonly position: Float32Array;
  private readonly velocity: Float32Array;
  private readonly life: Float32Array;
  private next = 0;
  private alive = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly colour = new THREE.Color();
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(parent: THREE.Object3D, capacity = 600) {
    this.capacity = capacity;
    this.position = new Float32Array(capacity * 3);
    this.velocity = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.07),
      new THREE.MeshBasicMaterial({ toneMapped: false }),
      capacity,
    );
    this.mesh.frustumCulled = false;
    for (let i = 0; i < capacity; i++) {
      this.mesh.setMatrixAt(i, this.hidden);
      this.mesh.setColorAt(i, this.colour.set(0xffffff));
    }
    parent.add(this.mesh);
  }

  emit(x: number, y: number, z: number, colour: number, count: number, speed = 1): void {
    this.colour.set(colour);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.capacity;
      if (this.life[i] <= 0) this.alive++;
      const k = i * 3;
      this.position[k] = x;
      this.position[k + 1] = y;
      this.position[k + 2] = z;
      this.velocity[k] = (Math.random() - 0.5) * 4 * speed;
      this.velocity[k + 1] = Math.random() * 3 * speed;
      this.velocity[k + 2] = (Math.random() - 0.5) * 4 * speed;
      this.life[i] = 0.35 + Math.random() * 0.35;
      this.mesh.setColorAt(i, this.colour);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    if (!this.alive) return;
    const p = this.position;
    const v = this.velocity;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alive--;
        this.mesh.setMatrixAt(i, this.hidden);
        continue;
      }
      const k = i * 3;
      v[k + 1] -= GRAVITY * dt;
      p[k] += v[k] * dt;
      p[k + 1] += v[k + 1] * dt;
      p[k + 2] += v[k + 2] * dt;
      this.mesh.setMatrixAt(i, this.matrix.makeTranslation(p[k], p[k + 1], p[k + 2]));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    this.alive = 0;
    for (let i = 0; i < this.capacity; i++) this.mesh.setMatrixAt(i, this.hidden);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
