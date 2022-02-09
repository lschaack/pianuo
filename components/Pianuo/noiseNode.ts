export class NoiseNode {
  gain: GainNode;

  constructor(context: AudioContext) {
    this.gain = context.createGain();

    // create noise https://developer.mozilla.org/en-US/docs/Web/API/AudioNode
    const noiseLength = 2;
    const bufferSize = context.sampleRate * noiseLength;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);

    // fill the buffer with noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    noise.connect(this.gain);
    noise.start();
  }

  connect(node: AudioNode | AudioParam) {
    this.gain.connect(node as any); // TODO: see if this actually works for both, then type
  }

  disconnect() {
    this.gain.disconnect();
  }
}
