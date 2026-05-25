# 8-Bit Chiptune Algorithmic Composer & Synth Workstation 🎹👾

An interactive, desktop-first, beautifully crafted web-synthesizer and algorithmic composer workstation that brings 8-bit chiptune synthesis and local DAW integration straight to your browser!

This workstation utilizes real-time client-side **Web Audio API** oscillators to synthesize authentic chiptune audio, and exposes a robust **Model Context Protocol (MCP)** interface allowing you to stream algorithmically generated music notes directly into your local **Ardour DAW** session.

---

## 🎨 Key Features & Visual Design

- **Fixed Interactive Global Top Header**: Play, pause, or loop your composition instantly while scrolling through any area of the workstation.
- **CRT Nostalgia Scanline layer**: Retro arcade-style scanline overlay rendering deep charcoal gray aesthetics and glowing active VU track lights.
- **Classic Vertical Channel Faders**: Beautifully designed vertical input sliders (where dragging up boosts the gain values and dragging down lowers them), with **M** (Mute) & **S** (Solo) quick switches.
- **Live Real-time Tempo (BPM)**: Dynamically adjust the BPM speed during live playback and watch the sequencer sync the ticks immediately on the next loop cycle.
- **Python CLI Backing Script**: Fully modularized Python package nested under `/python_composer/` with a high-level runner `chiptune_composer.py` for terminal command execution.

---

## 🎶 Sound Synthesizer Core

Every signal is generated physically using the native Web Audio API (`AudioContext`). No laggy pre-recorded samples or static MP3 files are used!
* **Arpeggiator Channel (Pulse Arp)**: Boosted with custom peak gains and a snappy, bouncy staccato envelope to ensure your melodies sound incredibly bright, crisp, and bouncy.
* **Lead / Sub Channel**: Classical resonant pulse square waves simulating the iconic NES RP2A03 APU pulse registers with full ADSR phase envelope shaping.
* **Triangle Bass**: Generates deep sub-bass frequencies using pure triangle oscillators.
* **Custom Synthesis Drums (Kick, Snare, Hi-hat)**:
  * **Synth Kick**: Utilizes a sine wave pitch sweep running from 150Hz to 40Hz within 80ms over an instant click peak transaction to produce a warm punchy thud.
  * **Synth Snare**: Custom bandpass filtered pink/white noise sweep centering near 1000Hz.
  * **Hihat Click**: High-frequency bandpass/highpass filtered white noise click with a super-fast 60ms decay window.

---

## 🧠 Dynamic Composition Algorithm

Compiles J-pop progressions like the **王道進行 (4-5-3-6)** or dramatic resolutions with high-fidelity variety constraints:
* **Phrase Structures**: Sequences can be arranged under continuous improvisation or structured 8-bar melodic periods.
* **Soft Cadence Resolution in Bars 7 & 8**: 
  * Specifically refactored so that **Bar 7** builds a tense but varied narrative rhythm (mostly robust integer pulses mixed with rare 8th-note syncopes).
  * **Bar 8** dynamically decides between multiple endings (whole note anchor, power half notes, or progressive scale walks) and resolves cleanly to the chord root or fifth on the very last beat!

---

## 🛠️ Project File Structure

```bash
├── package.json               # Package scripts (Vite + TypeScript)
├── chiptune_composer.py       # Main Python CLI runner for local script execution
├── python_composer/           # Modularized Python algorithmic core
│   ├── __init__.py
│   ├── consts.py              # Music scale and chord map registers
│   ├── composer.py            # Algorithmic period melody/rhythm builders
│   ├── mcp_client.py          # JSON-RPC network client
│   └── main.py                # Command line interface and parser
├── src/                       
│   ├── App.tsx                # Main layout coordinator (Fixed topbar + modular grids)
│   ├── types.ts               # Shared TypeScript typings
│   ├── composer.ts            # Algorithmic compiler for the Web UI
│   ├── synth.ts               # Web Audio API physical synthesizer engine
│   └── components/            
│       ├── SettingsPanel.tsx  # Dynamic chord mapping controls
│       ├── TrackControls.tsx  # Horizontal channel mixer strip with vertical slider nodes
│       ├── Visualizer.tsx     # Color-coded playhead step sequencer grid
│       └── McpPanel.tsx       # Model Context Protocol Ardour DAW integration node
```

---

## 🚀 Getting Started

### 1. Requirements
Ensure you have **Node.js 18+** installed on your workstation.

### 2. Install dependencies
```bash
npm install
```

### 3. Run development mode
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view it in the browser page iframe.

### 4. Build application
```bash
npm run build
```

---

## 🐍 Python Command Line Execution

You can run the modular command line composer backend client directly in your local terminal to interface with your running Ardour DAW session or inspect the scale generation:

```bash
# Execute modular script (Generates chord 4536, starting at Bar 1 for a length of 8 Bars)
python chiptune_composer.py --chords 4536 --start-bar 1 --length 8
```

Enjoy composing gorgeous 8-bit classical chiptunes! 🎮✨
