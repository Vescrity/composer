import React, { useState, useEffect, useRef } from 'react';
import { TrackConfig, CompositionSettings, MidiData, TrackType } from './types';
import { generateAlgorithmicMidi } from './composer';
import { SynthEngine } from './synth';

// Subcomponents
import SettingsPanel from './components/SettingsPanel';
import TrackControls from './components/TrackControls';
import Visualizer from './components/Visualizer';
import McpPanel from './components/McpPanel';

// Icons represent global interface states
import { Play, Square, RefreshCcw, Info, Volume2, HelpCircle, Sparkles } from 'lucide-react';

const INITIAL_TRACK_CONFIGS: TrackConfig[] = [
  {
    id: 'lead',
    name: 'Lead Main',
    jpName: '主旋律',
    color: 'bg-emerald-400 text-black border-emerald-300',
    activeColor: 'bg-emerald-400',
    volume: 0.8,
    muted: false,
    soloed: false,
    waveform: 'square'
  },
  {
    id: 'sub',
    name: 'Sub Melody',
    jpName: '副旋律',
    color: 'bg-teal-400 text-black border-teal-300',
    activeColor: 'bg-teal-400',
    volume: 0.7,
    muted: false,
    soloed: false,
    waveform: 'square'
  },
  {
    id: 'arp',
    name: 'Pulse Arp',
    jpName: '琶音和弦',
    color: 'bg-indigo-400 text-black border-indigo-300',
    activeColor: 'bg-indigo-400',
    volume: 0.55,
    muted: false,
    soloed: false,
    waveform: 'triangle'
  },
  {
    id: 'bass',
    name: 'Tri Bass',
    jpName: '低音贝斯',
    color: 'bg-pink-400 text-black border-pink-300',
    activeColor: 'bg-pink-400',
    volume: 0.8,
    muted: false,
    soloed: false,
    waveform: 'triangle'
  },
  {
    id: 'kick',
    name: 'Kick Drum',
    jpName: '合成大鼓',
    color: 'bg-red-400 text-black border-red-300',
    activeColor: 'bg-red-400',
    volume: 0.85,
    muted: false,
    soloed: false,
    waveform: 'kick_synth'
  },
  {
    id: 'snare',
    name: 'Snare Drum',
    jpName: '合成小鼓',
    color: 'bg-orange-400 text-black border-orange-300',
    activeColor: 'bg-orange-400',
    volume: 0.75,
    muted: false,
    soloed: false,
    waveform: 'snare_synth'
  },
  {
    id: 'hihat',
    name: 'Hihat Click',
    jpName: '闭合镲片',
    color: 'bg-yellow-400 text-black border-yellow-300',
    activeColor: 'bg-yellow-400',
    volume: 0.6,
    muted: false,
    soloed: false,
    waveform: 'noise'
  }
];

export default function App() {
  const [settings, setSettings] = useState<CompositionSettings>({
    startBar: 1,
    length: 8,
    chords: '4536',
    probAlgoRhythm: 0.5,
    phraseMode: true,
    bpm: 120
  });

  const [tracks, setTracks] = useState<TrackConfig[]>(INITIAL_TRACK_CONFIGS);
  const [masterVolume, setMasterVolume] = useState<number>(0.7);
  const [seed, setSeed] = useState<number>(4536);

  // Playback indicators
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentBar, setCurrentBar] = useState<number>(1);
  const [currentBeat, setCurrentBeat] = useState<number>(1.0);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [loop, setLoop] = useState<boolean>(true);

  // VU Activity indicator lamps
  const [activeChannelNotes, setActiveChannelNotes] = useState<Record<TrackType, boolean>>({
    lead: false,
    sub: false,
    arp: false,
    bass: false,
    kick: false,
    snare: false,
    hihat: false
  });

  // Track database compiled MidiData structure
  const [midiData, setMidiData] = useState<MidiData>({
    lead: [],
    sub: [],
    arp: [],
    bass: [],
    kick: [],
    snare: [],
    hihat: []
  });

  // Keep a mutable ref of midi data so audio progress scheduler callback can access it without closure locks
  const midiDataRef = useRef<MidiData>(midiData);
  useEffect(() => {
    midiDataRef.current = midiData;
  }, [midiData]);

  // Handle master compositions compiled on component Mount or when settings/seed change
  useEffect(() => {
    composeAndLoad();
  }, [settings.length, settings.chords, settings.probAlgoRhythm, settings.phraseMode, seed]);

  // Synchronously update faders on the active synth core when tracks change
  useEffect(() => {
    const isSoloActive = tracks.some((t) => t.soloed);
    tracks.forEach((track) => {
      SynthEngine.updateTrackGain(track.id, track, isSoloActive);
    });
  }, [tracks]);

  // Synchronize master gain node Fader
  useEffect(() => {
    SynthEngine.updateMasterVolume(masterVolume * 0.5); // scaled safely to prevent audio clipping
  }, [masterVolume]);

  // Synchronize tempo (BPM) on the synthesizer core in real-time
  useEffect(() => {
    SynthEngine.setBpm(settings.bpm);
  }, [settings.bpm]);

  const composeAndLoad = () => {
    const compiled = generateAlgorithmicMidi(
      settings.length,
      settings.chords,
      settings.probAlgoRhythm,
      settings.phraseMode,
      seed
    );
    setMidiData(compiled);

    // If currently running, stop immediately to reboot sequences
    if (isPlaying) {
      handleStop();
    }
  };

  const handlePlayToggle = () => {
    if (isPlaying) {
      handleStop();
    } else {
      setIsPlaying(true);
      // Trigger live physical play sequence
      SynthEngine.play(
        midiData,
        settings.bpm,
        loop,
        (bar, beat, progress) => {
          setCurrentBar(bar);
          setCurrentBeat(beat);
          setPlaybackProgress(progress);
          checkActiveNotesTrigger(bar, beat);
        },
        () => {
          setIsPlaying(false);
          clearAllActiveVUMeters();
        }
      );
    }
  };

  const handleStop = () => {
    SynthEngine.stop();
    setIsPlaying(false);
    setCurrentBar(1);
    setCurrentBeat(1.0);
    setPlaybackProgress(0);
    clearAllActiveVUMeters();
  };

  // Blinks channel indicator lamps when there are notes hitting in that subdivision tick
  const checkActiveNotesTrigger = (bar: number, beat: number) => {
    const activeUpdate = {
      lead: false,
      sub: false,
      arp: false,
      bass: false,
      kick: false,
      snare: false,
      hihat: false
    };
    const channels: TrackType[] = ['lead', 'sub', 'arp', 'bass', 'kick', 'snare', 'hihat'];
    channels.forEach((chan) => {
      const hasEvent = midiDataRef.current[chan].some(
        (ev) => ev.bar === bar && Math.abs(ev.b - beat) < 0.05
      );
      activeUpdate[chan] = hasEvent;
    });
    setActiveChannelNotes(activeUpdate);
  };

  const clearAllActiveVUMeters = () => {
    setActiveChannelNotes({
      lead: false,
      sub: false,
      arp: false,
      bass: false,
      kick: false,
      snare: false,
      hihat: false
    });
  };

  const handleTrackChange = (trackId: TrackType, field: keyof TrackConfig, value: any) => {
    setTracks((prevTracks) =>
      prevTracks.map((tr) => (tr.id === trackId ? { ...tr, [field]: value } : tr))
    );
  };

  const randomizeSeed = () => {
    const arbitraryIntegerIndex = Math.floor(1000 + Math.random() * 98000);
    setSeed(arbitraryIntegerIndex);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col font-sans crt-effect relative">
      {/* CRT Scanning line layer */}
      <div className="crt-scanline"></div>

      {/* Retro aesthetic head bar banner */}
      <header className="border-b border-[#1d1d21] bg-[#0c0c0e]/80 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600/10 border border-indigo-400 p-2 rounded-lg text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.2)]">
            <span className="font-press-start text-xs block select-none">8B</span>
          </div>
          <div>
            <h1 className="text-sm font-press-start tracking-wider uppercase bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              8-Bit Algorithmic Composer
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono mt-1 block">
              REAL-TIME SYNTHESIZER & MODEL CONTEXT PROTOCOL WORKSTATION
            </p>
          </div>
        </div>

        {/* Global central play controller bar */}
        <div className="flex items-center gap-3 bg-[#121214] border border-[#232328] rounded-xl px-4 py-2">
          {/* Play/Stop button */}
          <button
            id="global-play-btn"
            onClick={handlePlayToggle}
            className={`flex items-center gap-2 rounded-lg px-5 py-2 font-mono text-xs font-bold uppercase transition-all duration-150 active:scale-95 ${
              isPlaying
                ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-[0_0_10px_rgba(239,68,68,0.35)]'
                : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
            }`}
          >
            {isPlaying ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current text-white" />
                <span>STOP</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current text-zinc-950" />
                <span>PLAY</span>
              </>
            )}
          </button>

          {/* Loop Option block */}
          <label className="text-[11px] font-mono hover:text-white text-zinc-400 border-l border-zinc-800 pl-3 flex items-center gap-2 cursor-pointer select-none">
            <input
              id="global-loop-checkbox"
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
              className="accent-emerald-500 rounded bg-[#1c1c20]"
            />
            Infinite Loop
          </label>
        </div>
      </header>

      {/* Spacer to push top-level content beautifully below the fixed header */}
      <div className="h-[128px] md:h-[110px] lg:h-[76px] shrink-0" />

      {/* Main dashboard content */}
      <main className="flex-grow p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
        
        {/* Help banner layout */}
        <div className="bg-[#121214]/60 border border-zinc-800/80 rounded-xl p-4 flex flex-wrap gap-4 items-start justify-between">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-300 space-y-1">
              <p className="font-bold text-white">Welcome to the 8-Bit Chiptune Algorithmic Synthesizer Studio!</p>
              <p className="leading-relaxed">
                This environment recreates the rhythmic scale generation patterns of the provided Python MCP framework. Customize your chords and tempo below, click <b className="text-emerald-400">COMPOSE</b>, and hit <b className="text-indigo-400">PLAY</b> to hear the browser synthesize authentic 8-bit pulse widths, pure triangles, and filtered noise sweeps on the fly!
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center bg-[#17171a] border border-zinc-805 rounded-lg px-2.5 py-1 text-[11px] font-mono text-zinc-400 gap-1.5 self-center">
            <span>Synthesis: AudioNode AudioContext</span>
          </div>
        </div>

        {/* Bento grid layout block */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left panel: Composer controls (span 5) */}
          <div className="lg:col-span-5 space-y-6">
            <SettingsPanel
              settings={settings}
              setSettings={setSettings}
              seed={seed}
              regenerate={composeAndLoad}
              randomizeSeed={randomizeSeed}
            />
            
            {/* Quick tips */}
            <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5" id="help-tips">
              <h3 className="text-xs font-press-start uppercase tracking-wider text-white mb-3">Chiptune Style Guide</h3>
              <ul className="text-xs text-zinc-400 space-y-2 font-mono list-disc pl-4 leading-relaxed">
                <li><b className="text-indigo-400">王道進行 (4536)</b>: Extremely melodic anime/J-Pop feeling, flows perfectly into loop sequences.</li>
                <li><b className="text-pink-400">中二悲壮 (6415)</b>: Excellent for dramatic boss battles, heavy retro chord resolutions.</li>
                <li>Adjust <b className="text-emerald-400">Algonhythm Weight</b> to allow the synthesizer to trigger spontaneous double clicks or floating 16th syncopes.</li>
              </ul>
            </div>
          </div>

          {/* Right panel: Sequencer and mixer displays (span 7) */}
          <div className="lg:col-span-7 space-y-6">
            <Visualizer
              midiData={midiData}
              tracks={tracks}
              currentBar={currentBar}
              currentBeat={currentBeat}
              isPlaying={isPlaying}
            />

            <TrackControls
              tracks={tracks}
              activeChannelNotes={activeChannelNotes}
              onTrackChange={handleTrackChange}
              masterVolume={masterVolume}
              setMasterVolume={setMasterVolume}
            />
          </div>
        </div>

        {/* Bottom workspace layout: MCP Console integration */}
        <McpPanel
          midiData={midiData}
          settings={{
            startBar: settings.startBar,
            length: settings.length,
            chords: settings.chords,
            probAlgoRhythm: settings.probAlgoRhythm,
            phraseMode: settings.phraseMode,
            bpm: settings.bpm
          }}
          seed={seed}
          tracks={tracks}
        />
      </main>

      {/* Decorative footer */}
      <footer className="border-t border-[#1d1d21] bg-[#0c0c0e] py-6 px-6 text-center text-xs font-mono text-zinc-600 flex flex-wrap items-center justify-between gap-4">
        <p>© 2026 8-Bit Algorithmic MIDI Workstation • Open Source</p>
        <p className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Synthesized in Cloud Virtual Frame Host</span>
        </p>
      </footer>
    </div>
  );
}
