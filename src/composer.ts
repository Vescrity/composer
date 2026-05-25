import { MidiEvent, MidiData, ChordDetails, TrackType } from './types';

// White keys in C major / A minor (Octaves 4 to 6)
export const WHITE_KEYS = [
  60, 62, 64, 65, 67, 69, 71, // Octave 4: C4 to B4
  72, 74, 76, 77, 79, 81, 83, // Octave 5: C5 to B5
  84, 86, 88, 89, 91, 93, 95  // Octave 6: C6 to B6
];

export const CHORD_MAP: Record<string, ChordDetails> = {
  "1": { name: "C",   root: 48, tones: [48, 52, 55], seventh: 59 },
  "2": { name: "Dm",  root: 50, tones: [50, 53, 57], seventh: 60 },
  "3": { name: "Em",  root: 52, tones: [52, 55, 59], seventh: 62 },
  "4": { name: "F",   root: 53, tones: [53, 57, 60], seventh: 64 },
  "5": { name: "G",   root: 55, tones: [55, 59, 62], seventh: 65 },
  "6": { name: "Am",  root: 57, tones: [57, 60, 64], seventh: 67 }
};

/**
 * Custom seedable random function using Mulberry32.
 * Allows reproducible compositions.
 */
export function createSeededRandom(seed: number) {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generates an algorithmic rhythm for a single bar
export function generateAlgorithmicRhythm(rng: () => number) {
  const beats: number[] = [];

  const gridProbs: Record<number, number> = {
    1.0: 0.95, // Strong beat 1.0 (95%)
    1.5: 0.30, // Weak half-beat 1.5 (30%)
    2.0: 0.75, // Weak beat 2.0 (75%)
    2.5: 0.30, // Weak half-beat 2.5 (30%)
    3.0: 0.85, // Strong beat 3.0 (85%)
    3.5: 0.30, // Weak half-beat 3.5 (30%)
    4.0: 0.75, // Weak beat 4.0 (75%)
    4.5: 0.40  // Cadence end beat 4.5 (40%)
  };

  Object.entries(gridProbs).forEach(([bStr, prob]) => {
    const b = parseFloat(bStr);
    if (rng() < prob) {
      beats.push(b);
    }
  });

  // Isolated 16th syncopations with a tiny probability (6%)
  const isolated16ths = [1.25, 1.75, 2.25, 2.75, 3.25, 3.75, 4.25, 4.75];
  isolated16ths.forEach((b) => {
    if (rng() < 0.06) {
      beats.push(b);
    }
  });

  // Safe fallback to prevent an empty bar
  if (beats.length === 0) {
    beats.push(1.0);
  }

  // Ta-da double-strike decoration (6% probability of adding a 16th-note click)
  const decoratedBeats = [...beats];
  beats.forEach((b) => {
    // Only decorate on solid integer beats or half beats to prevent 32nd note overlapping
    if (b === Math.floor(b) || (b * 2) === Math.floor(b * 2)) {
      if (rng() < 0.06) {
        const doubleTap = b + 0.25;
        if (doubleTap <= 4.75) {
          decoratedBeats.push(doubleTap);
        }
      }
    }
  });

  // Remove duplicates and sort
  return Array.from(new Set(decoratedBeats)).sort((a, b) => a - b);
}

// Logic to select the next lead note conforming to the chord structure
export function getNextLeadNote(
  prevNote: number,
  bVal: number,
  chordTones: number[],
  chordStep: string,
  rng: () => number
): number {
  let matchedPrev = prevNote;
  if (!WHITE_KEYS.includes(prevNote)) {
    // Find closest white key
    matchedPrev = WHITE_KEYS.reduce((prev, curr) => 
      Math.abs(curr - prevNote) < Math.abs(prev - prevNote) ? curr : prev
    , WHITE_KEYS[0]);
  }

  const currentIdx = WHITE_KEYS.indexOf(matchedPrev);
  const offsets = [-2, -1, 0, 1, 2];
  const candidates: number[] = [];

  const isInteger = bVal === Math.floor(bVal);
  const isStrong = bVal === 1.0 || bVal === 3.0;
  const isWeakInt = bVal === 2.0 || bVal === 4.0;

  const chordInfo = CHORD_MAP[chordStep] || CHORD_MAP["6"];
  const rootPc = chordInfo.root % 12;

  offsets.forEach((offset) => {
    const idx = currentIdx + offset;
    if (idx >= 0 && idx < WHITE_KEYS.length) {
      const note = WHITE_KEYS[idx];
      const notePc = note % 12;
      const isChordTone = chordTones.some(t => (t % 12) === notePc);

      let weight = 1;
      if (isInteger) {
        if (isStrong) {
          weight = isChordTone ? 9 : 1;
        } else if (isWeakInt) {
          weight = isChordTone ? 8 : 2;
        }
      } else {
        weight = isChordTone ? 3 : 7;
      }

      // Avoid "F" note penalty under certain circumstances
      if (notePc === 5) {
        if (chordStep !== "4") {
          weight = Math.max(1, Math.floor(weight * 0.1));
        } else {
          weight = Math.max(1, Math.floor(weight * 0.5));
        }
      }

      // Avoid note lying a 3rd below chord root
      const intervalBelow = (rootPc - notePc + 12) % 12;
      if (intervalBelow === 3 || intervalBelow === 4) {
        weight = Math.max(1, Math.floor(weight * 0.2));
      }

      // Populate candidate drawer
      for (let w = 0; w < weight; w++) {
        candidates.push(note);
      }
    }
  });

  if (candidates.length > 0) {
    const rIdx = Math.floor(rng() * candidates.length);
    return candidates[rIdx];
  }

  return matchedPrev;
}

// Calculate the balanced counterpoint note for sub-melody
export function calculateBalancedSubNote(
  leadNote: number,
  chordTones: number[],
  rng: () => number
): number {
  const leadPc = leadNote % 12;
  let leadRole = -1;

  for (let i = 0; i < chordTones.length; i++) {
    if ((chordTones[i] % 12) === leadPc) {
      leadRole = i;
      break;
    }
  }

  // Gather chord octaves
  const chordOctavesSet = new Set<number>();
  chordTones.forEach((base) => {
    chordOctavesSet.add(base - 12);
    chordOctavesSet.add(base);
    chordOctavesSet.add(base + 12);
  });
  const chordOctaves = Array.from(chordOctavesSet).sort((a, b) => a - b);

  const candidates: number[] = [];
  chordOctaves.forEach((ct) => {
    const interval = leadNote - ct;
    // Harmonic interval must be sweet and balanced (between wide 3rd and minor 6th)
    if (interval >= 3 && interval <= 9) {
      const ctPc = ct % 12;
      let ctRole = -1;
      for (let i = 0; i < chordTones.length; i++) {
        if ((chordTones[i] % 12) === ctPc) {
          ctRole = i;
          break;
        }
      }

      // Avoid overlapping functions (parallel chord members)
      if (leadRole === 1 && ctRole === 1) return;
      if (leadRole === 0 && ctRole === 0) return;

      candidates.push(ct);
    }
  });

  if (candidates.length > 0) {
    // Prefer sweet musical consonant intervals (3rds, 4ths, 5ths, 6ths: offsets of 3, 4, 8, 9 semitones)
    const sweetCandidates = candidates.filter(c => {
      const diff = leadNote - c;
      return diff === 3 || diff === 4 || diff === 8 || diff === 9;
    });

    if (sweetCandidates.length > 0) {
      const rIdx = Math.floor(rng() * sweetCandidates.length);
      return sweetCandidates[rIdx];
    }

    const rIdx = Math.floor(rng() * candidates.length);
    return candidates[rIdx];
  }

  return leadNote - 7; // Default fallback to a perfect fifth below
}

// === Mode A: 8-Bar Structured Motif Phrase Generator ===
export function generate8BarPeriod(
  periodIdx: number,
  chordSequence: string[],
  probAlgoRhythm: number,
  rng: () => number
) {
  const leadEvents: MidiEvent[] = [];
  const subEvents: MidiEvent[] = [];

  const phraseRhythms: Record<number, number[]> = {};
  const phraseMelodies: Record<number, { b: number; n: number }[]> = {};

  const presetRhythmPatterns = [
    [1.0, 1.5, 2.5, 3.0, 4.0],
    [1.0, 2.0, 2.5, 3.5, 4.0]
  ];

  let prevNote = 76; // Start around E5

  for (let relBar = 1; relBar <= 8; relBar++) {
    const globalBarIdx = periodIdx * 8 + relBar;
    const chordStep = chordSequence[(globalBarIdx - 1) % chordSequence.length];
    const chordInfo = CHORD_MAP[chordStep] || CHORD_MAP["6"];
    const chordTones = [...chordInfo.tones];

    let barMelody: { b: number; n: number }[] = [];

    // Bars 1-2: Statement / Exposition
    if (relBar === 1 || relBar === 2) {
      let rhythm: number[];
      if (rng() < probAlgoRhythm) {
        rhythm = generateAlgorithmicRhythm(rng);
      } else {
        const idx = Math.floor(rng() * presetRhythmPatterns.length);
        rhythm = presetRhythmPatterns[idx];
      }
      phraseRhythms[relBar] = rhythm;

      const events: { b: number; n: number }[] = [];
      rhythm.forEach((bVal) => {
        const note = getNextLeadNote(prevNote, bVal, chordTones, chordStep, rng);
        events.push({ b: bVal, n: note });
        prevNote = note;
      });
      phraseMelodies[relBar] = events;
      barMelody = events;
    }
    // Bars 3-4: Sequential Progression of previous idea
    else if (relBar === 3 || relBar === 4) {
      const sourceBar = relBar - 2;
      const rhythm = phraseRhythms[sourceBar] || [1.0, 2.0, 3.0, 4.0];
      const sourceEvents = phraseMelodies[sourceBar] || [];

      const prevChordStep = chordSequence[(globalBarIdx - 3) % chordSequence.length];
      const prevChord = CHORD_MAP[prevChordStep] || CHORD_MAP["6"];
      const rootDiff = chordInfo.root - prevChord.root;
      // Map difference approx to scale steps (semitone step ratio roughly 2 per scale index)
      const shiftSteps = Math.floor(rootDiff / 2);

      const events: { b: number; n: number }[] = [];
      sourceEvents.forEach(({ b, n: sNote }) => {
        const idx = WHITE_KEYS.includes(sNote) ? WHITE_KEYS.indexOf(sNote) : 9;
        const targetIdx = Math.max(0, Math.min(WHITE_KEYS.length - 1, idx + shiftSteps));
        let targetNote = WHITE_KEYS[targetIdx];
        targetNote = getNextLeadNote(targetNote, b, chordTones, chordStep, rng);
        events.push({ b, n: targetNote });
      });
      phraseMelodies[relBar] = events;
      barMelody = events;
    }
    // Bars 5-6: Contrast
    else if (relBar === 5 || relBar === 6) {
      const rhythm = generateAlgorithmicRhythm(rng);
      const events: { b: number; n: number }[] = [];
      rhythm.forEach((bVal) => {
        const note = getNextLeadNote(prevNote, bVal, chordTones, chordStep, rng);
        events.push({ b: bVal, n: note });
        prevNote = note;
      });
      barMelody = events;
    }
    // Bars 7-8: Resolution / Cadence
    else if (relBar === 7 || relBar === 8) {
      let rhythm: number[];
      if (relBar === 8) {
        // Classic pleasant final bar endings
        const options = [
          [1.0], // Majestic whole note
          [1.0, 3.0], // Classic power half notes
          [1.0, 2.0, 3.0], // Simple building-block motif resolution
          [1.0, 2.0, 3.0, 4.0] // Straight quarter note resolution walk
        ];
        rhythm = options[Math.floor(rng() * options.length)];
      } else {
        // Bar 7 tension build: simplified rhythm with mostly solid integer beats and rare eighth-note subdivisions
        const beats: number[] = [];
        const grid = [1.0, 2.0, 3.0, 4.0];
        grid.forEach((b) => {
          if (rng() < (b === 1.0 || b === 3.0 ? 0.90 : 0.65)) {
            beats.push(b);
          }
        });
        
        // Soft touch of division eighth-notes
        const divisions = [1.5, 2.5, 3.5, 4.5];
        divisions.forEach((div) => {
          if (rng() < 0.20) {
            beats.push(div);
          }
        });
        
        if (beats.length === 0) beats.push(1.0);
        rhythm = Array.from(new Set(beats)).sort((a, b) => a - b);
      }

      const events: { b: number; n: number }[] = [];
      rhythm.forEach((bVal, rIndex) => {
        let note: number;
        const isLastNoteOfBar8 = relBar === 8 && rIndex === rhythm.length - 1;
        
        if (isLastNoteOfBar8) {
          // Absolute harmonic resolve: anchor to chord root or fifth
          note = rng() < 0.65 ? chordTones[0] + 12 : (chordTones[2] ? chordTones[2] + 12 : chordTones[0] + 12);
        } else {
          note = getNextLeadNote(prevNote, bVal, chordTones, chordStep, rng);
        }
        events.push({ b: bVal, n: note });
        prevNote = note;
      });
      barMelody = events;
    }

    // Export melody and counterpoint events
    barMelody.forEach(({ b: bVal, n: note }) => {
      leadEvents.push({
        bar: relBar,
        b: bVal,
        n: note,
        v: 105,
        l: 0.22,
        id: `lead-${periodIdx}-${relBar}-${bVal}`
      });

      // Insert counterpoint sub note on integer beats
      if (bVal === Math.floor(bVal)) {
        const subNote = calculateBalancedSubNote(note, chordTones, rng);
        subEvents.push({
          bar: relBar,
          b: bVal,
          n: subNote,
          v: 78,
          l: 0.25,
          id: `sub-${periodIdx}-${relBar}-${bVal}`
        });
      }
    });
  }

  return { leadEvents, subEvents };
}

// === Mode B: Pure Direct Bar-By-Bar Improvisation ===
export function generateBarByBarMidi(
  length: number,
  chordSequence: string[],
  probAlgoRhythm: number,
  rng: () => number
) {
  const leadEvents: MidiEvent[] = [];
  const subEvents: MidiEvent[] = [];

  const presetRhythmPatterns = [
    [1.0, 1.5, 2.5, 3.0, 4.0],
    [1.0, 2.0, 2.5, 3.5, 4.0],
    [1.0, 1.5, 2.0, 3.0, 3.5, 4.0]
  ];

  let prevNote = 76; // Center E5

  for (let localBar = 1; localBar <= length; localBar++) {
    const chordStep = chordSequence[(localBar - 1) % chordSequence.length];
    const chordInfo = CHORD_MAP[chordStep] || CHORD_MAP["6"];
    const chordTones = [...chordInfo.tones];

    let selectedRhythm: number[];
    if (rng() < probAlgoRhythm) {
      selectedRhythm = generateAlgorithmicRhythm(rng);
    } else {
      const idx = Math.floor(rng() * presetRhythmPatterns.length);
      selectedRhythm = presetRhythmPatterns[idx];
    }

    const barMelody: { b: number; n: number }[] = [];
    selectedRhythm.forEach((bVal) => {
      const note = getNextLeadNote(prevNote, bVal, chordTones, chordStep, rng);
      leadEvents.push({
        bar: localBar,
        b: bVal,
        n: note,
        v: 105,
        l: 0.22,
        id: `lead-imp-${localBar}-${bVal}`
      });
      barMelody.push({ b: bVal, n: note });
      prevNote = note;
    });

    barMelody.forEach(({ b: bVal, n: leadNote }) => {
      if (bVal === Math.floor(bVal)) {
        const subNote = calculateBalancedSubNote(leadNote, chordTones, rng);
        subEvents.push({
          bar: localBar,
          b: bVal,
          n: subNote,
          v: 78,
          l: 0.25,
          id: `sub-imp-${localBar}-${bVal}`
        });
      }
    });
  }

  return { leadEvents, subEvents };
}

// === Master Algorithmic Composer Dispatcher ===
export function generateAlgorithmicMidi(
  length: number,
  chordSeqStr: string,
  probAlgoRhythm: number,
  phraseMode: boolean,
  seed: number
): MidiData {
  const chordSequence = Array.from(chordSeqStr);
  const rng = createSeededRandom(seed);

  const lead: MidiEvent[] = [];
  const sub: MidiEvent[] = [];
  const arp: MidiEvent[] = [];
  const bass: MidiEvent[] = [];
  const kick: MidiEvent[] = [];
  const snare: MidiEvent[] = [];
  const hihat: MidiEvent[] = [];

  let arpStep = 0;

  if (phraseMode) {
    const numPeriods = Math.max(1, Math.floor(length / 8));
    for (let pIdx = 0; pIdx < numPeriods; pIdx++) {
      const { leadEvents, subEvents } = generate8BarPeriod(pIdx, chordSequence, probAlgoRhythm, rng);
      const barOffset = pIdx * 8;

      leadEvents.forEach((ev) => {
        lead.push({
          ...ev,
          bar: ev.bar + barOffset
        });
      });

      subEvents.forEach((ev) => {
        sub.push({
          ...ev,
          bar: ev.bar + barOffset
        });
      });
    }
  } else {
    const { leadEvents, subEvents } = generateBarByBarMidi(length, chordSequence, probAlgoRhythm, rng);
    lead.push(...leadEvents);
    sub.push(...subEvents);
  }

  // Generate accompanying backing tracks
  for (let globalBar = 1; globalBar <= length; globalBar++) {
    const chordStep = chordSequence[(globalBar - 1) % chordSequence.length];
    const chordInfo = CHORD_MAP[chordStep] || CHORD_MAP["6"];
    const chordTones = [...chordInfo.tones];
    const root = chordInfo.root;

    // Mid-frequency Arpeggiator (retro 8-bit chip feel)
    const beatsArp = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5];
    beatsArp.forEach((beat) => {
      const noteToPlay = chordTones[arpStep % chordTones.length];
      arp.push({
        bar: globalBar,
        b: beat,
        n: noteToPlay,
        v: 62,
        l: 0.15,
        id: `arp-${globalBar}-${beat}`
      });
      arpStep++;
    });

    // Retro walking bass
    const bassbeats = [
      { b: 1.0, n: root - 12, v: 100, l: 0.18 },
      { b: 1.75, n: root, v: 88, l: 0.15 },
      { b: 2.5, n: root - 12, v: 95, l: 0.18 },
      { b: 3.25, n: root + 7 - 12, v: 85, l: 0.15 },
      { b: 4.0, n: root, v: 85, l: 0.18 }
    ];
    bassbeats.forEach(({ b, n, v, l }) => {
      bass.push({
        bar: globalBar,
        b,
        n,
        v,
        l,
        id: `bass-${globalBar}-${b}`
      });
    });

    // 8-bit synthetic drums
    // Kick drum
    kick.push(
      { bar: globalBar, b: 1.0, n: 60, v: 110, l: 0.08, id: `kick-${globalBar}-1.0` },
      { bar: globalBar, b: 2.75, n: 60, v: 90, l: 0.08, id: `kick-${globalBar}-2.75` }
    );

    // Snare drum
    snare.push(
      { bar: globalBar, b: 2.0, n: 60, v: 95, l: 0.15, id: `snare-${globalBar}-2.0` },
      { bar: globalBar, b: 4.0, n: 60, v: 95, l: 0.15, id: `snare-${globalBar}-4.0` }
    );

    // Hihat clicks
    const hihatSteps = [1.5, 2.5, 3.5, 4.5];
    hihatSteps.forEach((beat) => {
      hihat.push({
        bar: globalBar,
        b: beat,
        n: 72,
        v: 72,
        l: 0.02,
        id: `hihat-${globalBar}-${beat}`
      });
    });
  }

  return { lead, sub, arp, bass, kick, snare, hihat };
}
