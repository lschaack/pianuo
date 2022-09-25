import { mixToDryWet } from './utils/audio';
import { subOctave } from './../components/Pianuo/helpers';
import { AudioIO } from 'audio/nodes/AudioIO';
import Comb from 'audio/nodes/comb';
import { Key, MESSAGE_SEPARATOR, PianoAction, KEY_TO_FREQUENCY, SEMITONE_WIDTH, ARG_SEPARATOR } from 'components/Pianuo/helpers';
import { Envelope, EnvelopeParams } from "audio/nodes/Envelope";

export type Voice = {
  top: ReturnType<Synth['getTop']>;
  sub: ReturnType<Synth['getSub']>;
  // noise: ReturnType<Synth['getNoise']>;
  vcaEg: Envelope;
  vcfEg: Envelope;
  filter: BiquadFilterNode;
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
    keytrack: number;
  };
  vcaEg: EnvelopeParams;
  vcfEg: EnvelopeParams;
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
      cutoff: 20000,
      resonance: 1,
      keytrack: 0,
    },
    vcaEg: {
      attack: 0, // 0.10,
      hold: 0,
      decay: 3, // 0.5,
      sustain: 0.001,
      release: 0.5,
    },
    vcfEg: {
      attack: 0.25,
      hold: 0,
      decay: 1,
      sustain: 0.001,
      release: 0.5,
    },
  }

  // static FULL_DECAY = 9; // 9 seconds

  context: AudioContext;

  private voices: Partial<Record<Key, Voice>> = {};
  private send: GainNode;
  // private lowpass: BiquadFilterNode;
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

    this.output = this.context.createGain();
    this.output.gain.setValueAtTime(Synth.GAIN, now);

    this.send.connect(this.return);
    // this.send.connect(this.lowpass);
    // TODO: at least a separate highpass, room for other in-built effects here
    // this.lowpass.connect(this.return);
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
    // TODO: this isn't doing much since voices get deleted immediately upon releasing the key,
    //       how do I want to handle pressing a key before its envelopes are finished?
    if (!this.voices[key]) {
      Object.values(this.subscribers).forEach(subscriber => subscriber.onPress(key));

      const time = startTime ?? this.context.currentTime;
      const frequency = KEY_TO_FREQUENCY[key];
      // TODO: make sub octave editable
      const subFrequency = KEY_TO_FREQUENCY[subOctave(key, 1)];

      const top = this.getTop(frequency, time);
      const sub = this.getSub(subFrequency, time);

      const topGain = this.context.createGain();
      const subGain = this.context.createGain();
      topGain.gain.setValueAtTime(this.knobs.topOscillator.gain, time);
      subGain.gain.setValueAtTime(this.knobs.subOscillator.gain, time);

      const voiceOutput = this.context.createGain();
      voiceOutput.gain.setValueAtTime(0, time);

      const vcaEg = new Envelope(this.context, this.knobs.vcaEg);
      // FIXME: current implementation of vcaEg requires it to be connected before being started
      // can probably just keep track of whether start has been called and re-call on connect if it has
      vcaEg.connect(voiceOutput.gain);
      vcaEg.start(time);

      const filter = this.context.createBiquadFilter();
      filter.Q.setValueAtTime(this.knobs.lpf.resonance, time);
      filter.frequency.setValueAtTime(0, time);

      // FIXME: this is the first thing I came up with, probably how 0% of synths actually handle keytracking
      const keytrackedFrequency = this.knobs.lpf.cutoff + this.knobs.lpf.keytrack * frequency;

      const vcfEg = new Envelope(this.context, {
        ...this.knobs.vcfEg,
        amount: keytrackedFrequency
      });

      vcfEg.connect(filter.frequency);
      vcfEg.start(time);

      // Hooking everything up
      top.connect(topGain);
      sub.connect(subGain);
      topGain.connect(voiceOutput);
      subGain.connect(voiceOutput);
      voiceOutput.connect(filter);
      filter.connect(this.send);

      this.voices[key] = {
        top,
        sub,
        vcaEg,
        vcfEg,
        filter,
        output: voiceOutput,
      };
    }
  }

  release(key: Key, stopTime?: number) {
    const voice = this.voices[key];

    if (voice) {
      Object.values(this.subscribers).forEach(subscriber => subscriber.onRelease(key));

      const time = stopTime ?? this.context.currentTime;

      voice.vcaEg.stop(time);
      // TODO: avoid clip from this being discontinuously set before rest of vcaEg is finished
      voice.top.stop(time + voice.vcaEg.release);
      voice.sub.stop(time + voice.vcaEg.release);

      voice.top.onended = () => {
        voice.top.disconnect();
        voice.sub.disconnect();
        voice.output.disconnect();
      }

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
    // quick and dirty deep clone
    return JSON.parse(JSON.stringify(Synth.INIT_STATE));
  }
}
