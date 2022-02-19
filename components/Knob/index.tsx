import React, { useState, useEffect, useMemo } from 'react';
import { clampUnit } from '../Pianuo/utils';
import { useDrag } from './useDrag';

import styles from './styles.module.scss';

const CIRCLE_FILL_PERCENTAGE = 0.8;
const PX_PER_VALUE = 300;
const STROKE_COLOR = 'cyan';
// Start at 60deg, end at 360deg, rotating entire circle to appear as 240deg to 270deg
const SIXTY_DEG = Math.PI / 3;
const ARC_START = SIXTY_DEG;
const ARC_END = 2 * Math.PI;
const ARC_LENGTH = ARC_END - ARC_START;

const SIZE = 75; // px, needs to match --size in styles (TODO...)

type KnobState = {
  halfSize: number;
  radius: number;
  endX: number;
  endY: number;
  levelTransform: string;
}

interface KnobProps {
  // label: string;
  onChange?: (value: number) => void;
  init?: number;
}

export const Knob = ({ onChange, init }: KnobProps) => {
  const [ value, setValue ] = useState(init ?? 0.6);
  useEffect(() => onChange?.(value), [ value, onChange ]);

  const { setIsDragging } = useDrag(dx => setValue(prev => clampUnit(prev + dx / PX_PER_VALUE)));

  const { halfSize, radius, endX, endY, levelTransform }: KnobState = useMemo(() => {
    const halfSize = SIZE / 2;
    const radius = halfSize * CIRCLE_FILL_PERCENTAGE;
    // rotate the level to place the 60 degree gap at the bottom of the circle
    const levelTransform = `rotate(120, ${halfSize}, ${halfSize})`;

    return {
      halfSize,
      radius,
      endX: halfSize + radius * Math.cos(ARC_END),
      endY: halfSize - radius * Math.sin(ARC_END),
      levelTransform,
    }
  }, []);

  // The start of the arc is at the end/max value of the knob b/c/o how I'm drawing the path
  const currentStart = ARC_END - value * ARC_LENGTH;
  const useLongArc = currentStart <= Math.PI;
  const longArc = Number(useLongArc);
  const shortArc = 1 - longArc; // slightly quicker (I think) path to Number(!longArc)
  const startX = halfSize + radius * Math.cos(currentStart);
  const startY = halfSize - radius * Math.sin(currentStart);

  return (
    <div>
      <div className={styles.knobWrapper}>
        {/* knob */}
        <div
          onMouseDown={() => setIsDragging(true)}
          className={styles.knob}
        >
          {/* divot */}
          <div
            className={styles.divot}
            style={{
              // draw a circle following the level path halfway out from the center
              // halfway is 25% b/c 100% is thefull width of the knob = diameter
              left: `${25 * Math.cos(2 * SIXTY_DEG + value * 5 * SIXTY_DEG)}%`,
              top: `${25 * Math.sin(2 * SIXTY_DEG + value * 5 * SIXTY_DEG)}%`,
            }}
          />
        </div>
      </div>
      <svg
        height={`${SIZE}px`}
        width={`${SIZE}px`}
      >
        {/* level */}
        <path
          stroke={STROKE_COLOR}
          fill="transparent"
          transform={levelTransform}
          strokeWidth={4}
          strokeLinecap='round'
          // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d#path_commands
          d={`
            M ${startX},${startY}
            A ${radius},${radius} ${shortArc},${longArc},0 ${endX},${endY}
          `}
        />
      </svg>
    </div>
  );
};
