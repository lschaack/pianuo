import { FC, ReactNode, useEffect, useReducer, useState } from "react";

import { Piano } from "audio/piano";
import { Synth } from "audio/synth";
import { Keybed } from "./PianoKeyboard";
import { DelayModule } from "components/DelayModule";
import { TapeDelayNode } from "audio/nodes/TapeDelayNode";
import { FlangerModule } from "components/FlangerModule";
import { FlangerNode } from "audio/nodes/FlangerNode";
import { VibratoModule } from "components/VibratoModule";
import { VibratoNode } from "audio/nodes/VibratoNode";

// The instrument is the pair of the piano keyboard & optional modules

// Each mod card has an array of Mod arrays
// (e.g. for controlling both oscillator type and volume in one card)
// This maps out all mod cards, so it needs a third wrapping array
const getObservableMods = (synth: Synth) => {

}

const DEFAULT_MODS: Array<ModCardProps> = [
  {
    title: 'OSC1',
    mods: [
      [
        {
          type: 'radio',
          label: 'OSC1 type',
          value: 'sawtooth',
          options: [ 'sin', 'triangle', 'sawtooth', 'square' ]
        },
        {
          label: 'OSC1 volume',
          type: 'range',
          value: 0.5,
        }
      ]
    ]
  },
  {
    title: 'OSC2',
    mods: [
      [
        {
          type: 'radio',
          label: 'OSC2 type',
          value: 'square',
          options: [ 'sin', 'triangle', 'sawtooth', 'square' ]
        },
        {
          label: 'OSC2 volume',
          type: 'range',
          value: 0.5,
        }
      ]
    ]
  },
];

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
  const [ mods, setMods ] = useState(DEFAULT_MODS);

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

        {synth && <TopOscillatorCard synth={synth} />}

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

const TopOscillatorCard: FC<{ synth: Synth }> = ({ synth }) => {
  const [_, forceUpdate] = useReducer(x => x + 1, 0);

  const {
    topOscillator: {
      type: currentType,
      gain: currentGain,
    }
  } = synth?.knobs;

  return (
    <Card title="OSC1">
      <fieldset>
        <legend>Type</legend>
        {(['sine', 'triangle', 'sawtooth', 'square'] as OscillatorType[]).map((option, index) => {
          const optionId = `${option}-${index}`;

          return (
            <div className="flex-col" key={optionId}>
              <input
                type="radio"
                id={optionId}
                checked={option === currentType}
                value={option}
                onChange={e => {
                  synth.knobs.topOscillator.type = (e.target.value as OscillatorType)
                  forceUpdate();
                }}
              />
              <label htmlFor={optionId}>
                {option}
              </label>
            </div>
          )
        })}
      </fieldset>
      <div className="flex-col">
        <input
          type="range"
          id="topOscillatorVolume"
          min={0}
          max={1}
          step={0.001}
          value={currentGain}
          onChange={e => {
            synth.knobs.topOscillator.gain = parseFloat(e.target.value)
            forceUpdate();
          }}
        />
        <label htmlFor="topOscillatorVolume">Volume</label>
      </div>
    </Card>
  )
}

type ModType = 'radio' | 'range';
type BaseMod<Type extends ModType> = {
  type: Type;
  label: string;
}
type RangeMod = BaseMod<'range'> & {
  value: number;
};
type RadioMod<Options> = BaseMod<'radio'> & {
  value: string;
  options: Options;
};
type Mod = RangeMod | RadioMod<Array<string>>;

type ModCardProps = {
  title: string;
  mods: Mod[][];
}

const ModCard: FC<ModCardProps> = ({ title, mods }) => {
  return (
    <div className="rounded shadow-md">
      <h2>{title}</h2>
      {mods.map((modRow, rowIndex) => {
        return (
          <div key={`modRow-${rowIndex}`} className="flex">
            {modRow.map((mod, colIndex) => {
              const modId = `${rowIndex}-${colIndex}-${mod.label}`;

              return (
                <div className="flex-col" key={modId}>
                  {mod.type === 'radio' ? (
                    // ############################## RADIO ##############################
                    <fieldset>
                      <legend>{mod.label}</legend>
                      {mod.options?.map(option => {
                        const optionId = `${modId}-${option}`;

                        return (
                          <div className="flex-col" key={optionId}>
                            <input
                              type="radio"
                              id={optionId}
                              checked={option === mod.value}
                              onClick={() => mod.value = option}
                            />
                            <label htmlFor={optionId}>
                              {option}
                            </label>
                          </div>
                        )
                      })}
                    </fieldset>
                  ) : (
                    // ############################## RANGE ##############################
                    <div className="flex-col">
                      <input
                        type="range"
                        id={modId}
                        value={mod.value}
                        onChange={e => mod.value = parseFloat(e.target.value)}
                      />
                      <label htmlFor={modId}>{mod.label}</label>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  );
}
