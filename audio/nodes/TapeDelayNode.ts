import { AudioIO } from "audio/nodes/AudioIO";
import { normalizeToRange } from "audio/utils/audio";

export type TapeDelayOptions = {
  depth: number;
  time: number;
};

export class TapeDelayNode extends AudioIO<TapeDelayOptions> {
  type = 'TapeDelayNode' as const;
  private delayGain: GainNode;
  private delay: DelayNode;

  constructor(context: AudioContext, options: TapeDelayOptions) {
    /********** Base instantiation **********/
    super(context.createGain(), context.createGain());
    
    /********** Setup **********/
    this.delay = context.createDelay();
    this.delayGain = context.createGain();

    /********** Connect **********/
    this.input.connect(this.output);
    this.input.connect(this.delay);
    this.delay.connect(this.delayGain);
    this.delayGain.connect(this.delay); // this loop is what produces the effect
    this.delayGain.connect(this.output);

    /********** Set options **********/
    const { depth, time } = options;
    this.depth = depth;
    this.time = time;
  }

  set depth(depth: number) {
    this.delayGain.gain.value = normalizeToRange(0, 0.9, depth);
  }
  
  set time(time: number) {
    this.delay.delayTime.value = normalizeToRange(0.1, 1, time);
  }

  setOptions(options: TapeDelayOptions) {
    super.setOptions(options);
  }
}
