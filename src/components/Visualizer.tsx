import React, { useState, useEffect } from 'react';
import { MidiData, MidiEvent, TrackConfig, TrackType } from '../types';
import { Sparkles, BarChart2 } from 'lucide-react';

interface VisualizerProps {
  midiData: MidiData;
  tracks: TrackConfig[];
  currentBar: number;
  currentBeat: number;
  isPlaying: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({
  midiData,
  tracks,
  currentBar,
  currentBeat,
  isPlaying
}) => {
  // Allow user to manually select which bar to view, or follow playhead automatically
  const [selectedBar, setSelectedBar] = useState<number>(1);
  const [followPlayhead, setFollowPlayhead] = useState<boolean>(true);

  // Synchronize selection with running playhead
  useEffect(() => {
    if (isPlaying && followPlayhead) {
      setSelectedBar(currentBar);
    }
  }, [currentBar, isPlaying, followPlayhead]);

  // Find max bar inside the dataset
  const maxBars = React.useMemo(() => {
    let max = 8;
    const trackNames: (keyof MidiData)[] = ['lead', 'sub', 'arp', 'bass'];
    trackNames.forEach((tr) => {
      midiData[tr].forEach((ev) => {
        if (ev.bar > max) max = ev.bar;
      });
    });
    return max;
  }, [midiData]);

  // Generate a list of bar numbers
  const barNumbers = Array.from({ length: maxBars }, (_, i) => i + 1);

  // Subdivisions lookup (16 sixteenth steps in a bar: beats 1.0, 1.25, 1.5, ... to 4.75)
  const steps = Array.from({ length: 16 }, (_, i) => 1.0 + i * 0.25);

  const getCurrentStepIndex = () => {
    if (!isPlaying || currentBar !== selectedBar) return -1;
    // Maps beat value 1.0-4.75 to index 0-15
    return Math.floor((currentBeat - 1) * 4);
  };

  const currentStepIdx = getCurrentStepIndex();

  // Helper to convert MIDI pitch numbers to printable pitch note names
  const getNoteName = (midi: number, isDrum: boolean) => {
    if (isDrum) {
      if (midi === 72) return "HAT";
      return "DRUM";
    }
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const name = notes[midi % 12];
    return `${name}${octave}`;
  };

  // Helper to retrieve note event currently scheduled for a track on a fraction step index
  const getEventForStep = (trackId: TrackType, beatVal: number): MidiEvent | undefined => {
    const trackEvents = midiData[trackId] || [];
    return trackEvents.find(
      (ev) => ev.bar === selectedBar && Math.abs(ev.b - beatVal) < 0.05
    );
  };

  return (
    <div id="piano-roll-container" className="bg-[#121214] border border-[#27272a] rounded-xl p-5 md:p-6 shadow-xl relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-5 h-5 text-indigo-400" id="seq-icon" />
          <h2 className="text-sm font-press-start text-white tracking-wide uppercase">
            Scrolling Matrix Visualizer
          </h2>
        </div>

        {/* Sync follow playhead option */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 font-mono flex items-center gap-1.5 cursor-pointer select-none">
            <input
              id="follow-playhead-checkbox"
              type="checkbox"
              checked={followPlayhead}
              onChange={(e) => setFollowPlayhead(e.target.checked)}
              className="accent-indigo-400 rounded bg-[#18181b] border-zinc-700"
            />
            Auto-follow Playhead
          </label>
        </div>
      </div>

      {/* Global Bars Navigator Overview */}
      <div className="mb-6 bg-[#18181b] p-3 border border-zinc-800 rounded-lg">
        <div className="flex justify-between items-center text-xs font-mono text-gray-400 mb-2.5">
          <span className="uppercase tracking-wider">Song Progress Timeline</span>
          {isPlaying && (
            <span className="text-indigo-400 text-[10px] font-press-start flex items-center gap-1">
              <Sparkles className="w-3 h-3 animate-spin" />
              PLAYING • BAR {currentBar} BEAT {currentBeat.toFixed(2)}
            </span>
          )}
        </div>
        
        {/* Row of bars overview buttons */}
        <div className="flex flex-wrap gap-1.5" id="timeline-bar-buttons">
          {barNumbers.map((barNum) => {
            const isPlayingThisBar = isPlaying && currentBar === barNum;
            const isSelected = selectedBar === barNum;

            return (
              <button
                key={barNum}
                onClick={() => {
                  setSelectedBar(barNum);
                  setFollowPlayhead(false); // manual bypass
                }}
                className={`flex-1 min-w-[40px] py-1.5 text-center font-mono text-xs rounded transition-all flex flex-col justify-between items-center ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-bold border border-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.4)]'
                    : isPlayingThisBar
                    ? 'bg-[#1e1a38] text-indigo-300 border border-indigo-805'
                    : 'bg-[#141417] text-gray-500 border border-[#222226] hover:text-gray-300 hover:border-gray-700'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-gray-400">Bar</span>
                <span className="text-sm mt-0.5">{barNum}</span>
                {/* Active dot */}
                <span className={`w-1.5 h-1.5 rounded-full mt-1 block ${
                  isPlayingThisBar ? 'bg-indigo-400 animate-pulse' : 'bg-transparent'
                }`}></span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid 16-Step matrix */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px] space-y-1.5 select-none" id="grid-matrix">
          
          {/* Header row containing subdivisions */}
          <div className="flex items-center text-[10px] font-press-start text-zinc-600 border-b border-zinc-900 pb-2">
            <div className="w-28 text-left uppercase">TRACK</div>
            <div className="flex-1 grid gap-1 text-center" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className={`py-1 rounded font-mono ${
                    currentStepIdx === idx ? 'text-indigo-400 bg-indigo-950/40 border border-indigo-900' : ''
                  }`}
                >
                  {step.toFixed(2)}
                </div>
              ))}
            </div>
          </div>

          {/* Core matrix rows for 7 channels */}
          {tracks.map((track) => {
            const isDrum = track.id === 'kick' || track.id === 'snare' || track.id === 'hihat';

            return (
              <div
                key={track.id}
                className="flex items-center h-10 border-b border-zinc-900 pb-1.5 last:border-0"
              >
                {/* Track ID label column */}
                <div className="w-28 flex flex-col justify-center text-left">
                  <span className="text-xs font-semibold text-gray-100 capitalize leading-none">
                    {track.name}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono mt-0.5">
                    {track.jpName}
                  </span>
                </div>

                {/* 16 divisions buttons matrix row */}
                <div className="flex-1 grid gap-1 h-full" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
                  {steps.map((beatValue, stepIdx) => {
                    const event = getEventForStep(track.id, beatValue);
                    const isPlayheadHere = currentStepIdx === stepIdx;

                    return (
                      <div
                        key={stepIdx}
                        className={`rounded flex items-center justify-center transition-all cursor-default border ${
                          event
                            ? `${track.color} border-current/40 shadow-sm text-black scale-98 hover:brightness-110`
                            : 'bg-[#141416]/90 border-neutral-800 hover:border-neutral-700'
                        } ${
                          isPlayheadHere
                            ? 'bg-neutral-800/60 ring-1 ring-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.5)]'
                            : ''
                        }`}
                        title={
                          event
                            ? `${track.name}: note ${getNoteName(event.n, isDrum)}, velocity ${event.v}`
                            : `${track.name}: empty step`
                        }
                      >
                        {event ? (
                          <span className="text-[10px] font-bold font-mono font-sans truncate px-0.5 uppercase tracking-tighter">
                            {getNoteName(event.n, isDrum)}
                          </span>
                        ) : (
                          <div className={`w-1 h-1 rounded-full ${isPlayheadHere ? 'bg-indigo-300' : 'bg-zinc-800'}`}></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-500 font-mono border-t border-zinc-900 pt-3">
        <span>* Grid tracks: Lead is square waveform, Sub is low counterpoint wave, Arp is walking triangles, Bass is deep triangle wave.</span>
        <span>Grid Resolution: 1/16 Beat</span>
      </div>
    </div>
  );
};
export default Visualizer;
