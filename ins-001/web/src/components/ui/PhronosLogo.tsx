/**
 * Phronos Logo Component
 * 
 * Animated ouroboros (self-consuming serpent) logo with pulsing gold center.
 * Based on logo-animation.js specifications.
 */

import React, { useEffect, useRef } from 'react';

// Brand Colors (from vision/BRAND.yaml)
const COLORS = {
  ink: '#1A1A1A',
  gold: '#B08D55',
  goldDim: 'rgba(176, 141, 85, 0.4)',
};

// Animation Constants
const ROTATION_SPEED = 0.015;  // radians per frame
const PULSE_SPEED = 400;       // ms per cycle (used in sin function)

interface PhronosLogoProps {
  size?: number;
}

export const PhronosLogo: React.FC<PhronosLogoProps> = ({ size = 24 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate scaled dimensions based on reference size of 31px
    const scale = size / 31;

    const scaled = (value: number) => value * scale;

    const draw = () => {
      const centerX = size / 2;
      const centerY = size / 2;

      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      // === 1. Ouroboros (Rotating Serpent Ring) ===
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationRef.current);

      // Serpent body (arc)
      const radius = scaled(11.2);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0.3, Math.PI * 1.9);
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = scaled(2.7);
      ctx.lineCap = 'round';
      ctx.stroke();

      // Serpent head position
      const headAngle = Math.PI * 1.9;
      const headX = Math.cos(headAngle) * radius;
      const headY = Math.sin(headAngle) * radius;

      // Serpent head (circle)
      ctx.beginPath();
      ctx.arc(headX, headY, scaled(3.25), 0, Math.PI * 2);
      ctx.fillStyle = COLORS.ink;
      ctx.fill();

      // Serpent eye (gold detail inside head)
      ctx.beginPath();
      ctx.arc(headX, headY, scaled(1.2), 0, Math.PI * 2);
      ctx.fillStyle = COLORS.gold;
      ctx.fill();

      ctx.restore();

      // === 2. Pulsing Center Core ===
      const pulse = (Math.sin(Date.now() / PULSE_SPEED) + 1) / 2;

      // Outer ripple (faint, expanding)
      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        scaled(3.25) + (pulse * scaled(1.6)),
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = COLORS.goldDim;
      ctx.lineWidth = scaled(1.2);
      ctx.stroke();

      // Inner core (solid gold point)
      ctx.beginPath();
      ctx.arc(centerX, centerY, scaled(1.6), 0, Math.PI * 2);
      ctx.fillStyle = COLORS.gold;
      ctx.fill();

      // Update rotation for next frame
      rotationRef.current += ROTATION_SPEED;
    };

    const animate = () => {
      draw();
      animationIdRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    // Cleanup
    return () => {
      if (animationIdRef.current !== null) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ 
        display: 'block',
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0
      }}
      aria-label="Phronos Logo"
    />
  );
};
