import { FC, useEffect, useState } from "react";

import { Piano } from "audio/piano";
import { PianoKeyboard } from "./PianoKeyboard";
import { DelayModule } from "components/DelayModule";
import { TapeDelayNode } from "audio/nodes/TapeDelayNode";
import { FlangerModule } from "components/FlangerModule";
import { FlangerNode } from "audio/nodes/FlangerNode";
import { VibratoModule } from "components/VibratoModule";
import { VibratoNode } from "audio/nodes/VibratoNode";

// The instrument is the pair of the piano keyboard & optional modules

export const Instrument: FC<{
  context: AudioContext | undefined,
  ws: WebSocket | undefined,
  hasGesture: boolean
}> = ({ context, ws, hasGesture }) => {
  const [ piano, setPiano ] = useState<Piano>();
  const [ delay, setDelay ] = useState<TapeDelayNode>();
  const [ flanger, setFlanger ] = useState<FlangerNode>();
  const [ vibrato, setVibrato ] = useState<VibratoNode>();

  useEffect(() => {
    if (context && ws) setPiano(new Piano(context, ws));

    return () => setPiano(undefined);
  }, [ context, ws ]);

  useEffect(() => {
    if (context?.destination && piano) {
      [ piano, vibrato, flanger, delay, context.destination ]
        .filter(Boolean)
        .reduce((prev, curr) => {
          // TODO: any
          prev!.connect(curr as any);

          return curr;
        });
    }
  }, [ piano, vibrato, delay, flanger, context ]);

  // TODO: create analyser node for VU meter-style visualizer

  return (
    <>
      <div className="flex flex-col">
        <DelayModule context={context} onChange={setDelay} />
        {/* <FlangerModule context={context} onChange={setFlanger} /> */}
        {/* <VibratoModule context={context} onChange={setVibrato} /> */}
      </div>
      <PianoKeyboard piano={piano} hasGesture={hasGesture} />
    </>
  );
}
