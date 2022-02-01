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

import { isBlackKey, Key, MESSAGE_SEPARATOR } from "./helpers";
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

const Key: FC<{ pianoKey: Key, piano: Piano, debug?: boolean }> = ({ pianoKey, piano, debug = false }) => {
  const [ isDown, setIsDown ] = useState(false);
  const [ nextIsDown, setNextIsDown ] = useState(false);
  const [ id ] = useState(uniqueId());

  const nextKey = useMemo(() => (
    PLAYABLE_KEYS[PLAYABLE_KEYS.indexOf(pianoKey) + 1]
  ), [pianoKey]);

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
      onPress: key => {
        if (key === pianoKey) setIsDown(true);
        else if (key === nextKey) setNextIsDown(true);
      },
      onRelease: key => {
        if (key === pianoKey) setIsDown(false);
        else if (key === nextKey) setNextIsDown(false);
      },
    }, id);

    return () => piano.unsubscribe(id);
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

const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, piano: Piano | undefined) => {
  const note = KEY_TO_NOTE[e.key];

  if (piano && note) piano.play(note);
}

const handleKeyUp = (e: KeyboardEvent<HTMLDivElement>, piano: Piano | undefined) => {
  const note = KEY_TO_NOTE[e.key];

  if (piano && note) piano.stop(note);
}

// from https://stackoverflow.com/a/10727155
const generateModelNumber = () => {
  const length = 4;
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';

  for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];

  return result;
}

const isModelNumber = (maybeModel: string) => /[A-z0-9]{4}/.test(maybeModel);

// handshake:
// - whenever ready, generate id
// - whenever id is changed, send message to server 'setId|{id}'
// - whenever server receives this message, send 'idIsSet|{id}'
// - id is set when server has added this client to list of clients to be notified
//   when other connected clients
export const Pianuo: FC = () => {
  const [ hasGesture, setHasGesture ] = useState(false);
  const [ socketOpen, setSocketOpen ] = useState(false);
  const [ context, setContext ] = useState<AudioContext>();
  const [ piano, setPiano ] = useState<Piano>();
  const [ ws, setWs ] = useState<WebSocket>();
  const [ model, setModel ] = useState(generateModelNumber());
  const [ modelIsSet, setModelIsSet ] = useState(false);

  // TODO: create analyser node for VU meter-style visualizer

  useEffect(() => {
    if (hasGesture) {
      // Audio context can only be started after user gesture
      const context = new AudioContext();
      setContext(context);

      // shadow ws to pass around in this function body
      // const ws = new WebSocket('ws://localhost:8080');
      const ws = new WebSocket('ws://192.168.0.106:8080');
      ws.addEventListener('open', e => {
        console.log('connection opened', e);
        setSocketOpen(true);
      });
      ws.addEventListener('close', e => {
        console.log('connection closed', e);
      });
      setWs(ws);

      setModel(generateModelNumber());
      setPiano(new Piano(context, ws));

      return () => {
        // to identify if this ever runs (never really should unless navigating away)
        console.log('cleaning up ws, context');
        ws.close();
        context.suspend();
      }
    }
  }, [hasGesture]);

  useEffect(() => {
    console.log('socket open?', socketOpen);
    if (socketOpen && ws) {
      console.log('setting id to', model);
      ws.send(`setId${MESSAGE_SEPARATOR}${model}`);
    }

    return () => {
      console.log('removing id', model);
      ws?.send(`removeId${MESSAGE_SEPARATOR}${model}`);
    }
  }, [ ws, model, socketOpen ]);

  return hasGesture ? (
    <div>
      <input
        onChange={e => {
          if (isModelNumber(e.target.value)) setModel(e.target.value);
        }}
      />
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
    </div>
  ) : (
    <div
      style={{
        width: '50vh',
        height: '25vh',
        backgroundColor: 'mediumspringgreen'
      }}
      onClick={() => setHasGesture(true)}
      onTouchStart={() => setHasGesture(true)}
    />
  )
}
