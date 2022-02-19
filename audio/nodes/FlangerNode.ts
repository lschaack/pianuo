import { AudioIO } from "audio/nodes/AudioIO";
import { mixToDryWet } from "audio/utils/audio";
import { normalizeToRange } from "audio/utils/audio";

export type FlangerOptions = {
  wave: OscillatorType;
  time: number;
  speed: number;
  depth: number;
  feedback: number;
  mix: number;
  autoStart?: boolean;
};

export class FlangerNode extends AudioIO {
  type = 'FlangerNode' as const;
  private oscillator: OscillatorNode;
  private oscillatorGain: GainNode;
  private delay: DelayNode;
  private feedbackGain: GainNode;
  private dryGain: GainNode;
  private wetGain: GainNode;

  constructor(context: AudioContext, options: FlangerOptions) {
    /********** Base instantiation **********/
    super(context.createGain(), context.createGain());

    /********** Setup **********/
    const feedbackOutput = context.createGain();
    this.delay = context.createDelay();
    this.feedbackGain = context.createGain();
    this.oscillator = context.createOscillator();
    this.oscillatorGain = context.createGain();
    this.wetGain = context.createGain();
    this.dryGain = context.createGain();

    /********** Connect **********/
    this.input.connect(feedbackOutput);
    this.input.connect(this.dryGain);

    feedbackOutput.connect(this.delay);
    feedbackOutput.connect(this.wetGain);

    this.delay.connect(this.wetGain);
    this.delay.connect(this.feedbackGain);

    this.feedbackGain.connect(feedbackOutput);

    this.oscillator.connect(this.oscillatorGain);
    this.oscillatorGain.connect(this.delay.delayTime);

    this.dryGain.connect(this.output);
    this.wetGain.connect(this.output);

    /********** Set options **********/
    const { wave, time, speed, depth, feedback, mix, autoStart } = options;
    this.wave = wave;
    this.time = time;
    this.speed = speed;
    this.depth = depth;
    this.feedback = feedback;
    this.mix = mix;
    
    if (autoStart ?? true) this.oscillator.start(context.currentTime);
  }

  set wave(type: OscillatorType) {
    this.oscillator.type = type;
  }

  set time(time: number) {
    this.delay.delayTime.value = normalizeToRange(0.001, 0.02, time);
  }

  set speed(speed: number) {
    this.oscillator.frequency.value = normalizeToRange(0.5, 5, speed);
  }

  set depth(depth: number) {
    this.oscillatorGain.gain.value = normalizeToRange(0.0005, 0.005, depth);
  }
  
  set feedback(feedback: number) {
    this.feedbackGain.gain.value = normalizeToRange(0, 0.8, feedback);
  }

  set mix(mix: number) {
    const [ dryGainValue, wetGainValue ] = mixToDryWet(mix);
    this.dryGain.gain.value = dryGainValue;
    this.wetGain.gain.value = wetGainValue;
  }

  setOptions(options: FlangerOptions) {
    super.setOptions(options);
  }
}
