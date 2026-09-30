/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Web Audio API Synthesizer for high-performance systems feedback & ambient music

class SoundManager {
  private ctx: AudioContext | null = null;
  private isSoundEnabled: boolean = true;
  private isMusicEnabled: boolean = false;
  private musicGainNode: GainNode | null = null;
  private musicOscillators: OscillatorNode[] = [];
  private musicIntervalId: number | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setSoundEnabled(enabled: boolean) {
    this.isSoundEnabled = enabled;
  }

  public getSoundEnabled(): boolean {
    return this.isSoundEnabled;
  }

  public setMusicEnabled(enabled: boolean) {
    this.isMusicEnabled = enabled;
    if (enabled) {
      this.startAmbientMusic();
    } else {
      this.stopAmbientMusic();
    }
  }

  public getMusicEnabled(): boolean {
    return this.isMusicEnabled;
  }

  // Play Cache Hit Sound (Bright pleasant chime)
  public playHit() {
    if (!this.isSoundEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // AudioContext silenced or restricted
    }
  }

  // Play Cache Miss Sound (Subtle low tone)
  public playMiss() {
    if (!this.isSoundEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
      osc.frequency.exponentialRampToValueAtTime(146.83, ctx.currentTime + 0.15); // D3

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }

  // Play Cache Put Sound (Crisp mechanical snap)
  public playPut() {
    if (!this.isSoundEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.08); // E5

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {}
  }

  // Play Cache Delete / Evict Sound (Gentle downward sweep)
  public playDelete() {
    if (!this.isSoundEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.14);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch {}
  }

  // Play Stress Test Burst Chime
  public playStressTestComplete() {
    if (!this.isSoundEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);

        gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.06);
        osc.stop(ctx.currentTime + i * 0.06 + 0.2);
      });
    } catch {}
  }

  // Ambient Systems Music (Subtle generative cybernetic drone & arpeggio)
  private startAmbientMusic() {
    this.stopAmbientMusic();
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      this.musicGainNode = ctx.createGain();
      this.musicGainNode.gain.setValueAtTime(0.035, ctx.currentTime);
      this.musicGainNode.connect(ctx.destination);

      // Deep root drone
      const droneOsc = ctx.createOscillator();
      droneOsc.type = 'sine';
      droneOsc.frequency.setValueAtTime(55, ctx.currentTime); // A1 55Hz
      droneOsc.connect(this.musicGainNode);
      droneOsc.start();
      this.musicOscillators.push(droneOsc);

      // Fifth drone
      const droneOsc2 = ctx.createOscillator();
      droneOsc2.type = 'triangle';
      droneOsc2.frequency.setValueAtTime(82.41, ctx.currentTime); // E2
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, ctx.currentTime);
      droneOsc2.connect(filter);
      filter.connect(this.musicGainNode);
      droneOsc2.start();
      this.musicOscillators.push(droneOsc2);

      // Soft cyclical arpeggio pulses (A minor pentatonic: A, C, D, E, G)
      const notes = [220, 261.63, 293.66, 329.63, 392.0];
      let step = 0;

      this.musicIntervalId = window.setInterval(() => {
        if (!this.isMusicEnabled || !this.ctx || !this.musicGainNode) return;
        try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(notes[step % notes.length], this.ctx.currentTime);

          gain.gain.setValueAtTime(0.015, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);

          osc.connect(gain);
          gain.connect(this.musicGainNode);

          osc.start();
          osc.stop(this.ctx.currentTime + 0.85);

          step = (step + 1) % notes.length;
        } catch {}
      }, 700);
    } catch {}
  }

  private stopAmbientMusic() {
    if (this.musicIntervalId !== null) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
    for (const osc of this.musicOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    }
    this.musicOscillators = [];
    if (this.musicGainNode) {
      try {
        this.musicGainNode.disconnect();
      } catch {}
      this.musicGainNode = null;
    }
  }
}

export const soundManager = new SoundManager();
