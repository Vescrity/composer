import { MidiData, MidiEvent, TrackConfig, TrackType } from './types';

class RetroSynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private trackGains: Record<TrackType, GainNode | null> = {
    lead: null,
    sub: null,
    arp: null,
    bass: null,
    kick: null,
    snare: null,
    hihat: null
  };

  private trackWaveforms: Record<TrackType, string> = {
    lead: 'square',
    sub: 'square',
    arp: 'triangle',
    bass: 'triangle',
    kick: 'kick_synth',
    snare: 'snare_synth',
    hihat: 'noise'
  };

  private noiseBuffer: AudioBuffer | null = null;
  private activeSources: { node: AudioNode; stopTime: number }[] = [];
  
  // Playback tracking
  private isPlaying: boolean = false;
  private startTime: number = 0; // audioContext.currentTime when playback started
  private pauseTimeOffset: number = 0; // in beats, in case we want to support pause/resume
  private playLengthBeats: number = 0;
  private bpm: number = 120;
  private activeBpm: number = 120;
  private loop: boolean = true;
  private midiData: MidiData | null = null;
  private onTimeUpdate: (bar: number, beat: number, progress: number) => void = () => {};
  private onPlaybackEnd: () => void = () => {};
  private animationFrameId: number | null = null;

  constructor() {
    // Lazy initialize on first interaction
  }

  private initAudio() {
    if (this.ctx) return;
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Create master structural gain node
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime); // default comfortable volume
    this.masterGain.connect(this.ctx.destination);

    // Create a gain node for each track
    const tracks: TrackType[] = ['lead', 'sub', 'arp', 'bass', 'kick', 'snare', 'hihat'];
    tracks.forEach((track) => {
      if (!this.ctx || !this.masterGain) return;
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0.7, this.ctx.currentTime); // default track gain ratio
      gainNode.connect(this.masterGain);
      this.trackGains[track] = gainNode;
    });

    // Warm up noise buffer
    this.getNoiseBuffer();
  }

  private getNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error("AudioContext not initialized");
    if (this.noiseBuffer) return this.noiseBuffer;

    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  // Update real-time faders, mutes, and solos
  public updateTrackGain(track: TrackType, config: TrackConfig, isSoloActive: boolean) {
    this.initAudio();
    this.trackWaveforms[track] = config.waveform;
    const gainNode = this.trackGains[track];
    if (!gainNode || !this.ctx) return;

    let targetVolume = config.volume;
    if (config.muted) {
      targetVolume = 0;
    } else if (isSoloActive && !config.soloed) {
      targetVolume = 0;
    }

    // Smoothly transition volume to avoid popping clicks
    gainNode.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.015);
  }

  public updateMasterVolume(volume: number) {
    this.initAudio();
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.015);
  }

  public setBpm(newBpm: number) {
    this.bpm = newBpm;
  }

  // Helper synth methods for different channels
  private playLeadTone(note: number, velocity: number, startTime: number, duration: number) {
    if (!this.ctx) return;
    const gainNode = this.trackGains['lead'];
    if (!gainNode) return;

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    const userWave = this.trackWaveforms['lead'];
    osc.type = (['sine', 'square', 'sawtooth', 'triangle'].includes(userWave) ? userWave : 'square') as OscillatorType;
    osc.frequency.setValueAtTime(this.midiNoteToFreq(note), startTime);

    // NES envelope ADSR (Attack: fast transient, Decay: slow fade, Sustain: 60%, Release: decay)
    const velRatio = velocity / 127;
    const peakGain = 0.3 * velRatio;
    
    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01); // Quick attack
    noteGain.gain.exponentialRampToValueAtTime(peakGain * 0.5, startTime + 0.1); // Decay to sustain
    noteGain.gain.setValueAtTime(peakGain * 0.5, startTime + duration - 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration); // Release

    osc.connect(noteGain);
    noteGain.connect(gainNode);

    osc.start(startTime);
    osc.stop(startTime + duration);

    this.activeSources.push({ node: osc, stopTime: startTime + duration });
  }

  private playSubTone(note: number, velocity: number, startTime: number, duration: number) {
    if (!this.ctx) return;
    const gainNode = this.trackGains['sub'];
    if (!gainNode) return;

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    const userWave = this.trackWaveforms['sub'];
    osc.type = (['sine', 'square', 'sawtooth', 'triangle'].includes(userWave) ? userWave : 'square') as OscillatorType;
    osc.frequency.setValueAtTime(this.midiNoteToFreq(note), startTime);

    const velRatio = velocity / 127;
    const peakGain = 0.22 * velRatio;

    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
    noteGain.gain.exponentialRampToValueAtTime(peakGain * 0.65, startTime + 0.12);
    noteGain.gain.setValueAtTime(peakGain * 0.65, startTime + duration - 0.03);
    noteGain.gain.linearRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(noteGain);
    noteGain.connect(gainNode);

    osc.start(startTime);
    osc.stop(startTime + duration);

    this.activeSources.push({ node: osc, stopTime: startTime + duration });
  }

  private playArpTone(note: number, velocity: number, startTime: number, duration: number) {
    if (!this.ctx) return;
    const gainNode = this.trackGains['arp'];
    if (!gainNode) return;

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    const userWave = this.trackWaveforms['arp'];
    const isTriangle = userWave === 'triangle';
    osc.type = (['sine', 'square', 'sawtooth', 'triangle'].includes(userWave) ? userWave : 'triangle') as OscillatorType;
    osc.frequency.setValueAtTime(this.midiNoteToFreq(note), startTime);

    const velRatio = velocity / 127;
    // Boost triangle-based Arp tone gain since triangle naturally has less RMS power
    const peakGain = (isTriangle ? 0.65 : 0.38) * velRatio;

    // Direct bouncy pluck decay envelope with a minimum decay window so it sounds incredibly crisp and clean
    const noteDecay = Math.max(0.18, duration);

    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(peakGain, startTime + 0.005);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDecay); // Pluck decay

    osc.connect(noteGain);
    noteGain.connect(gainNode);

    osc.start(startTime);
    osc.stop(startTime + noteDecay + 0.01);

    this.activeSources.push({ node: osc, stopTime: startTime + noteDecay + 0.01 });
  }

  private playBassTone(note: number, velocity: number, startTime: number, duration: number) {
    if (!this.ctx) return;
    const gainNode = this.trackGains['bass'];
    if (!gainNode) return;

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    const userWave = this.trackWaveforms['bass'];
    osc.type = (['sine', 'square', 'sawtooth', 'triangle'].includes(userWave) ? userWave : 'triangle') as OscillatorType;
    osc.frequency.setValueAtTime(this.midiNoteToFreq(note), startTime);

    const velRatio = velocity / 127;
    const peakGain = 0.45 * velRatio;

    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    noteGain.gain.setValueAtTime(peakGain, startTime + duration - 0.03);
    noteGain.gain.linearRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(noteGain);
    noteGain.connect(gainNode);

    osc.start(startTime);
    osc.stop(startTime + duration);

    this.activeSources.push({ node: osc, stopTime: startTime + duration });
  }

  private playKickSynth(startTime: number, duration: number) {
    if (!this.ctx) return;
    const gainNode = this.trackGains['kick'];
    if (!gainNode) return;

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    osc.type = 'sine';
    
    // Kick decay must be independent of the short symbolic midi step length
    const kickDecay = 0.16; // 160ms of punchy decay
    
    // Rapid pitch drop to produce 8-bit synth thud (150Hz -> 40Hz)
    osc.frequency.setValueAtTime(150, startTime);
    osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.08); // Pitch sweep in 80ms

    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(0.85, startTime + 0.003); // Instant transient click punch
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + kickDecay);

    osc.connect(noteGain);
    noteGain.connect(gainNode);

    osc.start(startTime);
    osc.stop(startTime + kickDecay + 0.01);

    this.activeSources.push({ node: osc, stopTime: startTime + kickDecay + 0.01 });
  }

  private playSnareSynth(startTime: number, duration: number) {
    if (!this.ctx) return;
    const gainNode = this.trackGains['snare'];
    if (!gainNode) return;

    // Classic NES Snare uses filtered White Noise with a fast decay
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.getNoiseBuffer();

    const snareDecay = 0.18; // 180ms is perfect for snare decay

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, startTime);
    filter.Q.setValueAtTime(2.0, startTime);

    const noteGain = this.ctx.createGain();
    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(0.65, startTime + 0.005); // Boosted peak gain
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + snareDecay);

    noiseSource.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(gainNode);

    noiseSource.start(startTime);
    noiseSource.stop(startTime + snareDecay + 0.01);

    this.activeSources.push({ node: noiseSource, stopTime: startTime + snareDecay + 0.01 });
  }

  private playHihatSynth(startTime: number, duration: number) {
    if (!this.ctx) return;
    const gainNode = this.trackGains['hihat'];
    if (!gainNode) return;

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.getNoiseBuffer();

    const hihatDecay = 0.06; // 60ms decay gives a sweet crisp click

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, startTime);

    const noteGain = this.ctx.createGain();
    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(0.35, startTime + 0.002); // Crisp click
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + hihatDecay);

    noiseSource.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(gainNode);

    noiseSource.start(startTime);
    noiseSource.stop(startTime + hihatDecay + 0.01);

    this.activeSources.push({ node: noiseSource, stopTime: startTime + hihatDecay + 0.01 });
  }

  private midiNoteToFreq(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  // Master sequencer controller
  public play(
    midiData: MidiData, 
    bpm: number, 
    loop: boolean,
    onTimeUpdate: (bar: number, beat: number, progress: number) => void,
    onPlaybackEnd: () => void
  ) {
    this.initAudio();
    this.stop(); // Stop any pending schedules

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.midiData = midiData;
    this.bpm = bpm;
    this.activeBpm = bpm;
    this.loop = loop;
    this.onTimeUpdate = onTimeUpdate;
    this.onPlaybackEnd = onPlaybackEnd;
    this.isPlaying = true;

    // Find the max bar to know full playback length
    let maxBar = 1;
    const tracks: (keyof MidiData)[] = ['lead', 'sub', 'arp', 'bass', 'kick', 'snare', 'hihat'];
    tracks.forEach((track) => {
      midiData[track].forEach((ev) => {
        if (ev.bar > maxBar) maxBar = ev.bar;
      });
    });

    // We assume the song length rounds up to a multiple of 8 or is defined by maxBar
    const totalBars = maxBar;
    this.playLengthBeats = totalBars * 4;
    
    this.startTime = this.ctx ? this.ctx.currentTime : 0;
    
    this.scheduleAllNotes(totalBars);
    this.startProgressTracker();
  }

  private scheduleAllNotes(totalBars: number) {
    if (!this.ctx || !this.midiData) return;

    const beatDuration = 60 / this.activeBpm;
    const tracks: (keyof MidiData)[] = ['lead', 'sub', 'arp', 'bass', 'kick', 'snare', 'hihat'];
    
    // We can schedule multiple loops ahead of time if loop is on,
    // or just schedule one iteration and re-schedule or loop.
    // To make it incredibly robust, we list-compile and schedule the first loop.
    const scheduleIteration = (loopOffsetSecs: number) => {
      if (!this.ctx) return;

      tracks.forEach((track) => {
        this.midiData![track].forEach((ev) => {
          // Calculate exact chronological global beat offset in song (0-indexed)
          const globalBeat = (ev.bar - 1) * 4 + (ev.b - 1);
          const noteTimeInSeconds = globalBeat * beatDuration;
          const absoluteStartTime = this.startTime + noteTimeInSeconds + loopOffsetSecs;
          const absoluteDuration = ev.l * beatDuration;

          switch (track) {
            case 'lead':
              this.playLeadTone(ev.n, ev.v, absoluteStartTime, absoluteDuration);
              break;
            case 'sub':
              this.playSubTone(ev.n, ev.v, absoluteStartTime, absoluteDuration);
              break;
            case 'arp':
              this.playArpTone(ev.n, ev.v, absoluteStartTime, absoluteDuration);
              break;
            case 'bass':
              this.playBassTone(ev.n, ev.v, absoluteStartTime, absoluteDuration);
              break;
            case 'kick':
              this.playKickSynth(absoluteStartTime, absoluteDuration);
              break;
            case 'snare':
              this.playSnareSynth(absoluteStartTime, absoluteDuration);
              break;
            case 'hihat':
              this.playHihatSynth(absoluteStartTime, absoluteDuration);
              break;
          }
        });
      });
    };

    // Schedule initial iteration
    scheduleIteration(0);

    // If loop is on, schedule 2 more loops to give heaps of runtime space
    // or we can handle loop wrapping inside the progress tracker.
    // Actually, handling loop wrapping dynamically is much better because it plays infinitely!
    // To play infinitely, we can just monitor currentTime in progress tracking,
    // and if it exceeds loop length, we reset startTime to currentTime, clean old resources, and reschedule!
    // This is incredibly elegant and means the memory doesn't leak or blow up.
  }

  private startProgressTracker() {
    if (!this.ctx || !this.isPlaying) return;

    const track = () => {
      if (!this.ctx || !this.isPlaying) return;

      const beatDuration = 60 / this.activeBpm;
      const totalDurationSecs = this.playLengthBeats * beatDuration;

      const elapsedSecs = this.ctx.currentTime - this.startTime;
      
      if (elapsedSecs >= totalDurationSecs) {
        if (this.loop) {
          // Warp to start
          this.activeBpm = this.bpm; // Dynamically adopt live BPM setting
          this.startTime = this.ctx.currentTime;
          this.clearPastActiveSources();
          this.scheduleAllNotes(this.playLengthBeats / 4);
          this.onTimeUpdate(1, 1, 0);
        } else {
          this.stop();
          this.onPlaybackEnd();
          return;
        }
      }

      const currentSecs = this.ctx.currentTime - this.startTime;
      const progress = currentSecs / totalDurationSecs;
      const elapsedBeats = currentSecs / beatDuration;
      
      const currentBar = Math.floor(elapsedBeats / 4) + 1;
      const currentBeat = Math.floor((elapsedBeats % 4) * 4) / 4 + 1; // Quantize visual to 16th steps

      this.onTimeUpdate(currentBar, currentBeat, progress);

      this.animationFrameId = requestAnimationFrame(track);
    };

    this.animationFrameId = requestAnimationFrame(track);
  }

  private clearPastActiveSources() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.activeSources = this.activeSources.filter((src) => src.stopTime > now);
  }

  public stop() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop all active physical generator nodes immediately
    this.activeSources.forEach((src) => {
      try {
        (src.node as any).stop();
      } catch (e) {
        // Already stopped or not stoppable
      }
    });
    this.activeSources = [];
  }
}

export const SynthEngine = new RetroSynthEngine();
export default SynthEngine;
