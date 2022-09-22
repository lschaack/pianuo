import { subOctave } from './../components/Pianuo/helpers';
import { AudioIO } from 'audio/nodes/AudioIO';
import Comb from 'audio/nodes/comb';
import { Key, MESSAGE_SEPARATOR, PianoAction, KEY_TO_FREQUENCY, SEMITONE_WIDTH, ARG_SEPARATOR } from 'components/Pianuo/helpers';
import { Envelope } from "audio/nodes/Envelope";

export type Voice = {
  top: ReturnType<Synth['getTop']>;
  sub: ReturnType<Synth['getSub']>;
  // noise: ReturnType<Synth['getNoise']>;
  envelope: Envelope;
  output: GainNode;
}

export type KeypressCallback = (note: Key) => void;
export type KeypressObserver = {
  onPress: KeypressCallback;
  onRelease: KeypressCallback;
}

type OscillatorKnobs = Pick<OscillatorNode, 'type'> & {
  gain: number;
};

export type Knobs = {
  topOscillator: OscillatorKnobs;
  subOscillator: OscillatorKnobs;
  lpf: {
    cutoff: number;
    resonance: number;
  };
  vca: {
    attack: number;
    hold: number;
    decay: number;
    sustain: number;
    release: number;
  }
}

/**
 * Structure
 * constructor
 *  - set up context, reverb should be an effect which comes in after the output node of the synth
 */
export class Synth extends AudioIO {
  // TODO: do something with this or remove
  static N_VOICES = 5;
  static GAIN = 1 / Synth.N_VOICES;
  static INIT_STATE: Knobs = {
    topOscillator: {
      type: 'sawtooth',
      gain: 0.5,
    },
    subOscillator: {
      type: 'square',
      gain: 0.5,
    },
    lpf: {
      cutoff: 9000,
      resonance: 1,
    },
    vca: {
      attack: 0.10,
      hold: 0,
      decay: 9,
      sustain: 0.05,
      release: 0.5,
    }
  }

  // static FULL_DECAY = 9; // 9 seconds

  context: AudioContext;

  private voices: Partial<Record<Key, Voice>> = {};
  private topGain: GainNode;
  private subGain: GainNode;
  private send: GainNode;
  private lowpass: BiquadFilterNode;
  private return: GainNode;

  // TODO: change this to be indexed w/key first to avoid unnecessary calls
  private subscribers: Record<string, KeypressObserver> = {};

  knobs: Knobs = this.getInitState();

  constructor(context: AudioContext) {
    super(context.createGain(), context.createGain());

    this.context = context;
    const now = this.context.currentTime;

    this.send = this.context.createGain();
    this.return = this.context.createGain();

    this.lowpass = this.context.createBiquadFilter();
    // TODO: keytracking
    this.lowpass.frequency.setValueAtTime(this.knobs.lpf.cutoff, now);
    this.lowpass.Q.setValueAtTime(this.knobs.lpf.resonance, now);

    this.topGain = this.context.createGain();
    this.topGain.gain.setValueAtTime(this.knobs.topOscillator.gain, now);
    this.subGain = this.context.createGain();
    this.subGain.gain.setValueAtTime(this.knobs.subOscillator.gain, now);

    this.output = this.context.createGain();
    this.output.gain.setValueAtTime(Synth.GAIN, now);

    this.topGain.connect(this.send);
    this.subGain.connect(this.send);
    this.send.connect(this.lowpass);
    // TODO: at least a separate highpass, room for other in-built effects here
    this.lowpass.connect(this.return);
    this.return.connect(this.output);
  }

  getTop(frequency: number, time: number) {
    const top = this.context.createOscillator();
    top.type = this.knobs.topOscillator.type;
    top.frequency.setValueAtTime(frequency, time);
    // TODO: detune, vary frequency based on available settings
    top.start(time);

    return top;
  }

  // TODO: combine w/getTop if they stay identical
  getSub(frequency: number, time: number) {
    const sub = this.context.createOscillator();
    sub.type = this.knobs.subOscillator.type;
    sub.frequency.setValueAtTime(frequency, time);
    // TODO: detune, vary frequency based on available settings
    sub.start(time);

    return sub;
  }

  press(key: Key, startTime?: number) {
    if (!this.voices[key]) {
      const {
        vca: {
          attack,
          hold,
          decay,
          sustain,
          release,
        }
      } = this.knobs;

      Object.values(this.subscribers).forEach(subscriber => subscriber.onPress(key));
      const time = startTime ?? this.context.currentTime;
      const frequency = KEY_TO_FREQUENCY[key];
      // TODO: make sub octave editable
      const subFrequency = KEY_TO_FREQUENCY[subOctave(key, 1)];

      const output = this.context.createGain();

      const top = this.getTop(frequency, time);
      const sub = this.getSub(subFrequency, time);

      const envelope = new Envelope(this.context, {
        attack,
        hold,
        decay,
        sustain,
        release,
      });
      // FIXME: current implementation of envelope requires it to be connected before being started
      // can probably just keep track of whether start has been called and re-call on connect if it has
      envelope.connect(output.gain);
      envelope.start(time);

      // Hooking everything up
      top.connect(this.topGain);
      sub.connect(this.subGain);

      this.voices[key] = {
        top,
        sub,
        envelope,
        output,
      };
    }
  }

  release(key: Key, stopTime?: number) {
    const voice = this.voices[key];

    if (voice) {
      Object.values(this.subscribers).forEach(subscriber => subscriber.onRelease(key));

      const time = stopTime ?? this.context.currentTime;

      console.log('releasing key', key);

      voice.envelope.stop(time);
      // TODO: avoid clip from this being discontinuously set before rest of envelope is finished
      voice.top.stop(time + voice.envelope.release);
      voice.sub.stop(time + voice.envelope.release);

      // Should only need a single event for this since it disconnects every parent node of output
      voice.top.onended = () => voice.output.disconnect();

      // Rely on garbage collection to destroy this when the references are dead?
      delete this.voices[key];
    }
  }

  play(key: Key) {
    if (!this.voices[key]) this.press(key);
  }

  stop(key: Key) {
    this.release(key);
  }

  subscribe(observer: KeypressObserver, id: string) {
    // Multiple subscriptions w/same id will overwrite the previous
    this.subscribers[id] = observer;
  }

  unsubscribe(id: string) {
    delete this.subscribers[id];
  }

  getInitState() {
    const synthInstance = this;

    return {
      topOscillator: new Proxy({ ...Synth.INIT_STATE.topOscillator }, {
        set(target, property, value, receiver) {
          console.log('receiver for property', property, 'set to value', value, ':', receiver);
          if (property === 'gain') {
            synthInstance.topGain.gain.setValueAtTime(value, synthInstance.context.currentTime);
          }
          
          return Reflect.set(target, property, value, receiver);
        }
      }),
      subOscillator: new Proxy({ ...Synth.INIT_STATE.subOscillator }, {
        set(target, property, value, receiver) {
          console.log('receiver for property', property, 'set to value', value, ':', receiver);
          if (property === 'gain') {
            synthInstance.subGain.gain.setValueAtTime(value, synthInstance.context.currentTime);
          }
          
          return Reflect.set(target, property, value, receiver);
        }
      }),
      lpf: new Proxy({ ...Synth.INIT_STATE.lpf }, {
        set(target, property, value, receiver) {
          console.log('receiver for property', property, 'set to value', value, ':', receiver);
          if (property === 'cutoff') {
            synthInstance.lowpass.frequency.setValueAtTime(value, synthInstance.context.currentTime)
          } else if (property === 'Q') {
            synthInstance.lowpass.Q.setValueAtTime(value, synthInstance.context.currentTime)
          }

          return Reflect.set(target, property, value, receiver);
        }
      }),
      vca: {
        ...Synth.INIT_STATE.vca
      }
    }
  }
}
