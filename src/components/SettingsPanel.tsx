import React from 'react';
import { CompositionSettings } from '../types';
import { Music, Shuffle, RotateCcw, PlaySquare, Compass } from 'lucide-react';

interface SettingsPanelProps {
  settings: CompositionSettings;
  setSettings: React.Dispatch<React.SetStateAction<CompositionSettings>>;
  seed: number;
  regenerate: () => void;
  randomizeSeed: () => void;
}

export const CHORD_PRESETS = [
  { value: "4536", label: "王道進行 (Royal Road: F-G-Em-Am)" },
  { value: "6415", label: "中二悲壮 (Epic Melancholy: Am-F-C-G)" },
  { value: "1645", label: "黄金懐古 (Retro Romance: C-Am-F-G)" },
  { value: "4516", label: "流行躍動 (Pop Energy: F-G-C-Am)" },
  { value: "3625", label: "爵士律動 (Jazz Circle: Em-Am-Dm-G)" },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  setSettings,
  seed,
  regenerate,
  randomizeSeed
}) => {
  const handleChordChange = (chords: string) => {
    // Sanitize chords: only digits 1 to 6
    const sanitized = chords.replace(/[^1-6]/g, '');
    setSettings((prev) => ({ ...prev, chords: sanitized || '4536' }));
  };

  return (
    <div id="settings-panel" className="bg-[#121214] border border-[#27272a] rounded-xl p-5 md:p-6 shadow-xl relative overflow-hidden">
      {/* Visual Accent */}
      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>

      <div className="flex items-center gap-3 mb-6">
        <Music className="w-5 h-5 text-emerald-400" id="settings-icon" />
        <h2 className="text-sm font-press-start text-white tracking-wide uppercase">
          Composer Settings
        </h2>
      </div>

      <div className="space-y-6 text-sm text-gray-300">
        {/* Chord Progression */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-400 mb-2">
            Chord Progression / 和弦走向 (1-6)
          </label>
          <div className="flex gap-2 mb-2">
            <input
              id="chord-input"
              type="text"
              className="flex-1 bg-[#1a1a1e] border border-[#2e2e33] rounded-lg px-3 py-2 text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              value={settings.chords}
              onChange={(e) => handleChordChange(e.target.value)}
              placeholder="4536"
              maxLength={16}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-1.5 mt-2">
            {CHORD_PRESETS.map((preset) => (
              <button
                id={`preset-${preset.value}`}
                key={preset.value}
                onClick={() => setSettings((prev) => ({ ...prev, chords: preset.value }))}
                className={`text-left text-xs font-mono px-2.5 py-1.5 rounded border transition-all truncate ${
                  settings.chords === preset.value
                    ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300'
                    : 'bg-[#18181b] border-[#27272a] hover:border-gray-600 text-gray-400 hover:text-white'
                }`}
              >
                {preset.value} • {preset.label.split('(')[0]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-2 font-mono">
            Support keys: 1=C, 2=Dm, 3=Em, 4=F, 5=G, 6=Am. Enter up to 16 digits.
          </p>
        </div>

        {/* BPM & Structure Length */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* BPM */}
          <div>
            <div className="flex justify-between items-center text-xs font-mono uppercase tracking-wider text-gray-400 mb-2">
              <span>Tempo (BPM)</span>
              <span className="text-emerald-400 font-bold">{settings.bpm}</span>
            </div>
            <input
              id="bpm-slider"
              type="range"
              min={70}
              max={180}
              step={1}
              value={settings.bpm}
              onChange={(e) => setSettings((prev) => ({ ...prev, bpm: parseInt(e.target.value) }))}
              className="w-full h-1.5 bg-[#18181b] rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <div className="flex justify-between text-[10px] text-gray-600 font-mono mt-1">
              <span>70 BPM</span>
              <span>180 BPM</span>
            </div>
          </div>

          {/* Section Length */}
          <div>
            <div className="flex justify-between items-center text-xs font-mono uppercase tracking-wider text-gray-400 mb-2">
              <span>Total Bars / 小节数</span>
              <span className="text-emerald-400 font-bold">{settings.length}</span>
            </div>
            <select
              id="length-select"
              value={settings.length}
              onChange={(e) => setSettings((prev) => ({ ...prev, length: parseInt(e.target.value) }))}
              className="w-full bg-[#1a1a1e] border border-[#2e2e33] rounded-lg px-3 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              <option value={4}>4 Bars (A段前奏)</option>
              <option value={8}>8 Bars (标准短乐句)</option>
              <option value={16}>16 Bars (双段对比乐章)</option>
              <option value={24}>24 Bars (华丽即兴乐章)</option>
              <option value={32}>32 Bars (极长篇宏大奏鸣)</option>
            </select>
          </div>
        </div>

        {/* Rhythmic Algorithm Prob & Mode Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Mode Switcher */}
          <div>
            <span className="block text-xs font-mono uppercase tracking-wider text-gray-400 mb-2">
              Composition Mode
            </span>
            <div className="flex bg-[#18181b] p-1 border border-[#27272a] rounded-lg gap-1">
              <button
                id="mode-phrase"
                onClick={() => setSettings((prev) => ({ ...prev, phraseMode: true, length: Math.max(8, prev.length - (prev.length % 8)) }))}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-mono text-xs transition-all ${
                  settings.phraseMode
                    ? 'bg-emerald-500 text-black font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-neutral-800/40'
                }`}
              >
                <PlaySquare className="w-3.5 h-3.5" />
                <span>Phrase A</span>
              </button>
              <button
                id="mode-improvisation"
                onClick={() => setSettings((prev) => ({ ...prev, phraseMode: false }))}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-mono text-xs transition-all ${
                  !settings.phraseMode
                    ? 'bg-emerald-500 text-black font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-neutral-800/40'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Impro B</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-2 font-mono leading-relaxed">
              {settings.phraseMode 
                ? "Mode A: 8-bar symmetric motifs, question-answering phrase structure (Exposition/Sequence/Contrast/Cadence)." 
                : "Mode B: Fully organic, bar-by-bar free-flowing melodic improvisation."}
            </p>
          </div>

          {/* Algorithm Rhythm Probability */}
          <div>
            <div className="flex justify-between items-center text-xs font-mono uppercase tracking-wider text-gray-400 mb-2">
              <span>Algonhythm Weight</span>
              <span className="text-emerald-400 font-bold">{Math.round(settings.probAlgoRhythm * 100)}%</span>
            </div>
            <input
              id="prob-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.probAlgoRhythm}
              onChange={(e) => setSettings((prev) => ({ ...prev, probAlgoRhythm: parseFloat(e.target.value) }))}
              className="w-full h-1.5 bg-[#18181b] rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <div className="flex justify-between text-[10px] text-gray-600 font-mono mt-1">
              <span>Preset Rhythms</span>
              <span>Pure Algorithmic</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-2 font-mono leading-relaxed">
              Higher value gives the rhythmic engine more agency (adding double hits, complex 16-th syncops).
            </p>
          </div>
        </div>

        {/* Math Seed Controller */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono text-xs">
            <span className="text-gray-500 uppercase tracking-wider block">Composition Root Seed</span>
            <span className="text-white font-bold text-sm tracking-widest">{seed}</span>
          </div>
          <div className="flex gap-2">
            <button
              id="btn-random-seed"
              onClick={randomizeSeed}
              className="flex items-center gap-1.5 bg-[#1f1f23] hover:bg-neutral-800 border border-[#3e3e44] text-white rounded-lg px-3 py-1.5 font-mono text-xs transition-all active:scale-95"
              title="Dice roll a new seed"
            >
              <Shuffle className="w-3.5 h-3.5 text-blue-400" />
              <span>DICE</span>
            </button>
            <button
              id="btn-recompose"
              onClick={regenerate}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg px-4.5 py-1.5 font-mono text-xs transition-all active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>COMPOSE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SettingsPanel;
