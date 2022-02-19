import { FlangerNode } from 'audio/nodes/FlangerNode';
import { Knob } from 'components/Knob';
import React, { FC, useEffect, useState } from 'react';

type FlangerModuleProps = {
  context: AudioContext | undefined;
  onChange: (node: FlangerNode | undefined) => void;
}

export const FlangerModule: FC<FlangerModuleProps> = ({ context, onChange: handleChange }) => {
  const [ time, setTime ] = useState(0.6);
  const [ speed, setSpeed ] = useState(0.6);
  const [ depth, setDepth ] = useState(0.6);
  const [ feedback, setFeedback ] = useState(0.6);
  const [ mix, setMix ] = useState(0.6);
  const [ flangerNode, setFlangerNode ] = useState<FlangerNode>();

  useEffect(() => handleChange(flangerNode), [ flangerNode, handleChange ]);

  useEffect(() => {
    if (context) setFlangerNode(new FlangerNode(context, { wave: 'sawtooth', time, speed, depth, feedback, mix }))

    return () => flangerNode?.disconnect();
  }, [ setFlangerNode, context ]); // eslint-disable-line

  useEffect(() => {
    if (flangerNode) {
      flangerNode.time = time;
      flangerNode.depth = depth;
    }
  }, [ flangerNode, time, speed, depth, feedback, mix ]);

  return (
    <div>
      <h2>Flanger</h2>
      <ul className="flex">
        <li>
          <label>time</label>
          <Knob onChange={setTime} />
        </li>
        <li>
          <label>speed</label>
          <Knob onChange={setSpeed} />
        </li>
        <li>
          <label>depth</label>
          <Knob onChange={setDepth} />
        </li>
        <li>
          <label>feedback</label>
          <Knob onChange={setFeedback} />
        </li>
        <li>
          <label>mix</label>
          <Knob onChange={setMix} />
        </li>
      </ul>
    </div>
  );
}
