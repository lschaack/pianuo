export class AudioIO<TOptions = {}> {
  input: AudioNode;
  output: AudioNode;

  constructor(input: AudioNode, output: AudioNode) {
    this.input = input;
    this.output = output;
  }

  connect(destination: AudioNode | AudioIO) {
    if (destination instanceof AudioIO) this.output.connect(destination.input);
    else this.output.connect(destination);
  }

  disconnect() {
    this.output.disconnect();
  }

  // TODO: literally anything else
  setOptions(options: TOptions) {
    Object.entries(options).forEach(([option, value]) => {
      // lol
      // eslint-disable-next-line
      // @ts-ignore-next-line
      if (value) this[option] = value;
    });
  }
}
