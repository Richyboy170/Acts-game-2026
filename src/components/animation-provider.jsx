'use client';

import { MotionConfig } from 'motion/react';

export function AnimationProvider({ children }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
