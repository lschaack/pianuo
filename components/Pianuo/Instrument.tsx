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
import { EnvelopeParams } from "audio/nodes/Envelope";

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

        {synth && (
          <div className="flex">
            <OscillatorKnobs synth={synth} />
            <FilterKnobs synth={synth} />
            <VCAKnobs synth={synth} />
            <VCFKnobs synth={synth} />
          </div>
        )}

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

const FilterKnobs: FC<{ synth: Synth }> = ({ synth }) => {
  const [_, forceUpdate] = useReducer(x => x + 1, 0);

  const {
    lpf: {
      cutoff,
      resonance,
      keytrack,
    }
  } = synth?.knobs;

  return (
    <Card title="LPF">
      <div className="flex flex-col">
        <div>
          <label htmlFor="frequency" className="block">frequency</label>
          <input
            type="range"
            id="frequency"
            min={0}
            max={20000}
            step={0.0001}
            value={cutoff}
            onChange={e => {
              synth.knobs.lpf.cutoff = parseFloat(e.target.value);
              forceUpdate();
            }}
          />
        </div>
        <div>
          <label htmlFor="resonance" className="block">resonance</label>
          {/* TODO: exponential step increment for fields like these when I make a custom input */}
          <input
            type="range"
            id="resonance"
            min={0}
            max={30}
            step={0.001}
            value={resonance}
            onChange={e => {
              synth.knobs.lpf.resonance = parseFloat(e.target.value);
              forceUpdate();
            }}
          />
        </div>
        <div>
          <label htmlFor="keytrack" className="block">keytrack</label>
          <input
            type="range"
            id="frequency"
            min={0}
            max={1}
            step={0.001}
            value={keytrack}
            onChange={e => {
              synth.knobs.lpf.keytrack = parseFloat(e.target.value);
              forceUpdate();
            }}
          />
        </div>
      </div>
    </Card>
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
      <div className="flex gap-x-8">
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

// TODO: Check out vital/subharmonicon/minilogue defaults (probably use minilogue's)
const envelopeParamToMax: Record<keyof EnvelopeParams, number> = {
  attack: 1,
  hold: 3,
  decay: 9,
  sustain: 1, // Should only be [0, 1] b/c/o use as coefficient for `amount`
  release: 9,
  amount: 20000, // ??? different for vcf/vca (vca on [0, 1])
};

const EGKnobs: FC<{ synth: Synth; title: ReactNode; which: 'vcfEg' | 'vcaEg' }> = ({ synth, title, which }) => {
  const [_, forceUpdate] = useReducer(x => x + 1, 0);

  return (
    <Card title={title}>
      <div className="flex-col">
        {Object.entries(synth?.knobs[which]).map(([key, val]) => {
          const max = envelopeParamToMax[key as keyof EnvelopeParams];

          return (
            <div key={key}>
              <label htmlFor={key} className="block">{key}</label>
              <input
                type="range"
                id={key}
                min={0}
                max={max}
                step={max / 1000} // TODO: not enough for vcf amount (although I generally want to exclude amount)
                value={val}
                onChange={e => {
                  synth.knobs[which][key as keyof EnvelopeParams] = parseFloat(e.target.value);
                  forceUpdate();
                }}
              />
            </div>
          );
        })}
      </div>
    </Card>
  )
}

const VCAKnobs: FC<{ synth: Synth }> = ({ synth }) => (
  <EGKnobs
    title="VCA"
    which="vcaEg"
    synth={synth}
  />
);

const VCFKnobs: FC<{ synth: Synth }> = ({ synth }) => (
  <EGKnobs
    title="VCF"
    which="vcfEg"
    synth={synth}
  />
);
