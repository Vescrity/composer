import React from 'react';
import { TrackConfig, TrackType } from '../types';
import { Volume2, VolumeX, Eye, EyeOff } from 'lucide-react';

interface TrackControlsProps {
  tracks: TrackConfig[];
  activeChannelNotes: Record<TrackType, boolean>;
  onTrackChange: (trackId: TrackType, field: keyof TrackConfig, value: any) => void;
  masterVolume: number;
  setMasterVolume: (val: number) => void;
}

export const TrackControls: React.FC<TrackControlsProps> = ({
  tracks,
  activeChannelNotes,
  onTrackChange,
  masterVolume,
  setMasterVolume
}) => {
  const isSoloActive = tracks.some((t) => t.soloed);

  return (
    <div id="mixer-board" className="bg-[#121214] border border-[#27272a] rounded-xl p-5 md:p-6 shadow-xl relative overflow-hidden">
      {/* Accent strip */}
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Volume2 className="w-5 h-5 text-blue-400" id="mixer-icon" />
          <h2 className="text-sm font-press-start text-white tracking-wide uppercase">
            Retro Mixer Board
          </h2>
        </div>

        {/* Master Fader */}
        <div className="flex items-center gap-3 bg-[#18181b] px-3 py-1.5 border border-[#27272a] rounded-lg">
          <span className="text-[10px] font-press-start text-gray-500 uppercase">MASTER</span>
          <input
            id="master-fader"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="w-24 sm:w-32 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-400"
            title="Master Fader Volume"
          />
          <span className="text-xs font-mono text-blue-400 font-bold w-8 text-right">
            {Math.round(masterVolume * 100)}%
          </span>
        </div>
      </div>

      {/* Grid of Mixer Channels */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {tracks.map((track) => {
          const isActive = activeChannelNotes[track.id];
          const isMutedBySolo = isSoloActive && !track.soloed;

          return (
            <div
              id={`channel-${track.id}`}
              key={track.id}
              className={`bg-[#18181b] border rounded-lg p-3 flex flex-col items-center transition-all relative ${
                track.muted || isMutedBySolo
                  ? 'border-neutral-900/40 opacity-55'
                  : 'border-[#27272a]'
              }`}
            >
              {/* Dynamic VU active signal LED */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                <span
                  title="VU Activity Indicator"
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-75 block ${
                    isActive
                      ? `${track.activeColor} shadow-[0_0_8px_currentColor] scale-110`
                      : 'bg-neutral-800'
                  }`}
                ></span>
              </div>

              {/* Waveform Symbol / Icon */}
              <div className="text-[10px] text-gray-600 font-mono self-start mb-1 select-none">
                {getWaveformGlyph(track.waveform)}
              </div>

              <div className="w-full text-center mt-2">
                <p className="text-xs font-semibold text-gray-200 capitalize truncate leading-none">
                  {track.name}
                </p>
                <p className="text-[10px] text-gray-500 font-mono mt-1">
                  {track.jpName}
                </p>
              </div>

              {/* Channel Slider Track volume container */}
              <div className="h-32 flex flex-col items-center justify-between my-3 relative w-full">
                {/* Vertical slider wrapper */}
                <div className="relative h-24 w-12 flex items-center justify-center">
                  <input
                    id={`slider-${track.id}`}
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={track.volume}
                    onChange={(e) => onTrackChange(track.id, 'volume', parseFloat(e.target.value))}
                    className="accent-blue-400 cursor-pointer"
                    style={{
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      position: 'absolute',
                      width: '96px', // Track length
                      height: '6px', // Track thickness
                      transform: 'rotate(-90deg)', // Rotate -90 degrees so min is bottom, max is top
                      transformOrigin: 'center',
                      background: '#1f1f23',
                      borderRadius: '9999px',
                      outline: 'none',
                      margin: 0,
                      padding: 0,
                    }}
                    title={`${track.name} volume fader`}
                  />
                </div>
                
                {/* Readout */}
                <span className="text-[10px] font-mono text-blue-400 font-bold leading-none mt-2">
                  {Math.round(track.volume * 100)}%
                </span>
              </div>

              {/* Mute and Solo triggers in retro glowing style */}
              <div className="flex gap-1.5 w-full">
                {/* Mute button */}
                <button
                  id={`btn-mute-${track.id}`}
                  onClick={() => onTrackChange(track.id, 'muted', !track.muted)}
                  className={`flex-1 py-1 rounded text-xs font-press-start border transition-all text-center uppercase ${
                    track.muted
                      ? 'bg-red-950/70 border-red-500 text-red-400 font-bold shadow-[0_0_6px_rgba(239,68,68,0.5)]'
                      : 'bg-[#121214] border-neutral-850 text-gray-500 hover:text-white hover:border-gray-600'
                  }`}
                  title="Mute Channel"
                >
                  M
                </button>

                {/* Solo button */}
                <button
                  id={`btn-solo-${track.id}`}
                  onClick={() => onTrackChange(track.id, 'soloed', !track.soloed)}
                  className={`flex-1 py-1 rounded text-xs font-press-start border transition-all text-center uppercase ${
                    track.soloed
                      ? 'bg-amber-950/70 border-amber-500 text-amber-400 font-bold shadow-[0_0_6px_rgba(245,158,11,0.5)]'
                      : 'bg-[#121214] border-neutral-850 text-gray-500 hover:text-white hover:border-gray-600'
                  }`}
                  title="Solo Channel"
                >
                  S
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function getWaveformGlyph(waveform: string): string {
  switch (waveform) {
    case 'square':
      return '■─■□□ (Pulse)';
    case 'triangle':
      return '▲▼▲ (Triangle)';
    case 'sine':
      return '∿∿∿ (Sine Sweep)';
    case 'noise':
    case 'snare_synth':
    case 'kick_synth':
      return '░▒█ (Noise Gen)';
    default:
      return '∿';
  }
}

export default TrackControls;
