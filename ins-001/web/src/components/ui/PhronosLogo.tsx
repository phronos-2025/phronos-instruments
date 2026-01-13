/**
 * Phronos Logo Component
 * 
 * Animated ouroboros (self-consuming serpent) logo with pulsing gold center.
 * Based on logo-animation.ts from phronos.org (frame-rate independent, retina-ready).
 */

import React, { useEffect, useRef } from 'react';

// Brand Colors (from vision/BRAND.yaml)
const COLORS = {
  ink: '#1A1A1A',
  gold: '#B08D55',
  goldDim: 'rgba(176, 141, 85, 0.4)',
};

// Animation Constants
// Rotation speed in radians per second (frame-rate independent)
// Target: ~0.0716 rotations/second = 0.45 radians/second
const ROTATION_SPEED_PER_SECOND = 0.45;
const PULSE_SPEED = 400; // ms per cycle (used in sin function)

interface PhronosLogoProps {
  size?: number;
}

export const PhronosLogo: React.FC<PhronosLogoProps> = ({ size = 24 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate scaled dimensions based on reference size of 31px
    const scale = size / 31;
    
    // Device Pixel Ratio for retina displays
    const dpr = window.devicePixelRatio || 1;
    
    // Scale canvas for retina (internal size is larger, CSS size stays the same)
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    
    // Scale context to match DPR
    ctx.scale(dpr, dpr);

    const scaled = (value: number) => value * scale;

    const draw = (deltaTime: number = 0) => {
      const centerX = size / 2;
      const centerY = size / 2;

      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      // Time-based rotation: radians per second * deltaTime (frame-rate independent)
      rotationRef.current += ROTATION_SPEED_PER_SECOND * deltaTime;

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
    };

    const animate = (currentTime: number = 0) => {
      // Calculate delta time in seconds (frame-rate independent)
      const deltaTime = lastTimeRef.current ? (currentTime - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = currentTime;
      
      draw(deltaTime);
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
