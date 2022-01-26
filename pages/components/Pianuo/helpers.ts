export const A_4_PITCH = 440;
export const A_4_POSITION = 49;
// https://en.wikipedia.org/wiki/Equal_temperament#Mathematics
export const SEMITONE_WIDTH = 2 ** (1 / 12);
export const SEPARATOR = '|';

export const notes = [ 'A', 'B', 'C', 'D', 'E', 'F', 'G' ] as const;
export const octaves = [ '0', '1', '2', '3', '4', '5', '6', '7', '8' ] as const;
export const accidentals = [ '#', 'b', '-' ] as const;

export type Note = typeof notes[number];
export type Accidental = typeof accidentals[number];
export type Octave = typeof octaves[number];

export type Key = `${Note}${Accidental}${Octave}`;

export type PianoAction = 'press' | 'release';
export type PianoMessage = `${PianoAction}${typeof SEPARATOR}${Key}`

export const getNote = (key: Key): Note => key[0] as Note;
export const getAccidental = (key: Key): Accidental => key[1] as Accidental;
export const getOctave = (key: Key): Octave => key[2] as Octave;

export const A_DIFF_POSITION: Record<Note, number> = {
  'A': 0,
  'B': 2,
  'C': -9,
  'D': -7,
  'E': -5,
  'F': -4,
  'G': -2,
}

export const getPosition = (key: Key) => {
  const octave = Number(getOctave(key));
  const accidental = getAccidental(key);
  const aPosition = 12 * octave + 1;
  const adjustedPosition = aPosition + A_DIFF_POSITION[getNote(key)];
  const finalPosition = adjustedPosition + (
    accidental === '#' ? 1
    : accidental === 'b' ? -1
    : 0
  )

  return finalPosition;
}

export const getAllKeys = (): Key[] => octaves.flatMap(octave => (
  notes.flatMap(note => (
    accidentals.flatMap(accidental => (
      `${note}${accidental}${octave}` as Key
    ))
  ))
));

export const KEY_TO_FREQUENCY: Record<Key, number> = Object.fromEntries(
  getAllKeys().map<[Key, number]>(key => [
    key,
    A_4_PITCH * SEMITONE_WIDTH ** (getPosition(key) - A_4_POSITION)
  ])
) as Record<Key, number>; // Object.fromEntries broadens type to { [key: string]: number }

export const isBlackKey = (key: Key) => [ '#', 'b' ].includes(key[1]);
