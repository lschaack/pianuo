import { normalizeFromRange } from './utils/audio';
import { AudioIO } from 'audio/nodes/AudioIO';
import { Key, MESSAGE_SEPARATOR, PianoAction, KEY_TO_FREQUENCY, SEMITONE_WIDTH, ARG_SEPARATOR } from 'components/Pianuo/helpers';
import { Envelope } from "audio/nodes/Envelope";

export type Voice = {
  impact: ReturnType<Piano['getImpact']>;
  tricord: ReturnType<Piano['getTricord']>;
  filter: ReturnType<Piano['getBrightnessFilter']>;
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
  static GAIN = 0.05;
  static FULL_BANK = 0.5; // 100 ms
  static NEAR_UNIT = 1.005;
  static FULL_DECAY = 9; // 9 seconds
  static OSCILLATOR_TYPE: OscillatorNode['type'] = 'sawtooth';

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

    tricord.left.type = Piano.OSCILLATOR_TYPE;
    tricord.middle.type = Piano.OSCILLATOR_TYPE;
    tricord.right.type = Piano.OSCILLATOR_TYPE;

    tricord.left.frequency.setValueAtTime(frequency, time);
    tricord.middle.frequency.setValueAtTime(frequency, time);
    tricord.right.frequency.setValueAtTime(frequency, time);

    tricord.left.detune.setValueAtTime(6, time);
    tricord.right.detune.setValueAtTime(-6, time);

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
        attack: 0.001,
        hold: 0.1,
        decay: 0.4,
        sustain: 0.001,
        release: 0.05
      }),
    }

    impact.left.type = Piano.OSCILLATOR_TYPE;
    impact.right.type = Piano.OSCILLATOR_TYPE;

    impact.left.frequency.setValueAtTime(frequency, time);
    impact.right.frequency.setValueAtTime(frequency, time);

    // TODO: mess with these
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

  getBrightnessFilter(frequency: number, time: number) {
    const filter = {
      filter: this.context.createBiquadFilter(),
      // output: this.context.createGain(),
      // TODO: delay
      envelope: new Envelope(this.context, {
        attack: 0.001,
        hold: 0,
        decay: Piano.FULL_DECAY,
        sustain: 0.001,
        release: 0.05
      }),
    }

    filter.filter.type = 'lowpass';

    // using 5000 (~D#8—a higher note than an 88-key keyboard has) as max frequency
    const MAX_FREQUENCY = 5000;
    // TODO: make this a little less basic than lowest notes take full 9 seconds, highest take 0
    // filter.envelope.decay = 1 / normalizeFromRange(0, MAX_FREQUENCY, frequency) * Piano.FULL_DECAY;

    // TODO: something less basic here too probably
    // filter.envelope.connect(filter.filter.frequency);

    filter.envelope.start(time);

    return filter;
  }

  press(key: Key, startTime?: number) {
    if (!this.voices[key]) {
      Object.values(this.subscribers).forEach(subscriber => subscriber.onPress(key));
      const time = startTime ?? this.context.currentTime;
      const frequency = KEY_TO_FREQUENCY[key] * Piano.NEAR_UNIT;

      const voiceOutput = this.context.createGain();

      const impact = this.getImpact(frequency, time);
      const tricord = this.getTricord(frequency, time);
      const filter = this.getBrightnessFilter(frequency, time);

      const impactGain = this.context.createGain();
      const tricordGain = this.context.createGain();

      impactGain.gain.setValueAtTime(0.5, time);
      tricordGain.gain.setValueAtTime(0.5, time);

      // Vibrato
      // const vibrato = this.context.createOscillator();
      // const vibratoGain = this.context.createGain();
      // vibrato.frequency.setValueAtTime(5, time);
      // vibrato.start();
      // vibratoGain.gain.setValueAtTime(6.5, time);
      // vibrato.connect(vibratoGain);
      // vibratoGain.connect(voice.oscillator.frequency);

      // Hooking everything up
      // impact.output.connect(filter.filter);
      // tricord.output.connect(filter.filter);
      // filter.filter.connect(voiceOutput);
      impact.output.connect(voiceOutput);
      tricord.output.connect(voiceOutput);
      voiceOutput.connect(this.output);

      this.voices[key] = {
        impact,
        tricord,
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

      console.log('releasing key', key);

      voice.tricord.envelope.stop(time);
      voice.impact.envelope.stop(time);
      voice.filter.envelope.stop(time);
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
