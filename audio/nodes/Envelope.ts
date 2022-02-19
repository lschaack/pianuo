export type EnvelopeOptions = {
  attack: number;
  hold: number;
  decay: number;
  sustain: number;
  release: number;
}

// TODO: potentially get this to follow the AudioIO pattern
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
      this.param.exponentialRampToValueAtTime(1, startTime + this.attack + this.hold);
      this.param.exponentialRampToValueAtTime(
        this.sustain,
        startTime + this.attack + this.hold + this.decay
      );
    }
  }

  stop(stopTime: number) {
    if (this.param) {
      const now = this.context.currentTime;
      const currValue = this.param.value;
      // TODO: release should take longer depending on how much higher the current value is from sustain
      // const releaseCoefficient = currValue / this.sustain; // need some log function on this

      this.param.cancelScheduledValues(now);
      // for exponentialRampToValueAtTime calculations (based on last-scheduled value)
      this.param.setValueAtTime(currValue, now);
      this.param.exponentialRampToValueAtTime(0.001, stopTime + this.release);
    }
  }
}
