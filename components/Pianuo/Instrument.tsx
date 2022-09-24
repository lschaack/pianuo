import { ChangeEventHandler, FC, ReactNode, useEffect, useReducer, useState } from "react";

import { Piano } from "audio/piano";
import { Synth } from "audio/synth";
import { Keybed } from "./PianoKeyboard";
import { DelayModule } from "components/DelayModule";
import { TapeDelayNode } from "audio/nodes/TapeDelayNode";
import { FlangerModule } from "components/FlangerModule";
import { FlangerNode } from "audio/nodes/FlangerNode";
import { VibratoModule } from "components/VibratoModule";
import { VibratoNode } from "audio/nodes/VibratoNode";
import { dryWetToMix, mixToDryWet } from "audio/utils/audio";

// The instrument is the pair of the piano keyboard & optional modules
export const Instrument: FC<{
  context: AudioContext | undefined,
  ws: WebSocket | undefined,
  hasGesture: boolean
}> = ({ context, ws, hasGesture }) => {
  // const [ piano, setPiano ] = useState<Piano>();
  const [ synth, setSynth ] = useState<Synth>();
  const [ delay, setDelay ] = useState<TapeDelayNode>();
  const [ flanger, setFlanger ] = useState<FlangerNode>();
  const [ vibrato, setVibrato ] = useState<VibratoNode>();

  useEffect(() => {
    // if (context && ws) setPiano(new Piano(context, ws));
    if (context && ws) setSynth(new Synth(context));

    // return () => setPiano(undefined);
    return () => setSynth(undefined);
  }, [ context, ws ]);

  useEffect(() => {
    if (context?.destination && synth) {
      [ synth, vibrato, flanger, delay, context.destination ]
        .filter(Boolean)
        .reduce((prev, curr) => {
          // TODO: any
          prev!.connect(curr as any);

          return curr;
        });
    }
  }, [ synth, vibrato, delay, flanger, context ]);

  // TODO: create analyser node for VU meter-style visualizer

  return (
    <>
      <div className="flex flex-col">
        {/* <DelayModule context={context} onChange={setDelay} /> */}
        {/* <FlangerModule context={context} onChange={setFlanger} /> */}
        {/* <VibratoModule context={context} onChange={setVibrato} /> */}

        {/* {mods.map((mod, index) => (
          <ModCard {...mod} key={`${mod.title}-${index}`} />
        ))} */}

        {synth && <OscillatorKnobs synth={synth} />}

        {/* low pass freq */}
        {/* <input type="range" onChange={undefined} /> */}

        {/* osc 1 wave shape */}
        {/* osc 2 wave shape */}

        {/* envelope */}
      </div>
      <Keybed piano={synth} hasGesture={hasGesture} />
    </>
  );
}

const Card: FC<{ title: ReactNode }> = ({ title, children }) => {
  return (
    <div className="rounded shadow-md p-4">
      <h2>{title}</h2>
      {children}
    </div>
  )
}

const OscillatorTypePicker: FC<{
  title: ReactNode,
  onChange: ChangeEventHandler<HTMLInputElement>,
  currentType: OscillatorType,
}> = ({ title, onChange: handleChange, currentType }) => {
  return (
    <fieldset>
      <legend>{title}</legend>
      {(['sine', 'triangle', 'sawtooth', 'square'] as OscillatorType[]).map((option, index) => {
        const optionId = `${option}-${index}`;

        return (
          <div className="flex gap-x-2 items-center" key={optionId}>
            <input
              type="radio"
              id={optionId}
              checked={currentType === option}
              value={option}
              onChange={handleChange}
            />
            <label htmlFor={optionId}>
              {option}
            </label>
          </div>
        )
      })}
    </fieldset>
  )
}

const OscillatorKnobs: FC<{ synth: Synth }> = ({ synth }) => {
  const [_, forceUpdate] = useReducer(x => x + 1, 0);

  const {
    topOscillator: {
      type: currentTopType,
      gain: currentTopGain,
    },
    subOscillator: {
      type: currentSubType,
      gain: currentSubGain,
    }
  } = synth?.knobs;

  const currentMix = dryWetToMix(currentTopGain, currentSubGain);

  return (
    <Card title="Oscillators">
      <div className="flex gap-x-16">
        <OscillatorTypePicker
          title="OSC1"
          onChange={e => {
            synth.knobs.topOscillator.type = (e.target.value as OscillatorType)
            forceUpdate();
          }}
          currentType={currentTopType}
        />
        <div className="flex-col">
          <label htmlFor="oscillatorMix" className="block">Mix</label>
          <input
            type="range"
            id="oscillatorMix"
            min={0}
            max={1}
            step={0.001}
            value={currentMix}
            onChange={e => {
              const [ topVolume, subVolume ] = mixToDryWet(parseFloat(e.target.value));
              synth.knobs.topOscillator.gain = topVolume;
              synth.knobs.subOscillator.gain = subVolume;
              forceUpdate();
            }}
          />
        </div>
        {/* TODO: unify this w/above fieldset */}
        <OscillatorTypePicker
          title="OSC2"
          onChange={e => {
            synth.knobs.subOscillator.type = (e.target.value as OscillatorType)
            forceUpdate();
          }}
          currentType={currentSubType}
        />
      </div>
    </Card>
  )
}
