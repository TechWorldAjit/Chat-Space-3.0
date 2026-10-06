// Web Audio API Sound Synthesizer for Voice & Video Calls
// Eliminates external MP3 dependencies and works reliably across all browsers

class CallSoundEffects {
  constructor() {
    this.audioCtx = null;
    this.activeNodes = [];
    this.ringInterval = null;
  }

  getAudioContext() {
    if (!this.audioCtx || this.audioCtx.state === "closed") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  stopAllSounds() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }

    this.activeNodes.forEach((node) => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch {
        // Ignore already stopped nodes
      }
    });
    this.activeNodes = [];
  }

  // Incoming Call Ringtone: Melodic electronic chime sequence
  playRingtone() {
    this.stopAllSounds();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const playChimeBurst = () => {
      try {
        const now = ctx.currentTime;
        const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6 chord
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          gain.gain.setValueAtTime(0, now + idx * 0.12);
          gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.12 + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.45);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.5);

          this.activeNodes.push(osc, gain);
        });
      } catch (err) {
        console.warn("Could not play ringtone chime:", err);
      }
    };

    playChimeBurst();
    this.ringInterval = setInterval(playChimeBurst, 2400);
  }

  // Outgoing Calling Ringback: Realistic telecom ringback pulse
  playCallingTone() {
    this.stopAllSounds();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const playRingback = () => {
      try {
        const now = ctx.currentTime;
        const freqs = [440, 480]; // Dual-tone 440Hz + 480Hz
        freqs.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
          gain.gain.setValueAtTime(0.08, now + 1.2);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 1.5);

          this.activeNodes.push(osc, gain);
        });
      } catch (err) {
        console.warn("Could not play calling tone:", err);
      }
    };

    playRingback();
    this.ringInterval = setInterval(playRingback, 3500);
  }

  // Call Connected: Crisp ascending notification chime
  playConnectTone() {
    this.stopAllSounds();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [440, 659.25, 880]; // A4, E5, A5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.3);
      });
    } catch {
      // Ignore
    }
  }

  // Call Ended: Gentle descending tone
  playEndTone() {
    this.stopAllSounds();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [520, 390, 260];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.25);
      });
    } catch {
      // Ignore
    }
  }
}

export const callSounds = new CallSoundEffects();
