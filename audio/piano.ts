import { AudioIO } from 'audio/nodes/AudioIO';
import Comb from 'audio/nodes/comb';
import { Key, MESSAGE_SEPARATOR, PianoAction, KEY_TO_FREQUENCY, SEMITONE_WIDTH, ARG_SEPARATOR } from 'components/Pianuo/helpers';
import { Envelope } from "audio/nodes/Envelope";

export type Voice = {
  impact: ReturnType<Piano['getImpact']>;
  tricord: ReturnType<Piano['getTricord']>;
  filter: Comb;
  output: GainNode;
}

export type KeypressCallback = (note: Key) => void;
export type KeypressObserver = {
  onPress: KeypressCallback;
  onRelease: KeypressCallback;
}

// Tuning based on https://www.soundonsound.com/techniques/synthesizing-pianos
export class Piano extends AudioIO {
  static N_VOICES = 5;
  static GAIN = 1 / Piano.N_VOICES;
  static FULL_BANK = 0.5; // 100 ms
  static NEAR_UNIT = 1.005;
  static FULL_DECAY = 9; // 9 seconds
  static IMPACT_OSCILLATOR_TYPE: OscillatorNode['type'] = 'square';
  static TRICORD_OSCILLATOR_TYPE: OscillatorNode['type'] = 'triangle';

  context: AudioContext;
  ws: WebSocket;

  reverb: ConvolverNode;
  voices: Partial<Record<Key, Voice>> = {};
  send: GainNode;

  bank: number = Piano.FULL_BANK;

  // TODO: change this to be indexed w/key first to avoid unnecessary calls
  subscribers: Record<string, KeypressObserver> = {};

  constructor(context: AudioContext, ws: WebSocket) {
    super(context.createGain(), context.createGain());

    this.ws = ws;
    this.ws.onmessage = this.handleMessage.bind(this);

    this.context = context;

    this.reverb = this.context.createConvolver();

    this.send = this.context.createGain();

    this.output = this.context.createGain();
    this.output.gain.setValueAtTime(Piano.GAIN, this.context.currentTime);

    // this will turn on at a random point if the user stars playing before it's loaded
    // but that's a tomorrow problem
    fetch('/IMreverbs/Ruby Room.wav')
      .then(response => response.arrayBuffer())
      .then(buffer => this.context.decodeAudioData(buffer))
      .then(audioBuffer => this.reverb.buffer = audioBuffer);

    this.send.connect(this.reverb);
    this.reverb.connect(this.output);
  }

  getTricord(frequency: number, time: number) {
    const tricord = {
      left: this.context.createOscillator(),
      middle: this.context.createOscillator(),
      right: this.context.createOscillator(),
      leftGain: this.context.createGain(),
      middleGain: this.context.createGain(),
      rightGain: this.context.createGain(),
      output: this.context.createGain(),
      // TODO: delay
      envelope: new Envelope(this.context, {
        attack: 0.05,
        hold: 0,
        decay: Piano.FULL_DECAY,
        sustain: 0.05,
        release: 0.25
      }),
    }

    tricord.left.type = Piano.TRICORD_OSCILLATOR_TYPE;
    tricord.middle.type = Piano.TRICORD_OSCILLATOR_TYPE;
    tricord.right.type = Piano.TRICORD_OSCILLATOR_TYPE;

    tricord.left.frequency.setValueAtTime(frequency, time);
    tricord.middle.frequency.setValueAtTime(frequency, time);
    tricord.right.frequency.setValueAtTime(frequency, time);

    // Making these slightly out of tune but giving roughly the same "weight" to the positive
    // and negative detunes seems to make the beat effect more irregular and interesting
    tricord.left.detune.setValueAtTime(6, time);
    tricord.middle.detune.setValueAtTime(-2, time);
    tricord.right.detune.setValueAtTime(-4, time);

    // Mix evenly
    tricord.leftGain.gain.setValueAtTime(0.333, time);
    tricord.middleGain.gain.setValueAtTime(0.333, time);
    tricord.rightGain.gain.setValueAtTime(0.333, time);

    tricord.left.connect(tricord.leftGain);
    tricord.middle.connect(tricord.middleGain);
    tricord.right.connect(tricord.rightGain);

    tricord.leftGain.connect(tricord.output);
    tricord.middleGain.connect(tricord.output);
    tricord.rightGain.connect(tricord.output);

    tricord.envelope.connect(tricord.output.gain);

    tricord.left.start(time);
    tricord.middle.start(time);
    tricord.right.start(time);
    tricord.envelope.start(time);

    return tricord;
  }

  getImpact(frequency: number, time: number) {
    const impact = {
      left: this.context.createOscillator(),
      right: this.context.createOscillator(),
      leftGain: this.context.createGain(),
      rightGain: this.context.createGain(),
      output: this.context.createGain(),
      // TODO: delay
      envelope: new Envelope(this.context, {
        attack: 0.01,
        hold: 0.1,
        decay: 0.4,
        sustain: 0.001,
        release: 0.05
      }),
    }

    impact.left.type = Piano.IMPACT_OSCILLATOR_TYPE;
    impact.right.type = Piano.IMPACT_OSCILLATOR_TYPE;

    impact.left.frequency.setValueAtTime(frequency, time);
    impact.right.frequency.setValueAtTime(frequency, time);

    impact.left.detune.setValueAtTime(9, time);
    impact.right.detune.setValueAtTime(12, time);

    // Mix evenly
    impact.leftGain.gain.setValueAtTime(0.5, time);
    impact.rightGain.gain.setValueAtTime(0.5, time);

    impact.left.connect(impact.leftGain);
    impact.right.connect(impact.rightGain);

    impact.leftGain.connect(impact.output);
    impact.rightGain.connect(impact.output);

    impact.envelope.connect(impact.output.gain);

    impact.left.start(time);
    impact.right.start(time);
    impact.envelope.start(time);

    return impact;
  }

  press(key: Key, startTime?: number) {
    if (!this.voices[key]) {
      Object.values(this.subscribers).forEach(subscriber => subscriber.onPress(key));
      const time = startTime ?? this.context.currentTime;
      const frequency = KEY_TO_FREQUENCY[key] * Piano.NEAR_UNIT;

      const voiceOutput = this.context.createGain();

      const impact = this.getImpact(frequency, time);
      const tricord = this.getTricord(frequency, time);
      // TODO: currently not hooked up to anything
      const combFilter = new Comb(this.context, {
        delay: 1 / (2 * frequency),
        cutoff: frequency,
      } as any);

      const bandpass = this.context.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.Q.setValueAtTime(0.3, time);
      bandpass.frequency.setValueAtTime(frequency, time);

      const impactGain = this.context.createGain();
      const tricordGain = this.context.createGain();

      impactGain.gain.setValueAtTime(0.5, time);
      tricordGain.gain.setValueAtTime(0.5, time);

      // Hooking everything up
      impact.output.connect(combFilter.input);
      tricord.output.connect(combFilter.input);
      combFilter._filter.type = 'highpass';

      combFilter.output.connect(bandpass);
      bandpass.connect(voiceOutput);

      voiceOutput.connect(this.send);

      this.voices[key] = {
        impact,
        tricord,
        filter: combFilter,
        output: voiceOutput,
      };
    }
  }

  release(key: Key, stopTime?: number) {
    const voice = this.voices[key];

    if (voice) {
      Object.values(this.subscribers).forEach(subscriber => subscriber.onRelease(key));

      const time = stopTime ?? this.context.currentTime;

      console.log('releasing key', key);

      voice.tricord.envelope.stop(time);
      voice.impact.envelope.stop(time);
      // TODO: avoid clip from this being discontinuously set before rest of envelope is finished
      voice.tricord.left.stop(time + voice.tricord.envelope.release);
      voice.tricord.middle.stop(time + voice.tricord.envelope.release);
      voice.tricord.right.stop(time + voice.tricord.envelope.release);

      voice.impact.left.stop(time + voice.impact.envelope.release);
      voice.impact.right.stop(time + voice.impact.envelope.release);

      // Should only need a single event for this since it disconnects every parent node
      voice.tricord.middle.onended = () => voice.output.disconnect();

      // Rely on garbage collection to destroy this when the references are dead?
      delete this.voices[key];
    }
  }

  play(key: Key) {
    if (!this.voices[key]) {
      // TODO: use URLSearchParams for this
      this.ws.send(`press${MESSAGE_SEPARATOR}key=${key}${ARG_SEPARATOR}time=${this.context.currentTime}`);

      this.press(key);
    }
  }

  stop(key: Key) {
      // TODO: use URLSearchParams for this
    this.ws.send(`release${MESSAGE_SEPARATOR}key=${key}${ARG_SEPARATOR}time=${this.context.currentTime}`);

    this.release(key);
  }

  handleMessage(message: MessageEvent) {
    const [ action, params ]: [ PianoAction, string ] = message.data.split(MESSAGE_SEPARATOR);
    const query = new URLSearchParams(params);
    const key: Key = query.get('key') as Key;
    const now = this.context.currentTime;

    if (action === 'press') this.press(key, now);
    else if (action === 'release') this.release(key, now);
  }

  subscribe(observer: KeypressObserver, id: string) {
    // Multiple subscriptions w/same id will overwrite the previous
    this.subscribers[id] = observer;
  }

  unsubscribe(id: string) {
    delete this.subscribers[id];
  }
}
