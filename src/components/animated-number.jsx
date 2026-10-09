'use client';

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect } from 'react';

export function AnimatedNumber({ value, className = '', duration = 0.72 }) {
  const motionValue = useMotionValue(value);
  const prefersReducedMotion = useReducedMotion();
  const formatted = useTransform(motionValue, (current) => new Intl.NumberFormat('en-US').format(Math.round(current)));

  useEffect(() => {
    if (prefersReducedMotion) {
      motionValue.set(value);
      return undefined;
    }
    const controls = animate(motionValue, value, { duration, ease: [0.18, 0.68, 0.24, 1] });
    return controls.stop;
  }, [duration, motionValue, prefersReducedMotion, value]);

  return <motion.span className={className}>{formatted}</motion.span>;
}
