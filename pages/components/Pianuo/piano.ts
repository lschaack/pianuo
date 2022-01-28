import { Key, SEPARATOR, PianoAction, KEY_TO_FREQUENCY, SEMITONE_WIDTH } from './helpers';
import { Envelope } from "./envelope";

export type Voice = {
  oscillator: OscillatorNode;
  interval: OscillatorNode;
  gain: GainNode;
  envelope: Envelope;
}

export type KeypressCallback = (note: Key) => void;
export type KeypressObserver = {
  onPress: KeypressCallback;
  onRelease: KeypressCallback;
}

export class Piano {
  static N_VOICES = 5;
  static GAIN = 0.2;

  context: AudioContext;
  ws: WebSocket;

  reverb: ConvolverNode;
  eq: BiquadFilterNode;
  outputGain: GainNode;
  voices: Partial<Record<Key, Voice>> = {};

  // TODO: change this to be indexed w/key first to avoid unnecessary calls
  subscribers: Record<string, KeypressObserver> = {};

  constructor(context: AudioContext, ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = this.handleMessage.bind(this);

    this.context = context;

    this.reverb = this.context.createConvolver();

    this.outputGain = this.context.createGain();
    this.outputGain.gain.setValueAtTime(Piano.GAIN, this.context.currentTime);

    // TODO: per-voice eq w/envelope
    this.eq = this.context.createBiquadFilter();
    this.eq.type = 'lowpass';
    this.eq.frequency.setValueAtTime(10000, context.currentTime);

    // this will turn on at a random point if the user stars playing before it's loaded
    // but that's a tomorrow problem
    fetch('/IMreverbs/Nice Drum Room.wav')
      .then(response => response.arrayBuffer())
      .then(buffer => this.context.decodeAudioData(buffer))
      .then(audioBuffer => this.reverb.buffer = audioBuffer);

    // hooking everything up
    // TODO: outputGain should probably be the last node
    // this.outputGain.connect(this.eq);
    // this.eq.connect(this.reverb);
    // this.reverb.connect(context.destination);

    this.outputGain.connect(context.destination);
  }

  press(key: Key) {
    if (!this.voices[key]) {
      Object.values(this.subscribers).forEach(subscriber => subscriber.onPress(key));

      const now = this.context.currentTime;

      const voice = {
        oscillator: this.context.createOscillator(),
        interval: this.context.createOscillator(),
        gain: this.context.createGain(),
        envelope: new Envelope(this.context, {
          attack: 0.03,
          hold: 0.05,
          decay: 0.3,
          sustain: 0.05,
          release: 0.4
        }),
      }

      this.voices[key]?.gain.disconnect();
      const baseFrequency = KEY_TO_FREQUENCY[key];

      voice.oscillator.type = 'sine';
      voice.interval.type = 'sine';

      voice.oscillator.frequency.setValueAtTime(baseFrequency, now);
      voice.oscillator.start(now);

      // Play this oscillator an octave above the base wave
      voice.interval.frequency.setValueAtTime(baseFrequency * SEMITONE_WIDTH ** 12, now);
      // voice.interval.frequency.setValueAtTime(baseFrequency, now);
      voice.interval.start(now);

      // Vibrato
      const vibrato = this.context.createOscillator();
      const vibratoGain = this.context.createGain();
      vibrato.frequency.setValueAtTime(5, now);
      vibrato.start();
      vibratoGain.gain.setValueAtTime(6.5, now);
      vibrato.connect(vibratoGain);
      vibratoGain.connect(voice.oscillator.frequency);

      // Detune
      // voice.interval.detune.setValueAtTime(7, now);

      // Adjust relative volume
      const oscillatorGain = this.context.createGain();
      const intervalGain = this.context.createGain();

      oscillatorGain.gain.setValueAtTime(0.7, now);
      intervalGain.gain.setValueAtTime(0.3, now);

      // Hooking everything up
      voice.oscillator.connect(voice.gain);
      voice.interval.connect(voice.gain);
      voice.gain.connect(this.outputGain);

      voice.envelope.connect(voice.gain.gain);
      voice.envelope.start(now);

      this.voices[key] = voice;
    }
  }

  release(key: Key) {
    const voice = this.voices[key];

    if (voice) {
      Object.values(this.subscribers).forEach(subscriber => subscriber.onRelease(key));

      const now = this.context.currentTime;

      console.log('releasing key', key);

      voice.envelope.stop(now);
      // TODO: avoid clip from this being discontinuously set before rest of envelope is finished
      voice.oscillator.stop(now + voice.envelope.release);
      // Rely on garbage collection to destroy this when the references are dead?
      delete this.voices[key];
    }
  }

  play(key: Key) {
    if (!this.voices[key]) {
      this.ws.send(`press${SEPARATOR}${key}`);

      this.press(key);
    }
  }

  stop(key: Key) {
    this.ws.send(`release${SEPARATOR}${key}`);

    this.release(key);
  }

  handleMessage(message: MessageEvent) {
    console.log('got message', message);
    const [ action, key ]: [ PianoAction, Key ] = message.data.split(SEPARATOR);

    if (action === 'press') this.press(key);
    else this.release(key);
  }

  subscribe(observer: KeypressObserver, id: string) {
    // Multiple subscriptions w/same id will overwrite the previous
    this.subscribers[id] = observer;
  }

  unsubscribe(id: string) {
    delete this.subscribers[id];
  }
}
