import React, {
  FC,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import uniqueId from 'lodash/uniqueId';
import cx from 'clsx';

import styles from './styles.module.scss';

import { isBlackKey, Key } from "./helpers";
import { Piano } from "audio/piano";

const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, piano: Piano | undefined) => {
  const note = KEY_TO_NOTE[e.key];

  if (piano && note) piano.play(note);
}

const handleKeyUp = (e: KeyboardEvent<HTMLDivElement>, piano: Piano | undefined) => {
  const note = KEY_TO_NOTE[e.key];

  if (piano && note) piano.stop(note);
}

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
  'B-3',
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

const PianoKey: FC<{
  pianoKey: Key,
  piano: Piano | undefined,
  hasGesture: boolean,
  debug?: boolean
}> = ({ pianoKey, piano, hasGesture, debug = false }) => {
  const [ isDown, setIsDown ] = useState(false);
  const [ nextIsDown, setNextIsDown ] = useState(false);
  const [ id ] = useState(uniqueId());

  const nextKey = useMemo(() => (
    PLAYABLE_KEYS[PLAYABLE_KEYS.indexOf(pianoKey) + 1]
  ), [pianoKey]);

  const handleMouseDown = useCallback(() => {
    if (hasGesture) {
      piano?.play(pianoKey)
      setIsDown(true);
    }
  }, [ piano, pianoKey, hasGesture ]);

  const handleMouseUp = useCallback(() => {
    if (hasGesture) {
      piano?.stop(pianoKey)
      setIsDown(false);
    }
  }, [ piano, pianoKey, hasGesture ]);

  useEffect(() => {
    piano?.subscribe({
      onPress: key => {
        if (key === pianoKey) setIsDown(true);
        else if (key === nextKey) setNextIsDown(true);
      },
      onRelease: key => {
        if (key === pianoKey) setIsDown(false);
        else if (key === nextKey) setNextIsDown(false);
      },
    }, id);

    return () => piano?.unsubscribe(id);
  }, [ piano, pianoKey, nextKey, id ]);

  return (
    <div
      id={pianoKey}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={cx(
        isBlackKey(pianoKey) ? styles.blackKey : styles.whiteKey,
        isDown && styles.pressed,
        nextIsDown && styles.nextPressed,
      )}
    >
      {debug ? pianoKey : null}
    </div>
  );
}

export const PianoKeyboard: FC<{ piano: Piano | undefined; hasGesture: boolean; }> = ({ piano, hasGesture }) => {
  return (
    <div
      className={styles.piano}
      onKeyDown={e => handleKeyDown(e, piano)}
      onKeyUp={e => handleKeyUp(e, piano)}
      tabIndex={0}
    >
      {PLAYABLE_KEYS.map(key => (
        <PianoKey
          key={key}
          pianoKey={key}
          piano={piano}
          hasGesture={hasGesture}
        />
      ))}
    </div>
  )
}

