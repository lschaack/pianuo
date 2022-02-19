import { VibratoNode } from 'audio/nodes/VibratoNode';
import { Knob } from 'components/Knob';
import React, { FC, useEffect, useState } from 'react';

type VibratoModuleProps = {
  context: AudioContext | undefined;
  onChange: (node: VibratoNode | undefined) => void;
}

export const VibratoModule: FC<VibratoModuleProps> = ({ context, onChange: handleChange }) => {
  const [ transposition, setTransposition ] = useState(0.05);
  const [ rate, setRate ] = useState(0.4);
  const [ vibratoNode, setVibratoNode ] = useState<VibratoNode>();

  useEffect(() => handleChange(vibratoNode), [ vibratoNode, handleChange ]);

  useEffect(() => {
    if (context) setVibratoNode(new VibratoNode(context, { transposition, rate }))

    return () => vibratoNode?.disconnect();
  }, [ setVibratoNode, context ]); // eslint-disable-line

  useEffect(() => {
    if (vibratoNode) {
      vibratoNode.transposition = transposition;
      vibratoNode.rate = rate;
    }
  }, [ vibratoNode, transposition, rate ]);

  return (
    <div>
      <h2>Vibrato</h2>
      <ul className="flex">
        <li>
          <label>transposition</label>
          <Knob init={transposition} onChange={setTransposition} />
        </li>
        <li>
          <label>speed</label>
          <Knob init={rate} onChange={setRate} />
        </li>
      </ul>
    </div>
  );
}
