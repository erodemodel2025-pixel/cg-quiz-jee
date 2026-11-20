export type MusicMode =
  | 'home'
  | 'gameplay'
  | 'focus'
  | 'excitement'
  | 'tension'
  | 'boss'
  | 'trophy'
  | 'victory'
  | 'sad';

export type SfxName =
  | 'click'
  | 'gameStart'
  | 'coin'
  | 'correct'
  | 'wrong'
  | 'combo'
  | 'levelUp'
  | 'bossIntro'
  | 'victory'
  | 'gameOver'
  | 'drumRoll'
  | 'vineBoom'
  | 'sadTrombone'
  | 'airhorn'
  | 'bonk'
  | 'oof'
  | 'baDumTss'
  | 'wow';

export interface AudioPrefs {
  soundEnabled: boolean;
  musicEnabled: boolean;
}

const PREFS_KEY = 'cgquiz_audio_prefs';

interface TrackConfig {
  bpm: number;
  lead: number[];
  bass: number[];
  arp: number[];
  leadWave: OscillatorType;
  bassWave: OscillatorType;
  intensity: number;
  hihatRate?: 'off' | 'offbeat' | 'double';
}

function mtof(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const TRACKS: Record<MusicMode, TrackConfig> = {
  // Curious, upbeat voxel adventure theme
  home: {
    bpm: 126,
    leadWave: 'square',
    bassWave: 'sawtooth',
    intensity: 0.85,
    hihatRate: 'offbeat',
    lead: [72, 0, 76, 79, 0, 76, 74, 0, 72, 74, 76, 0, 79, 0, 84, 79],
    bass: [48, 48, 60, 48, 43, 43, 55, 43, 45, 45, 57, 45, 41, 41, 53, 43],
    arp: [60, 64, 67, 72, 55, 59, 62, 67, 57, 60, 64, 69, 53, 57, 60, 67],
  },
  // Locked-in steady arcade engineering focus
  gameplay: {
    bpm: 142,
    leadWave: 'square',
    bassWave: 'sawtooth',
    intensity: 0.95,
    hihatRate: 'offbeat',
    lead: [76, 76, 0, 79, 81, 0, 79, 76, 74, 0, 76, 79, 83, 0, 84, 79],
    bass: [45, 57, 45, 57, 41, 53, 41, 53, 43, 55, 43, 55, 48, 60, 43, 55],
    arp: [69, 72, 76, 81, 65, 69, 72, 77, 67, 71, 74, 79, 72, 76, 79, 84],
  },
  // Calm analytical concentration (Practice / Studio / Bank)
  focus: {
    bpm: 112,
    leadWave: 'triangle',
    bassWave: 'triangle',
    intensity: 0.72,
    hihatRate: 'off',
    lead: [69, 0, 72, 0, 76, 74, 72, 0, 67, 0, 71, 0, 74, 72, 69, 0],
    bass: [45, 0, 52, 0, 41, 0, 48, 0, 43, 0, 50, 0, 40, 0, 47, 0],
    arp: [57, 60, 64, 69, 53, 57, 60, 65, 55, 59, 62, 67, 52, 55, 59, 64],
  },
  // Hype high-energy streak groove (Combos >= 2)
  excitement: {
    bpm: 158,
    leadWave: 'square',
    bassWave: 'sawtooth',
    intensity: 1.08,
    hihatRate: 'double',
    lead: [79, 84, 83, 84, 88, 0, 86, 84, 79, 84, 86, 88, 91, 88, 86, 84],
    bass: [48, 60, 48, 60, 45, 57, 45, 57, 41, 53, 41, 53, 43, 55, 43, 55],
    arp: [60, 67, 72, 76, 69, 72, 76, 81, 65, 69, 72, 77, 67, 74, 79, 83],
  },
  // Urgent countdown / low-hearts suspense theme
  tension: {
    bpm: 168,
    leadWave: 'sawtooth',
    bassWave: 'square',
    intensity: 1.12,
    hihatRate: 'double',
    lead: [64, 0, 65, 64, 67, 0, 68, 67, 70, 0, 71, 70, 76, 75, 74, 71],
    bass: [40, 40, 40, 52, 41, 41, 41, 53, 43, 43, 43, 55, 42, 42, 40, 52],
    arp: [52, 55, 58, 64, 53, 56, 59, 65, 55, 58, 62, 67, 54, 58, 61, 66],
  },
  // Heavy epic boss encounter
  boss: {
    bpm: 158,
    leadWave: 'sawtooth',
    bassWave: 'square',
    intensity: 1.15,
    hihatRate: 'double',
    lead: [64, 0, 67, 68, 71, 0, 70, 68, 64, 76, 75, 74, 71, 70, 68, 67],
    bass: [40, 40, 52, 40, 41, 41, 53, 41, 43, 43, 55, 43, 42, 42, 54, 40],
    arp: [52, 55, 59, 64, 53, 56, 60, 65, 55, 59, 62, 67, 54, 58, 62, 66],
  },
  // Grand royal Trophy Room brass-chiptune hall theme
  trophy: {
    bpm: 118,
    leadWave: 'square',
    bassWave: 'triangle',
    intensity: 0.92,
    hihatRate: 'offbeat',
    lead: [72, 72, 76, 79, 0, 79, 81, 79, 77, 76, 74, 72, 74, 0, 79, 0],
    bass: [48, 0, 55, 48, 45, 0, 52, 45, 41, 0, 48, 41, 43, 55, 43, 55],
    arp: [60, 64, 67, 72, 69, 72, 76, 81, 65, 69, 72, 77, 67, 71, 74, 79],
  },
  // Triumphant celebration
  victory: {
    bpm: 136,
    leadWave: 'triangle',
    bassWave: 'square',
    intensity: 0.96,
    hihatRate: 'offbeat',
    lead: [72, 76, 79, 84, 0, 84, 83, 84, 79, 0, 76, 79, 84, 88, 86, 84],
    bass: [48, 60, 48, 60, 45, 57, 45, 57, 41, 53, 41, 53, 43, 55, 43, 55],
    arp: [60, 64, 67, 72, 69, 72, 76, 81, 65, 69, 72, 77, 67, 71, 74, 79],
  },
  // Empathetic gentle minor reflection (low score / defeat)
  sad: {
    bpm: 88,
    leadWave: 'triangle',
    bassWave: 'sine',
    intensity: 0.7,
    hihatRate: 'off',
    lead: [69, 0, 67, 0, 64, 0, 60, 0, 62, 0, 64, 60, 59, 0, 57, 0],
    bass: [45, 0, 0, 45, 41, 0, 0, 41, 43, 0, 0, 43, 40, 0, 45, 0],
    arp: [57, 60, 64, 0, 53, 57, 60, 0, 55, 59, 62, 0, 52, 55, 59, 0],
  },
};

/**
 * Web Audio API sound effects, emotion-adaptive chiptune music synthesizer,
 * drum rolls, and original synthesized meme SFX.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private prefs: AudioPrefs = { soundEnabled: true, musicEnabled: true };
  private unlocked = false;
  private mode: MusicMode = 'home';
  private step = 0;
  private nextNoteTime = 0;
  private schedulerTimer: number | null = null;
  private lastSfxTime: Partial<Record<SfxName, number>> = {};
  private listeners = new Set<(prefs: AudioPrefs) => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<AudioPrefs>;
          this.prefs = {
            soundEnabled: parsed.soundEnabled !== false,
            musicEnabled: parsed.musicEnabled !== false,
          };
        }
      } catch {
        // ignore storage errors
      }
    }
  }

  getPrefs(): AudioPrefs {
    return { ...this.prefs };
  }

  getMusicMode(): MusicMode {
    return this.mode;
  }

  isMuted(): boolean {
    return !this.prefs.soundEnabled;
  }

  subscribe(fn: (prefs: AudioPrefs) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    const snap = this.getPrefs();
    for (const fn of this.listeners) fn(snap);
  }

  private savePrefs(): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch {
      // ignore
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.createNoiseBuffer();
      this.syncGains();
    }
    return this.ctx;
  }

  private createNoiseBuffer(): void {
    if (!this.ctx) return;
    const length = this.ctx.sampleRate * 0.8;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  private syncGains(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.prefs.soundEnabled ? 0.56 : 0.0001, now, 0.02);
    this.musicGain.gain.setTargetAtTime(
      this.prefs.soundEnabled && this.prefs.musicEnabled ? 0.22 : 0.0001,
      now,
      0.04
    );
    this.sfxGain.gain.setTargetAtTime(this.prefs.soundEnabled ? 0.7 : 0.0001, now, 0.02);
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    if (!this.unlocked) {
      this.unlocked = true;
      this.syncGains();
      if (this.prefs.soundEnabled && this.prefs.musicEnabled) {
        this.startMusicLoop();
      }
    }
  }

  toggleSound(): boolean {
    const next = !this.prefs.soundEnabled;
    this.prefs.soundEnabled = next;
    if (next) {
      this.prefs.musicEnabled = true;
      this.unlock();
      this.startMusicLoop();
    } else {
      this.stopMusicLoop();
    }
    this.syncGains();
    this.savePrefs();
    this.emit();
    return next;
  }

  toggleMusic(): boolean {
    this.prefs.musicEnabled = !this.prefs.musicEnabled;
    if (this.prefs.soundEnabled && this.prefs.musicEnabled) {
      this.unlock();
      this.startMusicLoop();
    } else {
      this.stopMusicLoop();
    }
    this.syncGains();
    this.savePrefs();
    this.emit();
    return this.prefs.musicEnabled;
  }

  setMusicMode(nextMode: MusicMode): void {
    if (this.mode === nextMode) return;
    this.mode = nextMode;
    this.step = 0;
  }

  private startMusicLoop(): void {
    if (this.schedulerTimer !== null || !this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.schedulerTimer = window.setInterval(() => this.scheduleAhead(), 35);
  }

  private stopMusicLoop(): void {
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private scheduleAhead(): void {
    if (!this.ctx || !this.prefs.soundEnabled || !this.prefs.musicEnabled || !this.unlocked) return;
    while (this.nextNoteTime < this.ctx.currentTime + 0.14) {
      this.scheduleStep(this.step, this.nextNoteTime);
      const track = TRACKS[this.mode] || TRACKS.home;
      const sixteenthSec = 60 / track.bpm / 4;
      this.nextNoteTime += sixteenthSec;
      this.step = (this.step + 1) % 16;
    }
  }

  private scheduleStep(stepIndex: number, time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const track = TRACKS[this.mode] || TRACKS.home;
    const stepDur = 60 / track.bpm / 4;

    const leadNote = track.lead[stepIndex];
    if (leadNote > 0) {
      this.scheduleTone(
        mtof(leadNote),
        time,
        stepDur * 0.85,
        track.leadWave,
        0.14 * track.intensity,
        this.musicGain
      );
    }

    const bassNote = track.bass[stepIndex];
    if (bassNote > 0) {
      this.scheduleTone(
        mtof(bassNote),
        time,
        stepDur * 0.8,
        track.bassWave,
        0.18 * track.intensity,
        this.musicGain,
        550
      );
    }

    const arpNote = track.arp[stepIndex];
    if (arpNote > 0) {
      this.scheduleTone(
        mtof(arpNote),
        time,
        stepDur * 0.48,
        'triangle',
        0.065 * track.intensity,
        this.musicGain
      );
    }

    if (this.mode !== 'sad' && stepIndex % 4 === 0) {
      this.scheduleKick(time, this.musicGain);
    }
    if (this.mode !== 'sad' && (stepIndex === 4 || stepIndex === 12)) {
      this.scheduleNoiseHit(time, 0.085, 1800, 0.11, this.musicGain);
    } else if (track.hihatRate === 'double' || (track.hihatRate === 'offbeat' && stepIndex % 2 === 1)) {
      this.scheduleNoiseHit(time, 0.032, 6500, 0.05, this.musicGain);
    }
  }

  private scheduleTone(
    freq: number,
    time: number,
    dur: number,
    wave: OscillatorType,
    vol: number,
    dest: AudioNode,
    lowpassFreq?: number
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    if (lowpassFreq) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(lowpassFreq, time);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private schedulePitchSlideTone(
    startFreq: number,
    endFreq: number,
    time: number,
    dur: number,
    wave: OscillatorType,
    vol: number,
    dest: AudioNode,
    lowpassFreq?: number
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), time + dur);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    if (lowpassFreq) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(lowpassFreq, time);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private scheduleKick(time: number, dest: AudioNode, strength = 0.32): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);

    gain.gain.setValueAtTime(strength, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  private scheduleNoiseHit(
    time: number,
    dur: number,
    highpassFreq: number,
    vol: number,
    dest: AudioNode
  ): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(highpassFreq, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(time);
    src.stop(time + dur + 0.01);
  }

  private scheduleSnare(time: number, vol: number, dest: AudioNode): void {
    if (!this.ctx) return;
    this.scheduleNoiseHit(time, 0.07, 1400, vol, dest);
    this.schedulePitchSlideTone(210, 125, time, 0.055, 'triangle', vol * 0.7, dest);
  }

  // Semantic game-event & meme sound helpers
  playClick(): void {
    this.playSfx('click');
  }

  playGameStart(): void {
    this.playSfx('gameStart');
  }

  playCoin(): void {
    this.playSfx('coin');
  }

  playCorrect(): void {
    this.playSfx('correct');
  }

  playWrong(): void {
    this.playSfx('wrong');
  }

  playCombo(streak = 3): void {
    this.playSfx('combo', streak);
  }

  playLevelUp(): void {
    this.playSfx('levelUp');
  }

  playBossIntro(): void {
    this.playSfx('bossIntro');
  }

  playVictory(): void {
    this.playSfx('victory');
  }

  playGameOver(): void {
    this.playSfx('gameOver');
  }

  playDrumRoll(): void {
    this.playSfx('drumRoll');
  }

  playSfx(name: SfxName, comboLevel = 1): void {
    if (!this.prefs.soundEnabled) return;
    this.unlock();
    if (!this.ctx || !this.sfxGain) return;

    const nowMs = performance.now();
    const minCooldown = name === 'click' ? 45 : 70;
    if (nowMs - (this.lastSfxTime[name] ?? 0) < minCooldown) return;
    this.lastSfxTime[name] = nowMs;

    const t = this.ctx.currentTime + 0.005;
    const dest = this.sfxGain;

    switch (name) {
      case 'click': {
        this.scheduleTone(680, t, 0.035, 'square', 0.18, dest);
        this.scheduleTone(1020, t + 0.02, 0.035, 'square', 0.14, dest);
        break;
      }
      case 'gameStart': {
        const notes = [330, 440, 554, 659, 880];
        notes.forEach((f, idx) =>
          this.scheduleTone(f, t + idx * 0.065, 0.09, 'square', 0.22, dest)
        );
        this.scheduleTone(1175, t + 0.34, 0.18, 'triangle', 0.28, dest);
        break;
      }
      case 'coin': {
        this.scheduleTone(987.77, t, 0.07, 'square', 0.22, dest);
        this.scheduleTone(1318.51, t + 0.07, 0.22, 'square', 0.24, dest);
        break;
      }
      case 'correct': {
        this.scheduleTone(523.25, t, 0.08, 'square', 0.22, dest);
        this.scheduleTone(659.25, t + 0.07, 0.08, 'square', 0.22, dest);
        this.scheduleTone(783.99, t + 0.14, 0.16, 'triangle', 0.26, dest);
        break;
      }
      case 'wrong': {
        this.scheduleTone(240, t, 0.14, 'sawtooth', 0.24, dest, 900);
        this.scheduleTone(175, t + 0.12, 0.22, 'sawtooth', 0.25, dest, 700);
        break;
      }
      case 'combo': {
        const shift = Math.min(6, Math.max(0, comboLevel - 2)) * 45;
        [587 + shift, 740 + shift, 880 + shift, 1174 + shift].forEach((f, i) =>
          this.scheduleTone(f, t + i * 0.055, 0.09, 'square', 0.22, dest)
        );
        break;
      }
      case 'levelUp': {
        [523, 659, 784, 1046, 1318, 1568].forEach((f, i) =>
          this.scheduleTone(f, t + i * 0.075, 0.14, 'square', 0.24, dest)
        );
        break;
      }
      case 'bossIntro': {
        this.scheduleTone(440, t, 0.18, 'sawtooth', 0.25, dest, 1400);
        this.scheduleTone(311, t + 0.18, 0.18, 'sawtooth', 0.25, dest, 1200);
        this.scheduleTone(220, t + 0.36, 0.35, 'square', 0.3, dest, 1000);
        this.scheduleKick(t + 0.36, dest);
        break;
      }
      case 'victory': {
        const melody = [523, 659, 784, 1046, 784, 1046, 1318];
        melody.forEach((f, i) =>
          this.scheduleTone(
            f,
            t + i * 0.09,
            i === melody.length - 1 ? 0.35 : 0.11,
            'square',
            0.24,
            dest
          )
        );
        break;
      }
      case 'gameOver': {
        [392, 370, 349, 311].forEach((f, i) =>
          this.scheduleTone(
            f,
            t + i * 0.19,
            i === 3 ? 0.45 : 0.18,
            'sawtooth',
            0.22,
            dest,
            1100
          )
        );
        break;
      }
      case 'drumRoll': {
        // Accelerating snare roll over ~0.95s ending in a crash cymbal + kick hit
        let offset = 0;
        let stepGap = 0.088;
        let idx = 0;
        while (offset < 0.88) {
          const progress = offset / 0.88;
          const vol = 0.11 + progress * 0.22;
          this.scheduleSnare(t + offset, vol, dest);
          offset += stepGap;
          stepGap = Math.max(0.032, stepGap * 0.91);
          idx++;
          if (idx > 24) break;
        }
        // Final cymbal crash + low impact
        this.scheduleKick(t + 0.92, dest, 0.44);
        this.scheduleNoiseHit(t + 0.92, 0.48, 3200, 0.28, dest);
        this.scheduleTone(523.25, t + 0.92, 0.24, 'triangle', 0.2, dest);
        break;
      }
      case 'vineBoom': {
        // Deep dramatic sub-bass impact thud
        this.schedulePitchSlideTone(125, 34, t, 0.48, 'sine', 0.62, dest);
        this.schedulePitchSlideTone(95, 28, t, 0.42, 'triangle', 0.38, dest, 280);
        this.scheduleNoiseHit(t, 0.22, 60, 0.22, dest);
        break;
      }
      case 'sadTrombone': {
        // Classic comedic "wah-wah-wah-waaaah" downward brass slide
        const notes = [
          { f1: 311.13, f2: 298, start: 0, dur: 0.24 },
          { f1: 293.66, f2: 280, start: 0.27, dur: 0.24 },
          { f1: 277.18, f2: 264, start: 0.54, dur: 0.24 },
          { f1: 261.63, f2: 196, start: 0.81, dur: 0.68 },
        ];
        for (const n of notes) {
          this.schedulePitchSlideTone(n.f1, n.f2, t + n.start, n.dur, 'sawtooth', 0.24, dest, 1150);
          this.schedulePitchSlideTone(n.f1 * 0.996, n.f2 * 0.996, t + n.start, n.dur, 'triangle', 0.14, dest, 950);
        }
        break;
      }
      case 'airhorn': {
        // Triple MLG-style stacked brassy synth horn blast
        const taps = [
          { s: 0, d: 0.14 },
          { s: 0.17, d: 0.14 },
          { s: 0.34, d: 0.42 },
        ];
        const freqs = [466.16, 471.5, 587.33, 698.46];
        for (const tap of taps) {
          for (const f of freqs) {
            this.scheduleTone(f, t + tap.s, tap.d, 'sawtooth', 0.11, dest, 2400);
          }
        }
        break;
      }
      case 'bonk': {
        // Comedic hollow wooden/cartoon pitch drop bonk
        this.schedulePitchSlideTone(540, 145, t, 0.15, 'sine', 0.45, dest);
        this.schedulePitchSlideTone(720, 190, t, 0.11, 'triangle', 0.24, dest, 1400);
        break;
      }
      case 'oof': {
        // Retro blocky descending oof
        this.schedulePitchSlideTone(360, 130, t, 0.22, 'square', 0.26, dest, 1100);
        this.schedulePitchSlideTone(240, 95, t + 0.04, 0.22, 'triangle', 0.24, dest, 800);
        break;
      }
      case 'baDumTss': {
        // Kick -> Snare -> Hi-hat/Crash comedic joke sting
        this.scheduleKick(t, dest, 0.36);
        this.scheduleSnare(t + 0.14, 0.26, dest);
        this.scheduleNoiseHit(t + 0.3, 0.38, 4200, 0.24, dest);
        break;
      }
      case 'wow': {
        // Sparkling upward anime/arcade chime glissando
        const chimes = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51];
        chimes.forEach((f, idx) =>
          this.scheduleTone(f, t + idx * 0.05, 0.24, 'triangle', 0.2, dest)
        );
        this.scheduleTone(1567.98, t + 0.31, 0.36, 'sine', 0.24, dest);
        break;
      }
    }
  }
}

export const soundManager = new SoundManager();
