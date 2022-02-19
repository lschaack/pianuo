import { AudioIO } from "audio/nodes/AudioIO";
import clamp from "lodash/clamp";

export const normalizeToRange = (min: number, max: number, input: number) =>
  clamp(input, 0, 1) * (max - min) + min;

export const normalizeFromRange = (min: number, max: number, input: number) =>
  (clamp(input, min, max) - min) / (max - min);

export const isIO = <TNode extends AudioIO>(node: AudioNode | TNode): node is TNode => (
  node instanceof AudioIO
);

export const mixToDryWet = (mix: number): [number, number] => [1 - mix, mix];
