import { WINDOW_SIZE } from "audio/contants";
import { normalizeToRange } from "audio/utils/audio";
import { AudioIO } from "audio/nodes/AudioIO";
import { CustomOscillatorNode } from "audio/nodes/CustomOscillatorNode";

export type VibratoOptions = {
  transposition: number;
  rate?: number;
  autoStart?: boolean;
}

export class VibratoNode extends AudioIO {
  type = 'VibratoNode' as const;
  private oscillator: CustomOscillatorNode;
  private oscillatorGain: GainNode;

  constructor(context: AudioContext, options: VibratoOptions) {
    /********** Base instantiation **********/
    super(context.createGain(), context.createGain());

    /********** Setup **********/
    // this probably accomodates negative shifts w/samples played faster than their base rate
    // "for four-point interpolation [delayTime] must be at least one sample"
    const delay = context.createDelay();

    this.oscillator = new CustomOscillatorNode(context, { type: 'sine' });
    this.oscillatorGain = context.createGain();

    this.oscillatorGain.gain.value = WINDOW_SIZE;  

    /********** Connect **********/
    this.input.connect(delay);
    delay.connect(this.output);

    this.oscillator.connect(this.oscillatorGain);
    this.oscillatorGain.connect(delay.delayTime);

    /********** Set options **********/
    const { transposition, rate, autoStart } = options;
    this.transposition = transposition;
    this.rate = rate ?? 0.5;
    if (autoStart ?? true) this.start(context.currentTime);
  }

  set transposition(transposition: number) {
    this.oscillatorGain.gain.value = normalizeToRange(0, 0.02, transposition);
  }

  set rate(rate: number) {
    this.oscillator.frequency = normalizeToRange(0, 10, rate);
  }

  start(time: number) {
    this.oscillator.start(time);
  }

  setOptions(options: VibratoOptions) {
    super.setOptions(options);
  }
}
