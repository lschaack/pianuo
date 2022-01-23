import React, { FC, KeyboardEvent, useEffect, useState } from "react";
import cx from 'clsx';

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
  const [ isDown, setIsDown ] = useState(false);

  return (
    <div
      onMouseDown={() => {
        piano.press(pianoKey);
        setIsDown(true);
      }}
      onMouseUp={() => {
        piano.release(pianoKey)
        setIsDown(false);
      }}
      className={cx(
        isBlackKey(pianoKey) ? styles.blackKey : styles.whiteKey,
        isDown && styles.pressed
      )}
    >
      {debug ? pianoKey : null}
    </div>
  );
}

// ############################################################

type EnvelopeOptions = {
  attack: number;
  hold: number;
  decay: number;
  sustain: number;
  release: number;
}

class Envelope {
  context: AudioContext;
  param: AudioParam | undefined;

  attack: number;
  hold: number;
  decay: number;
  sustain: number;
  release: number;

  constructor(context: AudioContext, options?: Partial<EnvelopeOptions>) {
    this.context = context;

    const { attack, hold, decay, sustain, release } = {
      attack: 0.03, hold: 0.01, decay: 0.1, sustain: 0.3, release: 0.4, ...options
    };

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
      this.param.exponentialRampToValueAtTime(
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
  interval: OscillatorNode;
  gain: GainNode;
  envelope: Envelope;
}

class Piano {
  static N_VOICES = 5;
  static GAIN = 0.3;

  context: AudioContext;
  reverb: ConvolverNode;
  outputGain: GainNode;
  voices: Partial<Record<Key, Voice>> = {};

  constructor(context: AudioContext) {
    this.context = context;
    this.reverb = context.createConvolver();
    this.outputGain = this.context.createGain();
    this.outputGain.gain.setValueAtTime(Piano.GAIN, context.currentTime);

    // this will turn on at a random point if the user stars playing before it's loaded
    // but that's a tomorrow problem
    fetch('/IMreverbs/Nice Drum Room.wav')
      .then(response => response.arrayBuffer())
      .then(buffer => this.context.decodeAudioData(buffer))
      .then(audioBuffer => this.reverb.buffer = audioBuffer);

    this.outputGain.connect(this.reverb);
    // TODO: this should probably go before outputGain
    this.reverb.connect(context.destination);
    // this.outputGain.connect(context.destination);
  }

  press(key: Key) {
    if (!this.voices[key]) {
      console.log('pressing key', key);

      const now = this.context.currentTime;

      const voice = {
        oscillator: this.context.createOscillator(),
        interval: this.context.createOscillator(),
        gain: this.context.createGain(),
        envelope: new Envelope(this.context, {
          attack: 0.03,
          hold: 0.01,
          decay: 0.1,
          sustain: 0.05,
          release: 0.4
        }),
      }

      this.voices[key]?.gain.disconnect();
      const baseFrequency = KEY_TO_FREQUENCY[key];
      
      voice.oscillator.type = 'sine';
      voice.interval.type = 'triangle';
      
      voice.oscillator.frequency.setValueAtTime(baseFrequency, now);
      voice.oscillator.start(now);
      
      // Play this oscillator a perfect fourth above the base wave
      // voice.interval.frequency.setValueAtTime(baseFrequency * SEMITONE_WIDTH ** 5, now);
      voice.interval.frequency.setValueAtTime(baseFrequency, now);
      voice.interval.start(now);
      
      // Vibrato
      const vibrato = this.context.createOscillator();
      const vibratoGain = this.context.createGain();
      vibrato.frequency.setValueAtTime(5, now);
      vibrato.start();
      vibratoGain.gain.setValueAtTime(6.5, now);
      vibrato.connect(vibratoGain);
      vibratoGain.connect(voice.oscillator.frequency);

      // Envelope frequency modulation
      voice.oscillator.detune.setValueAtTime(7, now);
      
      // Hooking everything up
      voice.oscillator.connect(voice.gain);
      voice.interval.connect(voice.gain);

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
  'x': 'C-4',
  'X': 'C-4',
  'd': 'C#4',
  'D': 'C#4',
  'C': 'D-4',
  'c': 'D-4',
  'v': 'E-4',
  'V': 'E-4',
  'f': 'D#4',
  'F': 'D#4',
  'b': 'F-4',
  'B': 'F-4',
  'h': 'F#4',
  'H': 'F#4',
  'n': 'G-4',
  'N': 'G-4',
  'j': 'G#4',
  'J': 'G#4',
  'm': 'A-4',
  'M': 'A-4',
  'k': 'A#4',
  'K': 'A#4',
  ',': 'B-4',
  '<': 'B-4',
  '.': 'C-5',
  '>': 'C-5',
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
  'C-4',
  'C#4',
  'D-4',
  'D#4',
  'E-4',
  'F-4',
  'F#4',
  'G-4',
  'G#4',
  'A-4',
  'A#4',
  'B-4',
  'C-5',
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