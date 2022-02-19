import { AudioIO } from 'audio/nodes/AudioIO';
import { Key, MESSAGE_SEPARATOR, PianoAction, KEY_TO_FREQUENCY, SEMITONE_WIDTH, ARG_SEPARATOR } from 'components/Pianuo/helpers';
import { Envelope } from "audio/nodes/Envelope";

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

export class Piano extends AudioIO {
  static N_VOICES = 5;
  static GAIN = 0.05;
  static FULL_BANK = 0.5; // 100 ms

  context: AudioContext;
  ws: WebSocket;

  reverb: ConvolverNode;
  eq: BiquadFilterNode;
  voices: Partial<Record<Key, Voice>> = {};

  prevStartTime: number = 0;
  keyToStartTime: Partial<Record<Key, number>> = {};

  peerPrevStartTime: number = 0;
  peerKeyToStartTime: Partial<Record<Key, number>> = {};

  bank: number = Piano.FULL_BANK;

  // TODO: change this to be indexed w/key first to avoid unnecessary calls
  subscribers: Record<string, KeypressObserver> = {};

  constructor(context: AudioContext, ws: WebSocket) {
    super(context.createGain(), context.createGain());

    this.ws = ws;
    this.ws.onmessage = this.handleMessage.bind(this);

    this.context = context;

    this.reverb = this.context.createConvolver();

    this.output = this.context.createGain();
    this.output.gain.setValueAtTime(Piano.GAIN, this.context.currentTime);

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
    // this.output.connect(this.eq);
    // this.eq.connect(this.reverb);
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
          sustain: 0.15,
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
      voice.gain.connect(this.output);

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
      voice.oscillator.onended = () => voice.gain.disconnect();
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
    // console.log('got message', message);
    const [ action, params ]: [ PianoAction, string ] = message.data.split(MESSAGE_SEPARATOR);
    const query = new URLSearchParams(params);
    const key: Key = query.get('key') as Key;
    const peerTime = Number(query.get('time'));
    const now = this.context.currentTime;

    // if (action === 'press') this.press(key);
    // else if (action === 'release') this.release(key);

    if (action === 'press') {
      this.press(key, now);

      // // For tracking how far apart two consecutively-pressed keys should be played
      // const peerDifferential = peerTime - this.peerPrevStartTime;
      // // ~ the issue is here
      // // prevStartTime is scheduled for the future
      // // so if FULL_BANK is 4 seconds and two notes play less than 4 seconds apart,
      // // self differential will cover almost the entire bank
      // const selfDifferential = now - this.prevStartTime;
      // // the gap between these two is the difference in how much time has passed "here" vs "there"
      // // if positive, more time has passed here than there
      // // if negative, less time has passed here than there
      // const differential = selfDifferential - peerDifferential;
      // if (selfDifferential > 1) this.bank = Piano.FULL_BANK;
      
      // console.log('peer differential', peerDifferential);
      // console.log('self differential', selfDifferential);
      // console.log('differential', differential);

      // // update state
      // this.peerPrevStartTime = peerTime;
      // this.peerKeyToStartTime[key] = peerTime;

      // // If the note should have already been played, borrow it from the bank
      // // TODO: condense these b/c/o common ending
      // if (differential < 0) {
      //   const newBalance = Math.max(this.bank + differential, 0);
      //   console.log('playing in', newBalance, 'seconds, borrowing', differential);
      //   const borrowedStartTime = now + newBalance;
      //   this.press(key, borrowedStartTime);

      //   this.bank = newBalance;
      //   this.keyToStartTime[key] = borrowedStartTime;
      //   // addressing ~
      //   // set to actual time so calculations hopefully work out
      //   this.prevStartTime = now;
      // } else { // Else add any remainder to bank
      //   // console.log('playing', this.bank + differential, 'seconds from now');
      //   const bankedStartTime = now + this.bank + differential;
      //   console.log('playing in', this.bank + differential, 'seconds');
      //   this.press(key, bankedStartTime);

      //   this.bank = this.bank + differential; // Math.min(this.bank + differential, Piano.FULL_BANK);
      //   this.keyToStartTime[key] = bankedStartTime;
      //   // addressing ~
      //   // set to actual time so calculations hopefully work out
      //   this.prevStartTime = now;
      // }
      
      // console.log('bank', this.bank);
    } else if (action === 'release') {
      if (!this.peerKeyToStartTime[key] || !this.keyToStartTime[key]) this.release(key);
      else {
        const peerDifferential = peerTime - this.peerKeyToStartTime[key]!;
        // console.log('got peer release differential', peerDifferential);

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
