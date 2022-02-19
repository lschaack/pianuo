import { TapeDelayNode } from 'audio/nodes/TapeDelayNode';
import { Knob } from 'components/Knob';
import React, { FC, useEffect, useState } from 'react';

type DelayModuleProps = {
  context: AudioContext;
  handleChange: (node: TapeDelayNode | undefined) => void;
}

export const DelayModule: FC<DelayModuleProps> = ({ context, handleChange }) => {
  const [ depth, setDepth ] = useState(0.6);
  const [ time, setTime ] = useState(0.6);
  const [ delayNode, setDelayNode ] = useState(new TapeDelayNode(context, { depth, time }));

  useEffect(() => handleChange(delayNode), [delayNode, handleChange]);

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
