export const memoize = <ArgType extends Array<T>, ReturnType, T = any>(fn: (...args: ArgType) => ReturnType) => {
  const memoized = new Map();

  return (...args: ArgType) => memoized.get(args) || memoized.set(args, fn(...args)).get(args);
};

// https://joshondesign.com/2013/03/01/improvedEasingEquations
export const easeInCubic = (t: number) => t ** 3;

export const easeOutCubic = (t: number) => 1 - easeInCubic(1 - t);

export const easeInOutCubic = (t: number) => (
  t < 0.5
    ? easeInCubic(2 * t) / 2
    : 1 - easeInCubic(2 * (1 - t)) / 2
);

export const easeInOutCubicInflection = memoize(
  (tInflection: number, t: number) => {
   if (t < tInflection) {
     const headCurvature = 1 / tInflection; // less is more
  
     return easeInCubic(headCurvature * t) / headCurvature;
   }
  
   const tailCurvature = 1 / (1 - tInflection);
  
   return 1 - easeInCubic(tailCurvature * (1 - t)) / tailCurvature;
  }
);

export const easeInOutSine = (x: number) => (
  0.5 - Math.cos(Math.PI * x) / 2
);
