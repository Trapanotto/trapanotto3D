export type SoundId =
  | 'fist'
  | 'pistol'
  | 'shotgun'
  | 'nailgun'
  | 'launcher'
  | 'explosion'
  | 'step'
  | 'hit'
  | 'pickup'
  | 'key'
  | 'door'
  | 'hurt'
  | 'enemy'
  | 'death'
  | 'alert'
  | 'charge'
  | 'headshot';

/** What gameplay code needs from audio. Tests pass a silent stand-in. */
export interface SoundPlayer {
  play(id: SoundId): void;
}

type SampleSet = 'pistol' | 'shotgun' | 'nailgun' | 'step';

const SAMPLES: Record<SampleSet, string[]> = {
  pistol: ['p226-report-0.wav', 'p226-report-1.wav'],
  shotgun: ['sg-report-0.wav', 'sg-report-1.wav'],
  nailgun: ['mp5-report-0.wav'],
  step: ['step-hard-0.wav', 'step-hard-1.wav', 'step-hard-2.wav'],
};

const AMBIENT_LEVEL = 0.025;

export class GameAudio implements SoundPlayer {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private buffers: Partial<Record<SampleSet, AudioBuffer[]>> = {};
  private level = 0.45;

  async start(): Promise<void> {
    if (!this.context) {
      const Context =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      const context = new Context();
      this.context = context;
      this.master = context.createGain();
      this.master.gain.value = this.level;
      this.master.connect(context.destination);
      this.ambient = context.createGain();
      this.ambient.gain.value = AMBIENT_LEVEL;
      this.ambient.connect(this.master);
      // Low mains hum of the plant.
      for (const frequency of [48, 72.2, 96.8]) {
        const oscillator = context.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = frequency;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 145;
        oscillator.connect(filter);
        filter.connect(this.ambient);
        oscillator.start();
      }
      this.noise = context.createBuffer(1, context.sampleRate * 0.3, context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      void this.loadSamples();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  setVolume(volume: number): void {
    this.level = Math.max(0, Math.min(1, volume));
    if (this.master) this.master.gain.value = this.level;
  }

  setAmbient(on: boolean): void {
    if (this.ambient && this.context)
      this.ambient.gain.setTargetAtTime(on ? AMBIENT_LEVEL : 0, this.context.currentTime, 0.2);
  }

  play(id: SoundId): void {
    switch (id) {
      case 'pistol':
        if (!this.sample('pistol', 0.6)) {
          this.burst(0.1, 0.15, 2300);
          this.tone(170, 0.12, 'square', 0.08, 0.32);
        }
        break;
      case 'shotgun':
        if (!this.sample('shotgun', 0.75)) {
          this.burst(0.25, 0.24, 1600);
          this.tone(110, 0.24, 'sawtooth', 0.13, 0.3);
        }
        break;
      case 'nailgun':
        if (!this.sample('nailgun', 0.38)) {
          this.burst(0.045, 0.08, 3600);
          this.tone(240, 0.05, 'square', 0.05, 0.55);
        }
        break;
      case 'step':
        this.sample('step', 0.27);
        break;
      case 'launcher':
        this.burst(0.18, 0.16, 950);
        this.tone(110, 0.22, 'sawtooth', 0.1, 0.5);
        break;
      case 'explosion':
        this.burst(0.28, 0.22, 800);
        this.tone(70, 0.3, 'sawtooth', 0.16, 0.32);
        break;
      case 'fist':
        this.burst(0.06, 0.06, 900);
        this.tone(100, 0.08, 'triangle', 0.08, 0.5);
        break;
      case 'hit':
        this.tone(550, 0.035, 'square', 0.035, 0.65);
        break;
      case 'pickup':
        this.tone(440, 0.14, 'triangle', 0.06, 1.5);
        break;
      case 'key':
        this.tone(440, 0.3, 'square', 0.05, 1.8);
        break;
      case 'door':
        this.burst(0.2, 0.08, 500);
        this.tone(95, 0.25, 'sawtooth', 0.06, 1.2);
        break;
      case 'hurt':
        this.burst(0.18, 0.08, 900);
        this.tone(110, 0.17, 'sawtooth', 0.09, 0.45);
        break;
      case 'enemy':
        this.tone(140, 0.18, 'sawtooth', 0.045, 0.5);
        break;
      case 'alert':
        this.burst(0.12, 0.05, 1400);
        this.tone(260, 0.22, 'square', 0.04, 0.62);
        break;
      case 'charge':
        this.tone(150, 0.32, 'sawtooth', 0.045, 2.4);
        break;
      case 'headshot':
        this.tone(880, 0.06, 'square', 0.05, 0.7);
        this.burst(0.05, 0.06, 4200);
        break;
      case 'death':
        this.burst(0.22, 0.13, 850);
        this.tone(130, 0.6, 'sawtooth', 0.11, 0.28);
        break;
    }
  }

  private running(): AudioContext | null {
    return this.context?.state === 'running' ? this.context : null;
  }

  private async loadSamples(): Promise<void> {
    const context = this.context;
    if (!context) return;
    await Promise.all(
      (Object.entries(SAMPLES) as [SampleSet, string[]][]).map(async ([set, names]) => {
        const loaded = await Promise.all(
          names.map(async (name) => {
            try {
              const response = await fetch(`${import.meta.env.BASE_URL}audio/${name}`);
              if (!response.ok) return null;
              return await context.decodeAudioData(await response.arrayBuffer());
            } catch {
              return null;
            }
          }),
        );
        this.buffers[set] = loaded.filter((buffer): buffer is AudioBuffer => buffer !== null);
      }),
    );
  }

  private sample(set: SampleSet, volume: number): boolean {
    const context = this.running();
    const choices = this.buffers[set];
    if (!context || !this.master || !choices?.length) return false;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = choices[Math.floor(Math.random() * choices.length)];
    source.playbackRate.value = 0.96 + Math.random() * 0.08;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.master);
    source.start();
    return true;
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain: number, slide: number) {
    const context = this.running();
    if (!context || !this.master) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, freq), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private burst(duration: number, gain: number, lowpass: number) {
    const context = this.running();
    if (!context || !this.master || !this.noise) return;
    const now = context.currentTime;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    source.start(now);
    source.stop(now + duration);
  }
}
