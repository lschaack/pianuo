import React, {
  FC,
  MouseEvent as SyntheticMouseEvent,
  useEffect,
  useMemo,
  useState
} from 'react';

import { MESSAGE_SEPARATOR } from "./helpers";
import { Piano } from "audio/piano";
import { DelayModule } from 'components/DelayModule';
import { TapeDelayNode } from 'audio/nodes/TapeDelayNode';
import { PianoKeyboard } from './PianoKeyboard';

// handshake:
// - whenever ready, generate id
// - whenever id is changed, send message to server 'setId|{id}'
// - whenever server receives this message, send 'idIsSet|{id}'
// - id is set when server has added this client to list of clients to be notified
//   when other connected clients
export const Pianuo: FC<{ id: string }> = (id, onChange) => {
  const [ hasGesture, setHasGesture ] = useState(false);
  const [ socketOpen, setSocketOpen ] = useState(false);
  const [ context, setContext ] = useState<AudioContext>();
  const [ piano, setPiano ] = useState<Piano>();
  const [ delay, setDelay ] = useState<TapeDelayNode>();
  const [ ws, setWs ] = useState<WebSocket>();
  const [ modelIsSet, setModelIsSet ] = useState(false);

  // TODO: create analyser node for VU meter-style visualizer

  useEffect(() => {
    if (hasGesture) {
      // Audio context can only be started after user gesture
      console.log('creating new audio context');
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
      console.log('setting id to', id);
      ws.send(`setId${MESSAGE_SEPARATOR}${id}`);
    }

    return () => {
      console.log('removing id', id);
      ws?.send(`removeId${MESSAGE_SEPARATOR}${id}`);
    }
  }, [ ws, id, socketOpen ]);

  const handleGesture = useMemo(() => {
    if (!hasGesture) {
      return (event: SyntheticMouseEvent<HTMLDivElement, MouseEvent>) => {
        event.stopPropagation();
        setHasGesture(true);
      }
    }

    return undefined;
  }, [hasGesture]);

  useEffect(() => {
    if (context?.destination && piano) {
      if (delay) {
        piano.connect(delay);
        delay.connect(context.destination);
      } else {
        piano.connect(context.destination);
      }
    }

    return () => {
      piano?.disconnect();
      delay?.disconnect();
    }
  }, [ piano, delay, context ])

  return (
    <div>
      <DelayModule context={context} onChange={setDelay} />
      <div
        className={hasGesture ? 'animate-unblur' : 'blur-sm'}
        onClick={handleGesture}
      >
        <PianoKeyboard piano={piano} hasGesture={hasGesture} />
      </div>
    </div>
  )
}
