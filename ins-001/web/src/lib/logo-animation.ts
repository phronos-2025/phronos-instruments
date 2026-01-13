/**
 * Phronos Lens Animation
 * An animated ouroboros (self-consuming serpent) logo with a pulsing gold center.
 *
 * Adapted from phronos-site for dark mode (inverted ink color).
 */

export type Theme = 'light' | 'dark';

const COLORS = {
  light: {
    ink: '#1A1A1A',
    gold: '#B08D55',
    goldDim: 'rgba(176, 141, 85, 0.4)',
  },
  dark: {
    ink: '#E5E5E5',
    gold: '#B08D55',
    goldDim: 'rgba(176, 141, 85, 0.4)',
  },
};

// Rotation speed in radians per second (not per frame)
// Target: ~0.0716 rotations/second = 0.45 radians/second (matches 30Hz behavior)
const ROTATION_SPEED_PER_SECOND = 0.45;
const PULSE_SPEED = 400;

export class PhronosLens {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size: number;
  private scale: number;
  private dpr: number;
  private rotation: number = 0;
  private animationId: number | null = null;
  private lastTime: number = 0;
  private theme: Theme;

  constructor(canvas: HTMLCanvasElement, options: { size?: number; theme?: Theme } = {}) {
    this.canvas = canvas;
    this.size = options.size || canvas.width || 31;
    this.scale = this.size / 31;
    this.theme = options.theme || 'dark';

    // DPR scaling for retina displays
    this.dpr = window.devicePixelRatio || 1;

    // Scale canvas for retina
    canvas.width = this.size * this.dpr;
    canvas.height = this.size * this.dpr;
    canvas.style.width = `${this.size}px`;
    canvas.style.height = `${this.size}px`;

    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(this.dpr, this.dpr);
  }

  private get colors() {
    return COLORS[this.theme];
  }

  private scaled(value: number): number {
    return value * this.scale;
  }

  draw(deltaTime: number = 0): void {
    const ctx = this.ctx;
    const centerX = this.size / 2;
    const centerY = this.size / 2;
    const colors = this.colors;

    ctx.clearRect(0, 0, this.size, this.size);

    // Time-based rotation: radians per second * deltaTime
    this.rotation += ROTATION_SPEED_PER_SECOND * deltaTime;

    // Ouroboros (Rotating Serpent Ring)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.rotation);

    const radius = this.scaled(11.2);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0.3, Math.PI * 1.9);
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = this.scaled(2.7);
    ctx.lineCap = 'round';
    ctx.stroke();

    // Serpent head
    const headAngle = Math.PI * 1.9;
    const headX = Math.cos(headAngle) * radius;
    const headY = Math.sin(headAngle) * radius;

    ctx.beginPath();
    ctx.arc(headX, headY, this.scaled(3.25), 0, Math.PI * 2);
    ctx.fillStyle = colors.ink;
    ctx.fill();

    // Serpent eye
    ctx.beginPath();
    ctx.arc(headX, headY, this.scaled(1.2), 0, Math.PI * 2);
    ctx.fillStyle = colors.gold;
    ctx.fill();

    ctx.restore();

    // Pulsing Center Core
    const pulse = (Math.sin(Date.now() / PULSE_SPEED) + 1) / 2;

    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      this.scaled(3.25) + pulse * this.scaled(1.6),
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = colors.goldDim;
    ctx.lineWidth = this.scaled(1.2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, this.scaled(1.6), 0, Math.PI * 2);
    ctx.fillStyle = colors.gold;
    ctx.fill();
  }

  private animate(currentTime: number = 0): void {
    // Calculate delta time in seconds
    const deltaTime = this.lastTime ? (currentTime - this.lastTime) / 1000 : 0;
    this.lastTime = currentTime;

    this.draw(deltaTime);
    this.animationId = requestAnimationFrame((t) => this.animate(t));
  }

  start(): void {
    if (this.animationId) return;
    this.animate();
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  resize(newSize: number): void {
    this.size = newSize;
    this.scale = newSize / 31;

    // Apply DPR scaling
    this.canvas.width = newSize * this.dpr;
    this.canvas.height = newSize * this.dpr;
    this.canvas.style.width = `${newSize}px`;
    this.canvas.style.height = `${newSize}px`;

    // Reset context scale after resize (canvas resize clears context state)
    this.ctx.scale(this.dpr, this.dpr);
  }
}

export function createPhronosLens(
  target: string | HTMLCanvasElement,
  options: { size?: number; theme?: Theme } = {}
): PhronosLens | null {
  const canvas =
    typeof target === 'string'
      ? (document.querySelector(target) as HTMLCanvasElement)
      : target;

  if (!canvas) {
    console.error('PhronosLens: Canvas element not found');
    return null;
  }

  const lens = new PhronosLens(canvas, options);
  lens.start();
  return lens;
}
