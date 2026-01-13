/**
 * Phronos Logo Component
 * 
 * Minimalist logo: thin golden circle with two squares inside.
 * Central square has a soft glow effect, smaller square to the left.
 */

import React, { useEffect, useRef } from 'react';

// Brand Colors
const COLORS = {
  gold: '#B08D55',
  goldDim: 'rgba(176, 141, 85, 0.4)',
};

interface PhronosLogoProps {
  size?: number;
}

export const PhronosLogo: React.FC<PhronosLogoProps> = ({ size = 24 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number | null>(null);

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

    const draw = () => {
      const centerX = size / 2;
      const centerY = size / 2;

      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      // === 1. Large Thin Circle ===
      const circleRadius = scaled(13); // Large circle radius
      ctx.beginPath();
      ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = scaled(0.8); // Thin stroke
      ctx.stroke();

      // === 2. Central Glowing Square ===
      const centralSquareSize = scaled(3);
      const centralX = centerX;
      const centralY = centerY;

      // Create glow effect by drawing multiple semi-transparent squares with increasing sizes
      ctx.save();
      
      // Outer glow layers (blurred halo effect)
      const glowLayers = 4;
      for (let i = glowLayers; i >= 1; i--) {
        const layerSize = centralSquareSize + scaled(1.5 * i);
        const opacity = 0.15 / i;
        ctx.fillStyle = `rgba(176, 141, 85, ${opacity})`;
        ctx.fillRect(
          centralX - layerSize / 2,
          centralY - layerSize / 2,
          layerSize,
          layerSize
        );
      }
      
      // Main square (solid)
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(
        centralX - centralSquareSize / 2,
        centralY - centralSquareSize / 2,
        centralSquareSize,
        centralSquareSize
      );
      
      ctx.restore();

      // === 3. Smaller Square to the Left ===
      const smallSquareSize = scaled(2);
      const smallX = centerX - scaled(5); // Left of center
      const smallY = centerY - scaled(1.5); // Slightly above horizontal axis

      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(
        smallX - smallSquareSize / 2,
        smallY - smallSquareSize / 2,
        smallSquareSize,
        smallSquareSize
      );
    };

    const animate = (currentTime: number = 0) => {
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
