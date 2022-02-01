import { Key, MESSAGE_SEPARATOR, PianoAction, KEY_TO_FREQUENCY, SEMITONE_WIDTH, ARG_SEPARATOR } from './helpers';
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
  static GAIN = 0.05;

  context: AudioContext;
  ws: WebSocket;

  reverb: ConvolverNode;
  eq: BiquadFilterNode;
  outputGain: GainNode;
  voices: Partial<Record<Key, Voice>> = {};

  prevStartTime: number = 0;
  keyToStartTime: Partial<Record<Key, number>> = {};

  peerPrevStartTime: number = 0;
  peerKeyToStartTime: Partial<Record<Key, number>> = {};

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

  press(key: Key, startTime?: number) {
    if (!this.voices[key]) {
      Object.values(this.subscribers).forEach(subscriber => subscriber.onPress(key));
      const time = startTime ?? this.context.currentTime;

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

      voice.oscillator.frequency.setValueAtTime(baseFrequency, time);
      voice.oscillator.start(time);

      // Play this oscillator an octave above the base wave
      voice.interval.frequency.setValueAtTime(baseFrequency * SEMITONE_WIDTH ** 12, time);
      // voice.interval.frequency.setValueAtTime(baseFrequency, now);
      voice.interval.start(time);

      // Vibrato
      const vibrato = this.context.createOscillator();
      const vibratoGain = this.context.createGain();
      vibrato.frequency.setValueAtTime(5, time);
      vibrato.start();
      vibratoGain.gain.setValueAtTime(6.5, time);
      vibrato.connect(vibratoGain);
      vibratoGain.connect(voice.oscillator.frequency);

      // Detune
      // voice.interval.detune.setValueAtTime(7, now);

      // Adjust relative volume
      const oscillatorGain = this.context.createGain();
      const intervalGain = this.context.createGain();

      oscillatorGain.gain.setValueAtTime(0.7, time);
      intervalGain.gain.setValueAtTime(0.3, time);

      // Hooking everything up
      voice.oscillator.connect(voice.gain);
      voice.interval.connect(voice.gain);
      voice.gain.connect(this.outputGain);

      voice.envelope.connect(voice.gain.gain);
      voice.envelope.start(time);

      this.voices[key] = voice;
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
      voice.oscillator.stop(time + voice.envelope.release);
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
    console.log('got message', message);
    const [ action, params ]: [ PianoAction, string ] = message.data.split(MESSAGE_SEPARATOR);
    const query = new URLSearchParams(params);
    const key: Key = query.get('key') as Key;
    const peerTime = Number(query.get('time'));
    const now = this.context.currentTime;

    // if (action === 'press') this.press(key);
    // else if (action === 'release') this.release(key);

    if (action === 'press') {
      // For tracking how far apart two consecutively-pressed keys should be played
      const peerDifferential = peerTime - this.peerPrevStartTime;
      console.log('got peer press differential', peerDifferential);
      // update state
      this.peerPrevStartTime = peerTime;
      this.peerKeyToStartTime[key] = peerTime;

      const intendedStartTime = this.prevStartTime + peerDifferential;

      // If peerDifferential ms haven't passed, wait until they have
      if (now < intendedStartTime) {
        const timeRemaining = intendedStartTime - now;

        // console.log('waiting', timeRemaining, 'to press');
        // this.press(key, intendedStartTime);
        // this.keyToStartTime[key] = intendedStartTime;

        // this.prevStartTime = intendedStartTime;

        const experimentalStartTime = now + timeRemaining % 1;
        console.log('waiting', timeRemaining % 1, 'to press');
        this.press(key, experimentalStartTime);
        this.keyToStartTime[key] = experimentalStartTime;

        this.prevStartTime = experimentalStartTime;
      } else { // press immediately
        console.log('pressing immediately');
        this.press(key, now);
        this.keyToStartTime[key] = now;

        this.prevStartTime = now;
      }
    } else if (action === 'release') {
      if (!this.peerKeyToStartTime[key] || !this.keyToStartTime[key]) this.release(key);
      else {
        const peerDifferential = peerTime - this.peerKeyToStartTime[key]!;
        console.log('got peer release differential', peerDifferential);

        this.release(key, this.keyToStartTime[key]! + peerDifferential);

        // Clean up so these don't mess up future press/release events
        delete this.keyToStartTime[key];
        delete this.peerKeyToStartTime[key];
      }
    }
  }

  subscribe(observer: KeypressObserver, id: string) {
    // Multiple subscriptions w/same id will overwrite the previous
    this.subscribers[id] = observer;
  }

  unsubscribe(id: string) {
    delete this.subscribers[id];
  }
}
