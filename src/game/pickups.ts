import type * as THREE from 'three';
import type { PickupType } from '../world/level.ts';

export interface Pickup {
  id: number;
  type: PickupType;
  mesh: THREE.Object3D;
  x: number;
  z: number;
}

const PICKUP_RADIUS = 1.25;
const BASE_HEIGHT = 0.05;

export class PickupSystem {
  readonly items: Pickup[] = [];
  private readonly container: THREE.Object3D;
  private readonly createMesh: (type: PickupType) => THREE.Object3D;

  constructor(container: THREE.Object3D, createMesh: (type: PickupType) => THREE.Object3D) {
    this.container = container;
    this.createMesh = createMesh;
  }

  spawn(type: PickupType, x: number, z: number, id: number): void {
    const mesh = this.createMesh(type);
    mesh.position.set(x, BASE_HEIGHT, z);
    this.container.add(mesh);
    this.items.push({ id, type, mesh, x, z });
  }

  remove(item: Pickup): void {
    const index = this.items.indexOf(item);
    if (index >= 0) this.items.splice(index, 1);
    this.container.remove(item.mesh);
  }

  clear(): void {
    for (const item of this.items) this.container.remove(item.mesh);
    this.items.length = 0;
  }

  /** Offers every pickup in reach to `collect`; those it accepts disappear. */
  tick(playerX: number, playerZ: number, collect: (item: Pickup) => boolean): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (Math.hypot(item.x - playerX, item.z - playerZ) < PICKUP_RADIUS && collect(item))
        this.remove(item);
    }
  }

  render(time: number, dt: number): void {
    for (const item of this.items) {
      item.mesh.rotation.y += dt * 0.8;
      item.mesh.position.y = BASE_HEIGHT + Math.sin(time * 2 + item.id) * 0.12;
    }
  }
}
