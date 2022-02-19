import { TapeDelayNode } from 'audio/nodes/TapeDelayNode';
import { Knob } from 'components/Knob';
import React, { FC, useEffect, useState } from 'react';

type DelayModuleProps = {
  context: AudioContext | undefined;
  onChange: (node: TapeDelayNode | undefined) => void;
}

export const DelayModule: FC<DelayModuleProps> = ({ context, onChange: handleChange }) => {
  const [ depth, setDepth ] = useState(0.6);
  const [ time, setTime ] = useState(0.6);
  const [ delayNode, setDelayNode ] = useState<TapeDelayNode>();

  useEffect(() => handleChange(delayNode), [ delayNode, handleChange ]);

  useEffect(() => {
    if (context) setDelayNode(new TapeDelayNode(context, { depth, time }))

    return () => delayNode?.disconnect();
  }, [ setDelayNode, context ]); // eslint-disable-line

  useEffect(() => {
    if (delayNode) {
      delayNode.time = time;
      delayNode.depth = depth;
    }
  }, [ delayNode, time, depth ]);

  return (
    <div>
      <h2>Tape Delay</h2>
      <label>depth</label>
      <Knob onChange={setDepth} />
      <label>time</label>
      <Knob onChange={setTime} />
    </div>
  );
}
