#!/usr/bin/env python3
# 8-Bit Chiptune Algorithmic Composer CLI Workstation Entry Point

import argparse
import random
import json
import time

from .consts import CHORD_MAP
from .composer import generate_algorithmic_rhythm, get_next_lead_note, calculate_balanced_sub_note, generate_8bar_period
from .mcp_client import call_mcp

def main():
    parser = argparse.ArgumentParser(description="8-Bit Chiptune Algorithmic Composer Workstation CLI")
    parser.add_argument("-s", "--start-bar", type=int, default=1, help="Starting bar in Ardour")
    parser.add_argument("-l", "--length", type=int, default=8, help="Composition sequence length in bars")
    parser.add_argument("-c", "--chords", type=str, default="4536", help="Active J-Pop style chord keys sequence")
    parser.add_argument("-p", "--prob", type=float, default=0.5, help="Algorithmic rhythm weights frequency")
    parser.add_argument("-u", "--url", type=str, default="http://127.0.0.1:4820/mcp", help="Ardour MCP service url")
    parser.add_argument("--seed", type=int, default=4536, help="Repeatable random seed input")
    parser.add_argument("--no-phrase", action="store_true", help="Disables structured 8-bar period phrase generator")
    args = parser.parse_args()

    # Seed alignment for exact reproducibility
    rng = random.Random(args.seed)
    chord_seq = list(args.chords)
    
    print("=== 🛠️ Scanning tracks from Ardour MCP... ===")
    track_res = call_mcp(args.url, "tracks_list", {"includeHidden": True})
    tracks_list = []
    if track_res:
        if "content" in track_res:
            try: 
                tracks_list = json.loads(track_res["content"][0]["text"]).get("tracks", [])
            except Exception: 
                pass
        if not tracks_list: 
            tracks_list = track_res.get("tracks", [])
    
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
            if key == "sub" and "sub" not in tname_lower: 
                continue
            if key != "sub" and "sub" in tname_lower: 
                continue
            if any(kw in tname_lower for kw in keywords):
                matched_ids[key] = tid
                print(f" -> Found matching track: {key} -> '{tname}' (ID: {tid})")
                break

    print(f"\n=== Compose session starting (Chords: {args.chords}) ===")
    lead_ev, sub_ev = [], []
    phrase_mode = not args.no_phrase

    if phrase_mode:
        num_periods = max(1, args.length // 8)
        for p in range(num_periods):
            p_lead, p_sub = generate_8bar_period(p, chord_seq, args.prob, rng)
            for ev in p_lead: 
                lead_ev.append({**ev, "bar": ev["bar"] + p * 8})
            for ev in p_sub: 
                sub_ev.append({**ev, "bar": ev["bar"] + p * 8})
    else:
        # Impro mode
        prev_note = 76
        presets = [[1.0, 1.5, 2.5, 3.0, 4.0], [1.0, 2.0, 2.5, 3.5, 4.0]]
        for bar in range(1, args.length + 1):
            chord = chord_seq[(bar - 1) % len(chord_seq)]
            tones = list(CHORD_MAP.get(chord, CHORD_MAP["6"])["tones"])
            ry = generate_algorithmic_rhythm(rng) if rng.random() < args.prob else rng.choice(presets)
            for b in ry:
                n = get_next_lead_note(prev_note, b, tones, chord, rng)
                lead_ev.append({"bar": bar, "b": b, "n": n, "v": 105, "l": 0.22})
                if b == int(b):
                    sub_ev.append({
                        "bar": bar, 
                        "b": b, 
                        "n": calculate_balanced_sub_note(n, tones, rng), 
                        "v": 78, 
                        "l": 0.25
                    })
                prev_note = n

    midi_data = {"lead": lead_ev, "sub": sub_ev, "arp": [], "bass": [], "kick": [], "snare": [], "hihat": []}
    
    arp_step = 0
    for bar in range(1, args.length + 1):
        chord_step = chord_seq[(bar - 1) % len(chord_seq)]
        ctones = CHORD_MAP.get(chord_step, CHORD_MAP["6"])["tones"]
        root = CHORD_MAP.get(chord_step, CHORD_MAP["6"])["root"]
        
        # Arpeggiator
        for b in [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5]:
            midi_data["arp"].append({
                "bar": bar, 
                "b": b, 
                "n": ctones[arp_step % len(ctones)], 
                "v": 62, 
                "l": 0.15
            })
            arp_step += 1
            
        # Bassline
        bass_patterns = [
            (1.0, root - 12, 100, 0.18), 
            (1.75, root, 88, 0.15), 
            (2.5, root - 12, 95, 0.18), 
            (3.25, root + 7 - 12, 85, 0.15), 
            (4.0, root, 85, 0.18)
        ]
        for b, n, v, l in bass_patterns:
            midi_data["bass"].append({"bar": bar, "b": b, "n": n, "v": v, "l": l})
            
        # Drums - Bass/Snare/Hihat clicks
        midi_data["kick"].extend([
            {"bar": bar, "b": 1.0, "n": 60, "v": 110, "l": 0.08}, 
            {"bar": bar, "b": 2.75, "n": 60, "v": 90, "l": 0.08}
        ])
        midi_data["snare"].extend([
            {"bar": bar, "b": 2.0, "n": 60, "v": 95, "l": 0.15}, 
            {"bar": bar, "b": 4.0, "n": 60, "v": 95, "l": 0.15}
        ])
        for b in [1.5, 2.5, 3.5, 4.5]:
            midi_data["hihat"].append({"bar": bar, "b": b, "n": 72, "v": 72, "l": 0.02})

    for key, events in midi_data.items():
        tid = matched_ids.get(key)
        if not tid: 
            continue
        print(f" -> Injecting track '{key}' to Ardour (from Bar {args.start_bar})")
        call_mcp(args.url, "midi_note_import_json_to_new_region_bbt", {
            "trackId": tid,
            "name": f"Composer_Balanced_Gen_{args.chords}_Bar{args.start_bar}",
            "startBar": args.start_bar,
            "startBeat": 1.0,
            "endBar": args.start_bar + args.length,
            "endBeat": 1.0,
            "midi": {"channel_base": "one", "midi_events": events}
        })
        time.sleep(0.3)
        
    print("\n=== 🎉 Dynamic session successfully synchronized with Ardour! ===")

if __name__ == "__main__":
    main()
