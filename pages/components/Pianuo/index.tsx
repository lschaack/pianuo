import React, { FC, KeyboardEvent, useCallback, useEffect, useState } from "react";
import uniqueId from 'lodash/uniqueId';
import cx from 'clsx';

import styles from './styles.module.scss';

import { isBlackKey, Key } from "./helpers";
import { Piano } from "./piano";

const KEY_TO_NOTE: Record<string, Key> = {
  'z': 'B-3',
  'Z': 'B-3',
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

const Key: FC<{ pianoKey: Key, piano: Piano, debug?: boolean }> = ({ pianoKey, piano, debug = false }) => {
  const [ isDown, setIsDown ] = useState(false);
  const [ id ] = useState(uniqueId());

  const handleMouseDown = useCallback(() => {
    piano.play(pianoKey)
    setIsDown(true);
  }, [ piano, pianoKey ]);

  const handleMouseUp = useCallback(() => {
    piano.stop(pianoKey)
    setIsDown(false);
  }, [ piano, pianoKey ]);

  useEffect(() => {
    piano.subscribe({
      onPress: key => key === pianoKey && setIsDown(true),
      onRelease: key => key === pianoKey && setIsDown(false),
    }, id);

    return () => piano.unsubscribe(id);
  }, [ piano, pianoKey, id ]);

  return (
    <div
      id={pianoKey}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={cx(
        isBlackKey(pianoKey) ? styles.blackKey : styles.whiteKey,
        isDown && styles.pressed
      )}
    >
      {debug ? pianoKey : null}
    </div>
  );
}

const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, piano: Piano | undefined) => {
  const note = KEY_TO_NOTE[e.key];

  if (piano && note) piano.play(note);
}

const handleKeyUp = (e: KeyboardEvent<HTMLDivElement>, piano: Piano | undefined) => {
  const note = KEY_TO_NOTE[e.key];

  if (piano && note) piano.stop(note);
}

export const Pianuo: FC = () => {
  const [ ready, setReady ] = useState(false);
  const [ context, setContext ] = useState<AudioContext>();
  const [ piano, setPiano ] = useState<Piano>();
  const [ ws, setWs ] = useState<WebSocket>();

  // TODO: create analyser node for VU meter-style visualizer

  useEffect(() => {
    if (ready) {
      // shadow ws to pass around in this function body
      // const ws = new WebSocket('ws://localhost:8080');
      const ws = new WebSocket('ws://192.168.0.106:8080');
      setWs(ws);

      const context = new AudioContext();
      setContext(context);
      setPiano(new Piano(context, ws));

      return () => ws.close();
    }
  }, [ready]);

  return ready ? (
    <div
      className={styles.piano}
      onKeyDown={e => handleKeyDown(e, piano)}
      onKeyUp={e => handleKeyUp(e, piano)}
      tabIndex={0}
    >
      {piano ? PLAYABLE_KEYS.map(key => (
        <Key
          key={key}
          pianoKey={key}
          piano={piano}
        />
      )) : null}
    </div>
  ) : (
    <div
      style={{
        width: '50vh',
        height: '25vh',
        backgroundColor: 'mediumspringgreen'
      }}
      onClick={() => setReady(true)}
      onTouchStart={() => setReady(true)}
    />
  )
}
