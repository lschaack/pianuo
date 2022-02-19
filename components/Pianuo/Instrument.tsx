import { FC, useEffect, useState } from "react";

import { Piano } from "audio/piano";
import { TapeDelayNode } from "audio/nodes/TapeDelayNode";
import { DelayModule } from "components/DelayModule";
import { PianoKeyboard } from "./PianoKeyboard";

// The instrument is the pair of the piano keyboard & optional modules

export const Instrument: FC<{
  context: AudioContext | undefined,
  ws: WebSocket | undefined,
  hasGesture: boolean
}> = ({ context, ws, hasGesture }) => {
  const [ piano, setPiano ] = useState<Piano>();
  const [ delay, setDelay ] = useState<TapeDelayNode>();

  useEffect(() => {
    if (context && ws) setPiano(new Piano(context, ws));

    return () => setPiano(undefined);
  }, [ context, ws ]);

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

  // TODO: create analyser node for VU meter-style visualizer

  return (
    <div>
      <DelayModule context={context} onChange={setDelay} />
      <PianoKeyboard piano={piano} hasGesture={hasGesture} />
    </div>
  );
}
