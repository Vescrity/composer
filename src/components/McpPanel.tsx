import React, { useState } from 'react';
import { MidiData, TrackConfig, TrackType } from '../types';
import { Cpu, Copy, FileCode, Check, Send, Sparkles, RefreshCw, AlertTriangle, Download } from 'lucide-react';

interface McpPanelProps {
  midiData: MidiData;
  settings: {
    startBar: number;
    length: number;
    chords: string;
    probAlgoRhythm: number;
    phraseMode: boolean;
    bpm: number;
  };
  seed: number;
  tracks: TrackConfig[];
}

export const McpPanel: React.FC<McpPanelProps> = ({
  midiData,
  settings,
  seed,
  tracks
}) => {
  const [mcpUrl, setMcpUrl] = useState<string>('http://127.0.0.1:4820/mcp');
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [connectedTracks, setConnectedTracks] = useState<any[]>([]);
  const [mcpStatus, setMcpStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: ''
  });

  // Track map override state
  const [trackBindings, setTrackBindings] = useState<Record<TrackType, string>>({
    lead: 'lead_main',
    sub: 'sub',
    arp: 'arp',
    bass: 'bass',
    kick: 'kick',
    snare: 'snare',
    hihat: 'hihat'
  });

  const getMidiJsonString = () => {
    return JSON.stringify(midiData, null, 2);
  };

  // Perform MCP standard JSON-RPC fetch call
  const callMcp = async (method: string, params: any) => {
    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: method,
        arguments: params
      }
    };

    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const resJson = await response.json();
    if (resJson.error) {
      throw new Error(resJson.error.message || JSON.stringify(resJson.error));
    }

    return resJson.result;
  };

  // Scan local Ardour tracks via MCP
  const handleScanMcp = async () => {
    setConnecting(true);
    setMcpStatus({ type: 'idle', message: '' });
    try {
      const res = await callMcp('tracks_list', { includeHidden: true });
      let tracksFetched: any[] = [];
      
      if (res && res.content && res.content[0] && res.content[0].text) {
        try {
          const parsed = JSON.parse(res.content[0].text);
          tracksFetched = parsed.tracks || [];
        } catch (_) {}
      } else if (res && res.tracks) {
        tracksFetched = res.tracks;
      }

      if (tracksFetched.length === 0) {
        throw new Error("No active tracks found in current Ardour session");
      }

      setConnectedTracks(tracksFetched);
      setMcpStatus({
        type: 'success',
        message: `Successfully connected! Found ${tracksFetched.length} tracks in Ardour.`
      });

      // Simple keywords alignment
      const bindingsUpdate = { ...trackBindings };
      const mappingKeywords: Record<TrackType, string[]> = {
        lead: ["lead_main", "main_lead", "lead"],
        sub: ["sub", "lead_sub"],
        arp: ["arp", "pulse2", "danger"],
        bass: ["bass", "wave", "drive"],
        kick: ["kick", "drum_kick"],
        snare: ["snare", "drum_snare"],
        hihat: ["hihat", "hat", "drum_hat"],
      };

      Object.entries(mappingKeywords).forEach(([key, keywords]) => {
        const mat = tracksFetched.find((t: any) => {
          const nameLower = t.name.toLowerCase();
          if (key === 'sub' && !nameLower.includes('sub')) return false;
          if (key !== 'sub' && nameLower.includes('sub')) return false;
          return keywords.some((kw) => nameLower.includes(kw));
        });
        if (mat) {
          bindingsUpdate[key as TrackType] = mat.id;
        }
      });
      setTrackBindings(bindingsUpdate);

    } catch (err: any) {
      setMcpStatus({
        type: 'error',
        message: `Connection failed: ${err.message || 'Make sure Ardour MCP server is running & CORS is open.'}`
      });
    } finally {
      setConnecting(false);
    }
  };

  // Import Midi data via MCP
  const handleExportMcp = async () => {
    if (connectedTracks.length === 0) {
      setMcpStatus({
        type: 'error',
        message: 'Please click "SCAN ARDOUR SESSION" to bind tracks first!'
      });
      return;
    }

    setConnecting(true);
    setMcpStatus({ type: 'idle', message: 'Syncing midi files...' });

    try {
      const keys: TrackType[] = ['lead', 'sub', 'arp', 'bass', 'kick', 'snare', 'hihat'];
      
      for (const key of keys) {
        const events = midiData[key];
        const trackId = trackBindings[key];

        // Only sync if track exists and has events
        if (!trackId || !events || events.length === 0) continue;

        // Call MIDI note import tool
        await callMcp('midi_note_import_json_to_new_region_bbt', {
          trackId: trackId,
          name: `Composer_Gen_${settings.chords}_Bar${settings.startBar}_Seed${seed}`,
          startBar: settings.startBar,
          startBeat: 1.0,
          endBar: settings.startBar + settings.length,
          endBeat: 1.0,
          midi: {
            channel_base: 'one',
            midi_events: events
          }
        });
      }

      setMcpStatus({
        type: 'success',
        message: `Successfully synchronized all tracks to Ardour from Bar ${settings.startBar}!`
      });

    } catch (err: any) {
      setMcpStatus({
        type: 'error',
        message: `Sync failed: ${err.message || 'Write boundary violation'}`
      });
    } finally {
      setConnecting(false);
    }
  };

  // Generate dynamic customized python CLI script
  const getPythonScriptString = () => {
    return `import urllib.request
import json
import time
import argparse
import random

URL = "${mcpUrl}"

# C Major / A Minor Scale White Keys
WHITE_KEYS = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88, 89, 91, 93, 95]

CHORD_MAP = {
    "1": {"name": "C",   "root": 48, "tones": [48, 52, 55], "seventh": 59}, 
    "2": {"name": "Dm",  "root": 50, "tones": [50, 53, 57], "seventh": 60}, 
    "3": {"name": "Em",  "root": 52, "tones": [52, 55, 59], "seventh": 62}, 
    "4": {"name": "F",   "root": 53, "tones": [53, 57, 60], "seventh": 64}, 
    "5": {"name": "G",   "root": 55, "tones": [55, 59, 62], "seventh": 65}, 
    "6": {"name": "Am",  "root": 57, "tones": [57, 60, 64], "seventh": 67}  
}

def generate_algorithmic_rhythm(rng):
    beats = []
    grid_probs = {1.0: 0.95, 1.5: 0.30, 2.0: 0.75, 2.5: 0.30, 3.0: 0.85, 3.5: 0.30, 4.0: 0.75, 4.5: 0.40}
    for b, prob in grid_probs.items():
        if rng.random() < prob: beats.append(b)
    isolated_16ths = [1.25, 1.75, 2.25, 2.75, 3.25, 3.75, 4.25, 4.75]
    for b in isolated_16ths:
        if rng.random() < 0.06: beats.append(b)
    if not beats: beats.append(1.0)
    decorated_beats = list(beats)
    for b in beats:
        if b == int(b) or (b * 2) == int(b * 2):
            if rng.random() < 0.06:
                double_tap = b + 0.25
                if double_tap <= 4.75: decorated_beats.append(double_tap)
    return sorted(list(set(decorated_beats)))

def get_next_lead_note(prev_note, b_val, chord_tones, chord_step, rng):
    if prev_note not in WHITE_KEYS:
        prev_note = min(WHITE_KEYS, key=lambda x: abs(x - prev_note))
    current_idx = WHITE_KEYS.index(prev_note)
    offsets = [-2, -1, 0, 1, 2]
    candidates = []
    is_integer = (b_val == int(b_val))
    is_strong = b_val in [1.0, 3.0]
    is_weak_int = b_val in [2.0, 4.0]
    root_pc = CHORD_MAP[chord_step]["root"] % 12
    for offset in offsets:
        idx = current_idx + offset
        if 0 <= idx < len(WHITE_KEYS):
            note = WHITE_KEYS[idx]
            note_pc = note % 12
            is_chord_tone = note_pc in [t % 12 for t in chord_tones]
            if is_integer:
                weight = 9 if is_chord_tone else 1 if is_strong else 8 if is_chord_tone else 2
            else:
                weight = 3 if is_chord_tone else 7
            if note_pc == 5:
                weight = max(1, int(weight * (0.5 if chord_step == "4" else 0.1)))
            interval_below = (root_pc - note_pc) % 12
            if interval_below in [3, 4]:
                weight = max(1, int(weight * 0.2))
            candidates.extend([note] * weight)
    return rng.choice(candidates) if candidates else prev_note

def calculate_balanced_sub_note(lead_note, chord_tones, rng):
    lead_pc = lead_note % 12
    lead_role = next((i for i, t in enumerate(chord_tones) if (t % 12) == lead_pc), -1)
    chord_octaves = sorted(list({base + offset for base in chord_tones for offset in [-12, 0, 12]}))
    candidates = []
    for ct in chord_octaves:
        interval = lead_note - ct
        if 3 <= interval <= 9:
            ct_pc = ct % 12
            ct_role = next((i for i, t in enumerate(chord_tones) if (t % 12) == ct_pc), -1)
            if lead_role == 1 and ct_role == 1: continue
            if lead_role == 0 and ct_role == 0: continue
            candidates.append(ct)
    if candidates:
        sweet = [c for c in candidates if (lead_note - c) in [3, 4, 8, 9]]
        return rng.choice(sweet if sweet else candidates)
    return lead_note - 7

def generate_8bar_period(period_idx, chord_sequence, prob, rng):
    lead_events, sub_events = [], []
    phrase_rhythms, phrase_melodies = {}, {}
    presets = [[1.0, 1.5, 2.5, 3.0, 4.0], [1.0, 2.0, 2.5, 3.5, 4.0]]
    prev_note = 76
    for rel_bar in range(1, 9):
        global_bar_idx = period_idx * 8 + rel_bar
        chord_step = chord_sequence[(global_bar_idx - 1) % len(chord_sequence)]
        chord_info = CHORD_MAP.get(chord_step, CHORD_MAP["6"])
        chord_tones = list(chord_info["tones"])
        if rel_bar in [1, 2]:
            rhythm = generate_algorithmic_rhythm(rng) if rng.random() < prob else rng.choice(presets)
            phrase_rhythms[rel_bar] = rhythm
            events = [(b, get_next_lead_note(prev_note, b, chord_tones, chord_step, rng)) for b in rhythm]
            prev_note = events[-1][1] if events else prev_note
            phrase_melodies[rel_bar] = events
        elif rel_bar in [3, 4]:
            sec_bar = rel_bar - 2
            rhythm = phrase_rhythms[sec_bar]
            prev_step = chord_sequence[(global_bar_idx - 3) % len(chord_sequence)]
            shift = int((chord_info["root"] - CHORD_MAP[prev_step]["root"]) / 2)
            events = []
            for b, s_n in phrase_melodies[sec_bar]:
                idx = WHITE_KEYS.index(s_n) if s_n in WHITE_KEYS else 9
                target = WHITE_KEYS[max(0, min(len(WHITE_KEYS)-1, idx+shift))]
                events.append((b, get_next_lead_note(target, b, chord_tones, chord_step, rng)))
            phrase_melodies[rel_bar] = events
        elif rel_bar in [5, 6]:
            rhythm = generate_algorithmic_rhythm(rng)
            events = []
            for b in rhythm:
                n = get_next_lead_note(prev_note, b, chord_tones, chord_step, rng)
                events.append((b, n))
                prev_note = n
        elif rel_bar in [7, 8]:
            rhythm = [1.0, 3.0]
            events = []
            for b in rhythm:
                n = chord_tones[0]+12 if (rel_bar == 8 and b == 3.0 and rng.random() < 0.6) else get_next_lead_note(prev_note, b, chord_tones, chord_step, rng)
                events.append((b, n))
                prev_note = n
        for b, note in phrase_melodies.get(rel_bar, events):
            lead_events.append({"bar": rel_bar, "b": b, "n": note, "v": 105, "l": 0.22})
            if b == int(b):
                sub_events.append({"bar": rel_bar, "b": b, "n": calculate_balanced_sub_note(note, chord_tones, rng), "v": 78, "l": 0.25})
    return lead_events, sub_events

def mcp_call(method, params):
    payload = {"jsonrpc": "2.0", "id": int(time.time()*1000), "method": "tools/call", "params": {"name": method, "arguments": params}}
    req = urllib.request.Request(URL, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode('utf-8')).get("result", {})
    except Exception as e:
        print("[Error] connection issue:", e)
        return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-s", "--start-bar", type=int, default=${settings.startBar})
    parser.add_argument("-l", "--length", type=int, default=${settings.length})
    parser.add_argument("-c", "--chords", type=str, default="${settings.chords}")
    parser.add_argument("-p", "--prob", type=float, default=${settings.probAlgoRhythm})
    args = parser.parse_args()

    # Seed alignment using interactive frontend key
    rng = random.Random(${seed})
    chord_seq = list(args.chords)
    
    print("=== 🛠️ Scanning tracks from Ardour MCP... ===")
    track_res = mcp_call("tracks_list", {"includeHidden": True})
    tracks_list = []
    if track_res:
        if "content" in track_res:
            try: tracks_list = json.loads(track_res["content"][0]["text"]).get("tracks", [])
            except: pass
        if not tracks_list: tracks_list = track_res.get("tracks", [])
    
    track_id_map = {t["name"]: t["id"] for t in tracks_list}
    matched_ids = {}
    mapping_rules = {
        "lead": ["lead_main", "main_lead", "lead"],
        "sub": ["sub", "lead_sub"],
        "arp": ["arp", "pulse2", "danger"],
        "bass": ["bass", "wave", "drive"],
        "kick": ["kick", "drum_kick"],
        "snare": ["snare", "drum_snare"],
        "hihat": ["hihat", "hat", "drum_hat"],
    }
    for key, keywords in mapping_rules.items():
        for tname, tid in track_id_map.items():
            tname_lower = tname.lower()
            if key == "sub" and "sub" not in tname_lower: continue
            if key != "sub" and "sub" in tname_lower: continue
            if any(kw in tname_lower for kw in keywords):
                matched_ids[key] = tid
                print(f" -> Found matching track: {key} -> '{tname}' (ID: {tid})")
                break

    # Static backing track events compiler
    print(f"\\n=== Compose session starting (Chords: {args.chords}) ===")
    lead_ev, sub_ev = [], []
    if ${settings.phraseMode ? "True" : "False"}:
        num_periods = max(1, args.length // 8)
        for p in range(num_periods):
            p_lead, p_sub = generate_8bar_period(p, chord_seq, args.prob, rng)
            for ev in p_lead: lead_ev.append({**ev, "bar": ev["bar"] + p*8})
            for ev in p_sub: sub_ev.append({**ev, "bar": ev["bar"] + p*8})
    else:
        # Impro mode
        prev_note = 76
        presets = [[1.0, 1.5, 2.5, 3.0, 4.0], [1.0, 2.0, 2.5, 3.5, 4.0]]
        for bar in range(1, args.length + 1):
            chord = chord_seq[(bar-1)%len(chord_seq)]
            tones = list(CHORD_MAP.get(chord, CHORD_MAP["6"])["tones"])
            ry = generate_algorithmic_rhythm(rng) if rng.random() < args.prob else rng.choice(presets)
            for b in ry:
                n = get_next_lead_note(prev_note, b, tones, chord, rng)
                lead_ev.append({"bar": bar, "b": b, "n": n, "v": 105, "l": 0.22})
                if b == int(b):
                    sub_ev.append({"bar": bar, "b": b, "n": calculate_balanced_sub_note(n, tones, rng), "v": 78, "l": 0.25})
                prev_note = n

    midi_data = {"lead": lead_ev, "sub": sub_ev, "arp": [], "bass": [], "kick": [], "snare": [], "hihat": []}
    
    arp_step = 0
    for bar in range(1, args.length + 1):
        chord_step = chord_seq[(bar - 1) % len(chord_seq)]
        ctones = CHORD_MAP.get(chord_step, CHORD_MAP["6"])["tones"]
        root = CHORD_MAP.get(chord_step, CHORD_MAP["6"])["root"]
        
        # Arp
        for b in [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5]:
            midi_data["arp"].append({"bar": bar, "b": b, "n": ctones[arp_step % len(ctones)], "v": 62, "l": 0.15})
            arp_step += 1
            
        # Bass
        for b, n, v, l in [(1.0, root-12, 100, 0.18), (1.75, root, 88, 0.15), (2.5, root-12, 95, 0.18), (3.25, root+7-12, 85, 0.15), (4.0, root, 85, 0.18)]:
            midi_data["bass"].append({"bar": bar, "b": b, "n": n, "v": v, "l": l})
            
        # Drums
        midi_data["kick"].extend([{"bar": bar, "b": 1.0, "n": 60, "v": 110, "l": 0.08}, {"bar": bar, "b": 2.75, "n": 60, "v": 90, "l": 0.08}])
        midi_data["snare"].extend([{"bar": bar, "b": 2.0, "n": 60, "v": 95, "l": 0.15}, {"bar": bar, "b": 4.0, "n": 60, "v": 95, "l": 0.15}])
        for b in [1.5, 2.5, 3.5, 4.5]:
            midi_data["hihat"].append({"bar": bar, "b": b, "n": 72, "v": 72, "l": 0.02})

    for key, events in midi_data.items():
        tid = matched_ids.get(key)
        if not tid: continue
        print(f" -> Injecting track '{key}' to Ardour (from Bar {args.start_bar})")
        mcp_call("midi_note_import_json_to_new_region_bbt", {
            "trackId": tid,
            "name": f"Composer_Balanced_Gen_{args.chords}_Bar{args.start_bar}",
            "startBar": args.start_bar,
            "startBeat": 1.0,
            "endBar": args.start_bar + args.length,
            "endBeat": 1.0,
            "midi": {"channel_base": "one", "midi_events": events}
        })
        time.sleep(0.3)
    print("\\n=== 🎉 Dynamic session successfully synchronized with Ardour! ===")

if __name__ == "__main__":
    main()`;
  };

  const copyToClipboard = (text: string, setCopied: React.Dispatch<React.SetStateAction<boolean>>) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(getMidiJsonString());
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `8bit_composer_${settings.chords}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const downloadPython = () => {
    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(getPythonScriptString());
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `chiptune_composer.py`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div id="mcp-panel" className="bg-[#121214] border border-[#27272a] rounded-xl p-5 md:p-6 shadow-xl relative overflow-hidden">
      {/* Accent strip */}
      <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>

      <div className="flex items-center gap-3 mb-4">
        <Cpu className="w-5 h-5 text-amber-500" id="mcp-icon" />
        <h2 className="text-xs font-press-start text-white tracking-wide uppercase">
          Ardour MCP Sync Console
        </h2>
      </div>

      <p className="text-xs text-gray-400 mb-6 leading-relaxed font-mono">
        This console allows synchronizing the generated algorithmic MIDI regions directly into <b>Ardour DAW</b> via an active Model Context Protocol (MCP) server running on your local host (CORS bypassed locally).
      </p>

      {/* Target config */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1.5">
            Ardour MCP Endpoint URL
          </label>
          <div className="flex gap-2">
            <input
              id="mcp-server-url"
              type="text"
              className="flex-1 bg-[#1a1a1e] border border-[#2e2e33] rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
              placeholder="http://127.0.0.1:4820/mcp"
            />
            <button
              id="btn-scan-mcp"
              disabled={connecting}
              onClick={handleScanMcp}
              className="flex items-center gap-1.5 bg-[#1e1a14] border border-amber-900 text-amber-400 hover:bg-amber-900/20 rounded-lg px-4 py-1.5 text-xs font-mono transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${connecting ? 'animate-spin' : ''}`} />
              <span>SCAN ARDOUR</span>
            </button>
          </div>
        </div>

        {/* Visual feedback */}
        {mcpStatus.message && (
          <div
            id="mcp-feedback-banner"
            className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs font-mono leading-relaxed ${
              mcpStatus.type === 'success'
                ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400'
                : mcpStatus.type === 'error'
                ? 'bg-red-950/20 border-red-900 text-red-400'
                : 'bg-zinc-900 border-zinc-800 text-gray-300'
            }`}
          >
            {mcpStatus.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />}
            {mcpStatus.type === 'success' && <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />}
            <span className="flex-1">{mcpStatus.message}</span>
          </div>
        )}

        {/* Active track mapping section under scanned success */}
        {connectedTracks.length > 0 && (
          <div className="bg-[#18181b] p-3 border border-zinc-800 rounded-lg space-y-3.5" id="alignment-map">
            <legend className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
              Aligned MIDI Ingress Track Matrix
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tracks.map((track) => (
                <div key={track.id} className="flex items-center justify-between gap-2 bg-[#121214] px-2.5 py-1.5 rounded border border-zinc-900">
                  <span className="text-xs font-mono text-gray-300 flex items-center gap-1.5 capitalize">
                    <span className={`w-2 h-2 rounded-full ${track.activeColor}`}></span>
                    {track.id}
                  </span>
                  
                  {/* Select binding */}
                  <select
                    id={`binding-select-${track.id}`}
                    value={trackBindings[track.id] || ''}
                    onChange={(e) => setTrackBindings((prev) => ({ ...prev, [track.id]: e.target.value }))}
                    className="bg-[#1a1a1e] text-[10px] text-gray-300 font-mono border border-zinc-800 rounded py-0.5 px-2 focus:outline-none focus:border-amber-500 max-w-[120px]"
                  >
                    <option value="">(Skip Track)</option>
                    {connectedTracks.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Sync trigger button */}
            <button
              id="btn-sync-to-mcp"
              disabled={connecting}
              onClick={handleExportMcp}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg py-2 text-xs font-mono tracking-wide uppercase transition-all active:scale-97 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>SYNC TO ACTIVE ARDOUR SESSION</span>
            </button>
          </div>
        )}
      </div>

      {/* Fallback code exporters tabs */}
      <div className="border-t border-[#1d1d21] pt-6 space-y-4">
        <h3 className="text-[10px] font-press-start text-gray-500 uppercase block tracking-wider">
          Export & Fallback Exporters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Download Raw MIDI JSON */}
          <button
            id="btn-download-json"
            onClick={downloadJson}
            className="flex items-center justify-center gap-2 bg-[#18181b] border border-[#27272a] hover:border-zinc-700 text-gray-300 rounded-lg p-3 text-xs font-mono transition-all active:scale-95 text-center"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <div className="text-left leading-tight">
              <span className="block font-bold text-white">MIDI JSON</span>
              <span className="text-[10px] text-zinc-500 block mt-0.5">Download structure</span>
            </div>
          </button>

          {/* Download Python Script */}
          <button
            id="btn-download-python"
            onClick={downloadPython}
            className="flex items-center justify-center gap-2 bg-[#18181b] border border-[#27272a] hover:border-zinc-700 text-gray-300 rounded-lg p-3 text-xs font-mono transition-all active:scale-95 text-center"
          >
            <FileCode className="w-4 h-4 text-emerald-400" />
            <div className="text-left leading-tight">
              <span className="block font-bold text-white">PYTHON SCRIPT</span>
              <span className="text-[10px] text-zinc-500 block mt-0.5">Download script.py</span>
            </div>
          </button>

          {/* Copy Python to Clipboard */}
          <button
            id="btn-copy-python"
            onClick={() => copyToClipboard(getPythonScriptString(), setCopiedScript)}
            className="flex items-center justify-center gap-2 bg-[#18181b] border border-[#27272a] hover:border-zinc-700 text-gray-300 rounded-lg p-3 text-xs font-mono transition-all active:scale-95 text-center"
          >
            {copiedScript ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
            <div className="text-left leading-tight">
              <span className="block font-bold text-white">COPY PYTHON</span>
              <span className="text-[10px] text-zinc-500 block mt-0.5">
                {copiedScript ? 'Copied script!' : 'Copy to clipboard'}
              </span>
            </div>
          </button>
        </div>

        <p className="text-[11px] text-gray-500 font-mono leading-relaxed mt-2.5">
          * If your browser blocks local network CORS, download <code>chiptune_composer.py</code> and execute it directly in your terminal to bypass restrictions: <code>python chiptune_composer.py -l {settings.length} -c {settings.chords}</code>
        </p>
      </div>
    </div>
  );
};
export default McpPanel;
