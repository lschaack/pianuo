import React, { FC, useEffect, useState } from "react";

import FrequencyMap from 'note-frequency-map';

import styles from './styles.module.scss';

// ############################################################

const notes = [ 'A', 'B', 'C', 'D', 'E', 'F', 'G' ] as const;
// const octaves = [ '0', '1', '2', '3', '4', '5', '6', '7', '8' ] as const;
const octaves = [ '3' ] as const;
const accidentals = [ '#', 'b' ] as const;

type Note = typeof notes[number];
type Accidental = typeof accidentals[number];
type Octave = typeof octaves[number];

type Key = `${Note}${Accidental | '-'}${Octave}`;

// ############################################################

const NOTES_WITH_SHARPS: Note[] = [ 'A', 'C', 'D', 'F', 'G' ];

// TODO: this is more than 88 keys
const KEYS = octaves.flatMap<Key>(octave => (
  notes.reduce<Key[]>((allNotes, note) => {
    // Add each note + octave combo (e.g. A4) to the array
    allNotes.push(`${note}-${octave}`);
    // If there's a black key "above" this one on a piano, also push the sharp
    if (NOTES_WITH_SHARPS.includes(note)) allNotes.push(`${note}#${octave}`);

    return allNotes;
  }, [])
));

const isBlackKey = (key: Key) => accidentals.includes(key[1] as Accidental);

const Key: FC<{ pianoKey: Key, piano: Piano, debug?: boolean }> = ({ pianoKey, piano, debug = false }) => {
  return (
    <div
      onMouseDown={() => piano.press(pianoKey)}
      onMouseUp={() => piano.release()}
      className={isBlackKey(pianoKey) ? styles.blackKey : styles.whiteKey}
    >
      {debug ? pianoKey : null}
    </div>
  );
}

// ############################################################

class Envelope {
  context: AudioContext;
  input: GainNode;
  output: GainNode;

  attack: number;
  hold: number;
  decay: number;
  sustain: number;
  release: number;

  constructor(context: AudioContext, attack = 20, hold = 75, decay = 500, sustain = 0.3, release = 100) {
    this.context = context;

    this.attack = attack;
    this.hold = hold;
    this.decay = decay;
    this.sustain = sustain;
    this.release = release;

    this.input = context.createGain();
    this.output = context.createGain();
  }

  connect(node: AudioNode) {
    if (node.hasOwnProperty('input')) {
      this.output.connect((node as any).input);
    } else {
      this.output.connect(node);
    };
  }
}

const envelope = {
  attack: 0.03,
  hold: 0.01,
  decay: 0.1,
  sustain: 0.3,
  release: 0.1,
}

class Piano {
  context: AudioContext;
  oscillator: OscillatorNode | undefined;
  gain: GainNode;

  constructor(context: AudioContext) {
    this.context = context;
    this.gain = context.createGain();
    this.gain.connect(context.destination);
  }

  press(key: Key) {
    const note = FrequencyMap.noteFromName(key.replace('-', ''));
    console.log(`playing key ${key} at frequency ${note.frequency}`);
    const now = this.context.currentTime;

    this.oscillator?.disconnect();
    this.oscillator = this.context.createOscillator();
    this.oscillator.connect(this.gain);
    
    this.oscillator.frequency.setValueAtTime(note.frequency, now);

    // #######################################################
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(0.001, now);
    this.gain.gain.exponentialRampToValueAtTime(1, now + envelope.attack);
    this.gain.gain.linearRampToValueAtTime(1, now + envelope.attack + envelope.hold);
    this.gain.gain.linearRampToValueAtTime(
      envelope.sustain,
      now + envelope.attack + envelope.hold + envelope.decay
    );

    this.oscillator.start(now);
  }

  release() {
    const now = this.context.currentTime;
    // TODO: avoid clip from this being discontinuously set before rest of envelope is finished
    this.gain.gain.setValueAtTime(envelope.sustain, now);
    this.gain.gain.exponentialRampToValueAtTime(
      0.001,
      now + envelope.release
    );
    this.oscillator?.stop(this.context.currentTime + envelope.release);
  }
}

// ############################################################

export const Pianuo: FC = () => {
  const [ ready, setReady ] = useState(false);
  const [ context, setContext ] = useState<AudioContext>();
  const [ piano, setPiano ] = useState<Piano>();

  useEffect(() => {
    if (ready) {
      const context = new AudioContext();
      setContext(context);
      setPiano(new Piano(context));
    }
  }, [ready]);

  return ready ? (
    <div className={styles.piano}>
      {piano ? KEYS.map(key => <Key key={key} pianoKey={key} piano={piano} />) : null}
    </div>
  ) : (
    <div style={{ width: '50vh', height: '25vh', backgroundColor: 'mediumspringgreen' }} onClick={() => setReady(true)}></div>
  )
}