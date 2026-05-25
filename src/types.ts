export interface MidiEvent {
  bar: number;
  b: number; // Beat value in the bar (e.g. 1.0, 1.25, 1.5, 1.75, 2.0, etc.)
  n: number; // MIDI Note Number (e.g. 60 = C4)
  v: number; // Velocity (0 to 127)
  l: number; // Note length in beats (e.g. 0.22)
  id?: string; // Optional unique id for keys and visuals
}

export interface MidiData {
  lead: MidiEvent[];
  sub: MidiEvent[];
  arp: MidiEvent[];
  bass: MidiEvent[];
  kick: MidiEvent[];
  snare: MidiEvent[];
  hihat: MidiEvent[];
}

export type TrackType = 'lead' | 'sub' | 'arp' | 'bass' | 'kick' | 'snare' | 'hihat';

export interface ChordDetails {
  name: string;
  root: number;
  tones: number[];
  seventh?: number;
}

export interface TrackConfig {
  id: TrackType;
  name: string;
  jpName: string;
  color: string;
  activeColor: string;
  volume: number; // 0 to 1
  muted: boolean;
  soloed: boolean;
  waveform: OscillatorType | 'noise' | 'kick_synth' | 'snare_synth'; // Synth settings
}

export interface CompositionSettings {
  startBar: number;
  length: number;
  chords: string; // "4536", "1645", etc.
  probAlgoRhythm: number; // 0 to 1
  phraseMode: boolean;
  bpm: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentBar: number;
  currentBeat: number; // 1 to 4 in steps of 0.25 (16th notes: 1, 1.25, 1.5, 1.75, 2.0, ...)
}
