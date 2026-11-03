const samples={
  pistol:['p226-report-0.wav','p226-report-1.wav'],
  shotgun:['sg-report-0.wav','sg-report-1.wav'],
  nailgun:['mp5-report-0.wav'],
  step:['step-hard-0.wav','step-hard-1.wav','step-hard-2.wav']
};

export class GameAudio {
  constructor() { this.context = null; this.master = null; this.ambient = null; this.level = .45; this.buffers={}; this.loading=null; }
  async start() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain(); this.master.gain.value = this.level; this.master.connect(this.context.destination);
      const ambient = this.context.createGain(); ambient.gain.value = .025; ambient.connect(this.master); this.ambient = ambient;
      for (const frequency of [48, 72.2, 96.8]) {
        const oscillator=this.context.createOscillator(); oscillator.type='sawtooth'; oscillator.frequency.value=frequency;
        const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=145;
        oscillator.connect(filter);filter.connect(ambient);oscillator.start();
      }
      const buffer=this.context.createBuffer(1,this.context.sampleRate*.3,this.context.sampleRate);
      const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;this.noise=buffer;
      this.loading=this.loadSamples();
    }
    if(this.context.state==='suspended') await this.context.resume();
  }
  async loadSamples(){
    await Promise.all(Object.entries(samples).map(async ([type,names])=>{
      const loaded=await Promise.all(names.map(async name=>{
        try{
          const response=await fetch(`${import.meta.env.BASE_URL}audio/${name}`);
          if(!response.ok)return null;
          return await this.context.decodeAudioData(await response.arrayBuffer());
        }catch{return null;}
      }));
      this.buffers[type]=loaded.filter(Boolean);
    }));
  }
  sample(type,volume=1){
    const choices=this.buffers[type];
    if(!this.context||this.context.state!=='running'||!choices?.length)return false;
    const source=this.context.createBufferSource(),gain=this.context.createGain();
    source.buffer=choices[Math.floor(Math.random()*choices.length)];
    source.playbackRate.value=.96+Math.random()*.08;gain.gain.value=volume;
    source.connect(gain);gain.connect(this.master);source.start();return true;
  }
  setVolume(v) { this.level=Math.max(0,Math.min(1,v));if(this.master)this.master.gain.value=this.level; }
  setAmbient(on) { if(this.ambient)this.ambient.gain.setTargetAtTime(on?.025:0,this.context.currentTime,.2); }
  tone(freq=100,duration=.12,type='sawtooth',gain=.1,slide=.5) {
    if(!this.context||this.context.state!=='running')return;
    const now=this.context.currentTime, oscillator=this.context.createOscillator(), envelope=this.context.createGain();
    oscillator.type=type;oscillator.frequency.setValueAtTime(Math.max(20,freq),now);oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,freq*slide),now+duration);
    envelope.gain.setValueAtTime(.0001,now);envelope.gain.exponentialRampToValueAtTime(Math.max(.001,gain),now+.008);envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);
    oscillator.connect(envelope);envelope.connect(this.master);oscillator.start(now);oscillator.stop(now+duration+.02);
  }
  burst(duration=.1,gain=.14,lowpass=2000){
    if(!this.context||!this.noise||this.context.state!=='running')return;
    const now=this.context.currentTime,source=this.context.createBufferSource(),filter=this.context.createBiquadFilter(),envelope=this.context.createGain();
    source.buffer=this.noise;filter.type='lowpass';filter.frequency.value=lowpass;envelope.gain.setValueAtTime(gain,now);envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.connect(filter);filter.connect(envelope);envelope.connect(this.master);source.start(now);source.stop(now+duration);
  }
  play(type){
    switch(type){
      case 'pistol':if(!this.sample('pistol',.6)){this.burst(.10,.15,2300);this.tone(170,.12,'square',.08,.32);}break;
      case 'shotgun':if(!this.sample('shotgun',.75)){this.burst(.25,.24,1600);this.tone(110,.24,'sawtooth',.13,.3);}break;
      case 'nailgun':if(!this.sample('nailgun',.38)){this.burst(.045,.08,3600);this.tone(240,.05,'square',.05,.55);}break;
      case 'step':this.sample('step',.27);break;
      case 'launcher':this.burst(.18,.16,950);this.tone(110,.22,'sawtooth',.1,.5);break;
      case 'explosion':this.burst(.28,.22,800);this.tone(70,.3,'sawtooth',.16,.32);break;
      case 'fist':this.burst(.06,.06,900);this.tone(100,.08,'triangle',.08,.5);break;
      case 'hit':this.tone(550,.035,'square',.035,.65);break;
      case 'pickup':this.tone(440,.14,'triangle',.06,1.5);break;
      case 'key':this.tone(440,.3,'square',.05,1.8);break;
      case 'door':this.burst(.2,.08,500);this.tone(95,.25,'sawtooth',.06,1.2);break;
      case 'hurt':this.burst(.18,.08,900);this.tone(110,.17,'sawtooth',.09,.45);break;
      case 'enemy':this.tone(140,.18,'sawtooth',.045,.5);break;
      case 'death':this.burst(.22,.13,850);this.tone(130,.6,'sawtooth',.11,.28);break;
    }
  }
}
