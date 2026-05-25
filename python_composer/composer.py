# Core Algorithmic Chiptune Composition and Harmony Modules
from .consts import WHITE_KEYS, CHORD_MAP

def generate_algorithmic_rhythm(rng):
    """
    Generates a chiptune rhythm map based on standard division weights and probabilistic 16th syncopes.
    """
    beats = []
    grid_probs = {1.0: 0.95, 1.5: 0.30, 2.0: 0.75, 2.5: 0.30, 3.0: 0.85, 3.5: 0.30, 4.0: 0.75, 4.5: 0.40}
    for b, prob in grid_probs.items():
        if rng.random() < prob: 
            beats.append(b)
            
    isolated_16ths = [1.25, 1.75, 2.25, 2.75, 3.25, 3.75, 4.25, 4.75]
    for b in isolated_16ths:
        if rng.random() < 0.06: 
            beats.append(b)
            
    if not beats: 
        beats.append(1.0)
        
    decorated_beats = list(beats)
    for b in beats:
        if b == int(b) or (b * 2) == int(b * 2):
            if rng.random() < 0.06:
                double_tap = b + 0.25
                if double_tap <= 4.75: 
                    decorated_beats.append(double_tap)
                    
    return sorted(list(set(decorated_beats)))


def get_next_lead_note(prev_note, b_val, chord_tones, chord_step, rng):
    """
    Selects the next melodic lead note conforming to the current chord map step and transition weights.
    """
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
                # Penalty penalty for F note in non-F chord
                weight = max(1, int(weight * (0.5 if chord_step == "4" else 0.1)))
                
            interval_below = (root_pc - note_pc) % 12
            if interval_below in [3, 4]:
                # Avoid note lying a 3rd below chord root
                weight = max(1, int(weight * 0.2))
                
            candidates.extend([note] * weight)
            
    return rng.choice(candidates) if candidates else prev_note


def calculate_balanced_sub_note(lead_note, chord_tones, rng):
    """
    Calculates a sweet harmonic second voice/counterpoint sub note based on consonance.
    """
    lead_pc = lead_note % 12
    lead_role = next((i for i, t in enumerate(chord_tones) if (t % 12) == lead_pc), -1)
    
    chord_octaves = sorted(list({base + offset for base in chord_tones for offset in [-12, 0, 12]}))
    candidates = []
    
    for ct in chord_octaves:
        interval = lead_note - ct
        if 3 <= interval <= 9:
            ct_pc = ct % 12
            ct_role = next((i for i, t in enumerate(chord_tones) if (t % 12) == ct_pc), -1)
            if lead_role == 1 and ct_role == 1: 
                continue
            if lead_role == 0 and ct_role == 0: 
                continue
            candidates.append(ct)
            
    if candidates:
        sweet = [c for c in candidates if (lead_note - c) in [3, 4, 8, 9]]
        return rng.choice(sweet if sweet else candidates)
        
    return lead_note - 7


def generate_8bar_period(period_idx, chord_sequence, prob, rng):
    """
    Generates a structured 8-bar period complete with exposition, variation, contrast, and home-run cadence.
    """
    lead_events, sub_events = [], []
    phrase_rhythms, phrase_melodies = {}, {}
    presets = [[1.0, 1.5, 2.5, 3.0, 4.0], [1.0, 2.0, 2.5, 3.5, 4.0]]
    prev_note = 76
    
    for rel_bar in range(1, 9):
        global_bar_idx = period_idx * 8 + rel_bar
        chord_step = chord_sequence[(global_bar_idx - 1) % len(chord_sequence)]
        chord_info = CHORD_MAP.get(chord_step, CHORD_MAP["6"])
        chord_tones = list(chord_info["tones"])
        
        events = []
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
            phrase_melodies[rel_bar] = events
        elif rel_bar in [7, 8]:
            if rel_bar == 8:
                options = [
                    [1.0],                  # Majestic whole note
                    [1.0, 3.0],             # Classic power half notes
                    [1.0, 2.0, 3.0],        # Simple building-block motif resolution
                    [1.0, 2.0, 3.0, 4.0]    # Straight quarter note resolution walk
                ]
                rhythm = rng.choice(options)
            else:
                # Bar 7 tension build: simplified rhythm with mostly solid integer beats and rare eighth-note subdivisions
                beats = []
                grid = [1.0, 2.0, 3.0, 4.0]
                for b in grid:
                    prob_val = 0.90 if b in [1.0, 3.0] else 0.65
                    if rng.random() < prob_val:
                        beats.append(b)
                
                divisions = [1.5, 2.5, 3.5, 4.5]
                for div in divisions:
                    if rng.random() < 0.20:
                        beats.append(div)
                
                if not beats:
                    beats.append(1.0)
                rhythm = sorted(list(set(beats)))
                
            events = []
            for r_idx, b in enumerate(rhythm):
                is_last_note_of_bar8 = (rel_bar == 8 and r_idx == len(rhythm) - 1)
                if is_last_note_of_bar8:
                    # Absolute harmonic resolve: anchor to chord root or fifth
                    if len(chord_tones) > 2 and rng.random() < 0.35:
                        n = chord_tones[2] + 12
                    else:
                        n = chord_tones[0] + 12
                else:
                    n = get_next_lead_note(prev_note, b, chord_tones, chord_step, rng)
                events.append((b, n))
                prev_note = n
            phrase_melodies[rel_bar] = events
            
        for b, note in phrase_melodies.get(rel_bar, events):
            lead_events.append({"bar": rel_bar, "b": b, "n": note, "v": 105, "l": 0.22})
            if b == int(b):
                sub_events.append({
                    "bar": rel_bar, 
                    "b": b, 
                    "n": calculate_balanced_sub_note(note, chord_tones, rng), 
                    "v": 78, 
                    "l": 0.25
                })
                
    return lead_events, sub_events
