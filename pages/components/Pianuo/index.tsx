import React, { FC, KeyboardEvent, useEffect, useState } from "react";

import styles from './styles.module.scss';

// ############################################################

const A_4_PITCH = 440;
const A_4_POSITION = 49;
// https://en.wikipedia.org/wiki/Equal_temperament#Mathematics
const SEMITONE_WIDTH = 2 ** (1 / 12);

const notes = [ 'A', 'B', 'C', 'D', 'E', 'F', 'G' ] as const;
const octaves = [ '0', '1', '2', '3', '4', '5', '6', '7', '8' ] as const;
const accidentals = [ '#', 'b', '-' ] as const;

type Note = typeof notes[number];
type Accidental = typeof accidentals[number];
type Octave = typeof octaves[number];

type Key = `${Note}${Accidental}${Octave}`;

const getNote = (key: Key): Note => key[0] as Note;
const getAccidental = (key: Key): Accidental => key[1] as Accidental;
const getOctave = (key: Key): Octave => key[2] as Octave;

const A_DIFF_POSITION: Record<Note, number> = {
  'A': 0,
  'B': 2,
  'C': -9,
  'D': -7,
  'E': -5,
  'F': -4,
  'G': -2,
}
const getPosition = (key: Key) => {
  const octave = Number(getOctave(key));
  const accidental = getAccidental(key);
  const aPosition = 12 * octave + 1;
  const adjustedPosition = aPosition + A_DIFF_POSITION[getNote(key)];
  const finalPosition = adjustedPosition + (
    accidental === '#' ? 1
    : accidental === 'b' ? -1
    : 0
  )

  return finalPosition;
}

// ############################################################

const getAllKeys = (): Key[] => octaves.flatMap(octave => (
  notes.flatMap(note => (
    accidentals.flatMap(accidental => (
      `${note}${accidental}${octave}` as Key
    ))
  ))
));

const KEY_TO_FREQUENCY: Record<Key, number> = Object.fromEntries(
  getAllKeys().map<[Key, number]>(key => [
    key,
    A_4_PITCH * SEMITONE_WIDTH ** (getPosition(key) - A_4_POSITION)
  ])
) as Record<Key, number>; // Object.fromEntries broadens type to { [key: string]: number }

// ############################################################

const isBlackKey = (key: Key) => [ '#', 'b' ].includes(key[1]);

const Key: FC<{ pianoKey: Key, piano: Piano, debug?: boolean }> = ({ pianoKey, piano, debug = false }) => {
  return (
    <div
      onMouseDown={() => piano.press(pianoKey)}
      onMouseUp={() => piano.release(pianoKey)}
      className={isBlackKey(pianoKey) ? styles.blackKey : styles.whiteKey}
    >
      {debug ? pianoKey : null}
    </div>
  );
}

// ############################################################

class Envelope {
  context: AudioContext;
  param: AudioParam | undefined;

  attack: number;
  hold: number;
  decay: number;
  sustain: number;
  release: number;

  constructor(context: AudioContext, attack = 0.03, hold = 0.01, decay = 0.1, sustain = 0.3, release = 0.1) {
    this.context = context;

    this.attack = attack;
    this.hold = hold;
    this.decay = decay;
    this.sustain = sustain;
    this.release = release;
  }

  connect(param: AudioParam) {
    this.param = param;
  }

  start(startTime: number) {
    if (this.param) {
      this.param.cancelScheduledValues(startTime);
      this.param.setValueAtTime(0.001, startTime);
      this.param.exponentialRampToValueAtTime(1, startTime + this.attack);
      this.param.linearRampToValueAtTime(1, startTime + this.attack + this.hold);
      // TODO: exponential ramp
      this.param.linearRampToValueAtTime(
        this.sustain,
        startTime + this.attack + this.hold + this.decay
      );
    }
  }

  stop(stopTime: number) {
    if (this.param) {
      this.param.setValueAtTime(this.sustain, stopTime);
      this.param.exponentialRampToValueAtTime(0.001, stopTime + this.release);
    }
  }
}

type Voice = {
  oscillator: OscillatorNode;
  gain: GainNode;
  envelope: Envelope;
}

class Piano {
  static N_VOICES = 5;
  static GAIN = 0.5;

  context: AudioContext;
  outputGain: GainNode;
  voices: Partial<Record<Key, Voice>> = {};

  constructor(context: AudioContext) {
    this.context = context;
    this.outputGain = this.context.createGain();
    this.outputGain.connect(context.destination);

    this.outputGain.gain.setValueAtTime(Piano.GAIN, context.currentTime);
  }

  press(key: Key) {
    if (!this.voices[key]) {
      console.log('pressing key', key);

      const now = this.context.currentTime;

      const voice = {
        oscillator: this.context.createOscillator(),
        gain: this.context.createGain(),
        envelope: new Envelope(this.context),
      }

      this.voices[key]?.gain.disconnect();

      voice.oscillator.connect(voice.gain);
      voice.oscillator.frequency.setValueAtTime(KEY_TO_FREQUENCY[key], now);
      voice.oscillator.start(now);

      voice.gain.connect(this.outputGain);

      voice.envelope.connect(voice.gain.gain);
      voice.envelope.start(now);


      this.voices[key] = voice;
    }
  }

  release(key: Key) {
    const voice = this.voices[key];

    if (voice) {
      const now = this.context.currentTime;

      console.log('releasing key', key);

      voice.envelope.stop(now);
      // TODO: avoid clip from this being discontinuously set before rest of envelope is finished
      voice.oscillator.stop(now + voice.envelope.release);
      // Rely on garbage collection to destroy this when the references are dead?
      delete this.voices[key];
    }
  }
}

// ############################################################

const keyToNote: Record<string, Key> = {
  'x': 'C-3',
  'X': 'C-3',
  'd': 'C#3',
  'D': 'C#3',
  'C': 'D-3',
  'c': 'D-3',
  'v': 'E-3',
  'V': 'E-3',
  'f': 'D#3',
  'F': 'D#3',
  'b': 'F-3',
  'B': 'F-3',
  'h': 'F#3',
  'H': 'F#3',
  'n': 'G-3',
  'N': 'G-3',
  'j': 'G#3',
  'J': 'G#3',
  'm': 'A-3',
  'M': 'A-3',
  'k': 'A#3',
  'K': 'A#3',
  ',': 'B-3',
  '<': 'B-3',
  '.': 'C-4',
  '>': 'C-4',
}

const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, piano: Piano | undefined) => {
  const note = keyToNote[e.key];

  if (piano && note && !piano.voices[note]) piano.press(note);
}

const handleKeyUp = (e: KeyboardEvent<HTMLDivElement>, piano: Piano | undefined) => {
  const note = keyToNote[e.key];

  if (piano && note) piano.release(note);
}

const PLAYABLE_KEYS: Key[] = [
  'C-3',
  'C#3',
  'D-3',
  'D#3',
  'E-3',
  'F-3',
  'F#3',
  'G-3',
  'G#3',
  'A-3',
  'A#3',
  'B-3',
  'C-4',
];

export const Pianuo: FC = () => {
  const [ ready, setReady ] = useState(false);
  const [ context, setContext ] = useState<AudioContext>();
  const [ piano, setPiano ] = useState<Piano>();

  // TODO: create analyser node for VU meter-style visualizer

  useEffect(() => {
    if (ready) {
      const context = new AudioContext();
      setContext(context);
      setPiano(new Piano(context));
    }
  }, [ready]);

  return ready ? (
    <div
      className={styles.piano}
      onKeyDown={e => handleKeyDown(e, piano)}
      onKeyUp={e => handleKeyUp(e, piano)}
      tabIndex={0}
    >
      {piano ? PLAYABLE_KEYS.map(key => <Key key={key} pianoKey={key} piano={piano} debug />) : null}
    </div>
  ) : (
    <div style={{ width: '50vh', height: '25vh', backgroundColor: 'mediumspringgreen' }} onClick={() => setReady(true)}></div>
  )
}