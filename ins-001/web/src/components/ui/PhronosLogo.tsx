/**
 * Phronos Logo Component
 *
 * Animated ouroboros (self-consuming serpent) logo with a pulsing gold center.
 * Uses the PhronosLens animation class for consistent branding with phronos-site.
 */

import React, { useEffect, useRef } from 'react';
import { PhronosLens, type Theme } from '../../lib/logo-animation';

interface PhronosLogoProps {
  size?: number;
  theme?: Theme;
}

export const PhronosLogo: React.FC<PhronosLogoProps> = ({ size = 31, theme = 'dark' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lensRef = useRef<PhronosLens | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create and start the lens animation
    const lens = new PhronosLens(canvas, { size, theme });
    lens.start();
    lensRef.current = lens;

    // Cleanup
    return () => {
      lens.stop();
      lensRef.current = null;
    };
  }, [size, theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
      }}
      aria-label="Phronos Logo"
    />
  );
};
