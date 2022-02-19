import { AudioIO } from "audio/nodes/AudioIO";
import { A4_FREQUENCY } from "audio/contants";

// TODO: add props for min/max, which was the entire point of this originally
export type CustomOscillatorOptions = {
  frequency?: number;
  type?: OscillatorType;
  autoStart?: boolean;
};

// TODO: Make actual Proxy around default OscillatorNode?
export class CustomOscillatorNode extends AudioIO {
  private oscillator: OscillatorNode;

  constructor(context: AudioContext, options: CustomOscillatorOptions) {
    /********** Base instantiation **********/
    const IO = context.createGain(); // this node acts as both input and output
    super(IO, IO);

    /********** Setup **********/
    this.oscillator = context.createOscillator();

    // offset oscillator range to [0, 2] w/constant source offset of 1
    const baseGainSource = context.createConstantSource();
    baseGainSource.start(context.currentTime);

    const joiner = context.createGain();
    // scale oscillator range to [0, 1] by halving IO
    joiner.gain.value = 0.5;

    /********** Connect **********/
    this.oscillator.connect(joiner);
    baseGainSource.connect(joiner);
    joiner.connect(IO);

    /********** Set options **********/
    const { frequency, type, autoStart } = options;
    this.frequency = frequency ?? A4_FREQUENCY;
    this.type = type ?? 'sine';

    if (autoStart ?? true) this.start(context.currentTime);
  }

  set frequency(nextFrequency: number) {
    this.oscillator.frequency.value = nextFrequency;
  }

  set type(nextType: OscillatorType) {
    this.oscillator.type = nextType;
  }

  start(when = 0) {
    this.oscillator.start(when);
  }
}
