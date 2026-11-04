import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GRADE, LIGHTING } from '../config/tuning.ts';
import type { Quality } from '../settings.ts';

const FOG_COLOR = 0x0a0f11;

/** Split-toning grade in display space: cool shadows, warm highlights. */
const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    shadowTint: { value: new THREE.Vector3() },
    highlightTint: { value: new THREE.Vector3() },
    contrast: { value: 1 },
    saturation: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 shadowTint;
    uniform vec3 highlightTint;
    uniform float contrast;
    uniform float saturation;
    varying vec2 vUv;
    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 colour = source.rgb;
      colour *= mix(shadowTint, highlightTint, smoothstep(0.04, 0.6, dot(colour, LUMA)));
      colour = (colour - 0.5) * contrast + 0.5;
      colour = mix(vec3(dot(colour, LUMA)), colour, saturation);
      gl_FragColor = vec4(clamp(colour, 0.0, 1.0), source.a);
    }`,
};

/**
 * Renderer, camera, post-processing and the lights that travel with the player.
 * World lights (ceiling lamps) belong to the world builder.
 */
export class RenderPipeline {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly torch: THREE.SpotLight;
  readonly muzzleLight: THREE.PointLight;
  readonly hemisphere: THREE.HemisphereLight;
  readonly ambient: THREE.AmbientLight;
  private readonly composer: EffectComposer;
  private readonly occlusion: SSAOPass;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;

  constructor(viewport: HTMLElement, fov: number, quality: Quality) {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    viewport.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene.background = new THREE.Color(FOG_COLOR);
    this.scene.fog = new THREE.FogExp2(FOG_COLOR, LIGHTING.fogDensity);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.hemisphere = new THREE.HemisphereLight(0xb9c9d6, 0x3d3026, 1);
    this.ambient = new THREE.AmbientLight(0xc4cebe, 1);
    this.scene.add(this.hemisphere, this.ambient);

    this.camera = new THREE.PerspectiveCamera(fov, innerWidth / innerHeight, 0.08, 130);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // Carried at the left shoulder: away from the weapon (which it would overexpose) and
    // offset from the eyes, so the shadows it casts are visible from the player's view.
    this.torch = new THREE.SpotLight(0xdce6f0, 1, 34, 0.6, 0.75, 1.6);
    this.torch.position.set(-0.3, -0.12, 0.05);
    this.torch.target.position.set(-0.05, -0.3, -5);
    this.torch.castShadow = true;
    this.torch.shadow.mapSize.set(1024, 1024);
    this.torch.shadow.camera.near = 0.3;
    this.torch.shadow.camera.far = 34;
    this.torch.shadow.bias = -0.0004;
    this.torch.shadow.normalBias = 0.03;
    this.camera.add(this.torch, this.torch.target);

    const handsLight = new THREE.PointLight(0xe3e3cf, 0.45, 3, 2);
    handsLight.position.set(0.35, 0.1, 0.15);
    this.muzzleLight = new THREE.PointLight(0xffa34d, 0, 12, 2);
    this.muzzleLight.position.set(0.35, -0.3, -1);
    this.camera.add(handsLight, this.muzzleLight);

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.occlusion = new SSAOPass(this.scene, this.camera, innerWidth, innerHeight, 12);
    this.occlusion.kernelRadius = 5;
    this.occlusion.minDistance = 0.003;
    this.occlusion.maxDistance = 0.12;
    this.composer.addPass(this.occlusion);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.35, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.applyLighting();
    this.setQuality(quality);
    window.addEventListener('resize', () => this.resize());
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Re-reads LIGHTING and GRADE. The debug panel calls this after every change. */
  applyLighting(): void {
    this.renderer.toneMappingExposure = LIGHTING.exposure;
    this.hemisphere.intensity = LIGHTING.hemisphere;
    this.ambient.intensity = LIGHTING.ambient;
    this.scene.environmentIntensity = LIGHTING.environment;
    this.torch.intensity = LIGHTING.torchIntensity;
    (this.scene.fog as THREE.FogExp2).density = LIGHTING.fogDensity;
    this.bloom.strength = LIGHTING.bloomStrength;
    const uniforms = this.grade.uniforms;
    uniforms.shadowTint.value.fromArray(GRADE.shadowTint);
    uniforms.highlightTint.value.fromArray(GRADE.highlightTint);
    uniforms.contrast.value = GRADE.contrast;
    uniforms.saturation.value = GRADE.saturation;
  }

  setQuality(quality: Quality): void {
    const high = quality !== 'performance';
    this.occlusion.enabled = high;
    this.bloom.enabled = high;
    if (this.torch.castShadow !== high) {
      this.torch.castShadow = high;
      // Shadow casting is compiled into the shaders.
      this.scene.traverse((node) => {
        if (node instanceof THREE.Mesh)
          for (const material of [node.material].flat()) material.needsUpdate = true;
      });
    }
  }

  setFov(fov: number): void {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
  }

  render(): void {
    this.composer.render();
  }
}
