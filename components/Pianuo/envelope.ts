export type EnvelopeOptions = {
  attack: number;
  hold: number;
  decay: number;
  sustain: number;
  release: number;
}

export class Envelope {
  context: AudioContext;
  param: AudioParam | undefined;

  attack: number;
  hold: number;
  decay: number;
  sustain: number;
  release: number;

  constructor(context: AudioContext, options?: Partial<EnvelopeOptions>) {
    this.context = context;

    const { attack, hold, decay, sustain, release } = {
      attack: 0.03, hold: 0.01, decay: 0.1, sustain: 0.3, release: 0.4, ...options
    };

    this.attack = attack;
    this.hold = hold;
    this.decay = decay;
    this.sustain = sustain;
    this.release = release;
  }

  connect(param: AudioParam) {
    this.param = param;
  }

  start(startTime: number) {
    if (this.param) {
      this.param.cancelScheduledValues(startTime);
      this.param.setValueAtTime(0.001, startTime);
      this.param.exponentialRampToValueAtTime(1, startTime + this.attack);
      this.param.linearRampToValueAtTime(1, startTime + this.attack + this.hold);
      // TODO: exponential ramp
      this.param.exponentialRampToValueAtTime(
        this.sustain,
        startTime + this.attack + this.hold + this.decay
      );
    }
  }

  stop(stopTime: number) {
    if (this.param) {
      this.param.setValueAtTime(this.sustain, stopTime);
      this.param.exponentialRampToValueAtTime(0.001, stopTime + this.release);
    }
  }
}
