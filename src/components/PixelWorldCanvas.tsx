import React, { useEffect, useRef } from 'react';
import { useArcade } from '../context/ArcadeContext.tsx';

interface PixelStar {
  x: number;
  y: number;
  size: number;
  speed: number;
  color: string;
  phase: number;
}

interface FloatingGear {
  x: number;
  y: number;
  vy: number;
  vx: number;
  kind: 'gear' | 'chip' | 'bolt' | 'plus';
  color: string;
  scale: number;
}

export const PixelWorldCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { reducedMotion } = useArcade();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let pointerX = 0;
    let pointerY = 0;
    let gridOffset = 0;

    const colors = ['#00F0FF', '#FFE600', '#A855F7', '#22FF66', '#FF6B00'];
    const stars: PixelStar[] = [];
    const sprites: FloatingGear[] = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    const initEntities = () => {
      stars.length = 0;
      const starCount = width < 640 ? 45 : 85;
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() > 0.78 ? 3 : 2,
          speed: 0.15 + Math.random() * 0.4,
          color: Math.random() > 0.75 ? colors[i % colors.length] : '#DCE8FF',
          phase: Math.random() * Math.PI * 2,
        });
      }

      sprites.length = 0;
      const kinds: FloatingGear['kind'][] = ['gear', 'chip', 'bolt', 'plus'];
      const objCount = width < 640 ? 6 : 12;
      for (let i = 0; i < objCount; i++) {
        sprites.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vy: -0.18 - Math.random() * 0.22,
          vx: (Math.random() - 0.5) * 0.16,
          kind: kinds[i % kinds.length],
          color: colors[i % colors.length],
          scale: Math.random() > 0.5 ? 3 : 2,
        });
      }
    };

    const drawPixelSprite = (s: FloatingGear, px: number, py: number) => {
      const sz = s.scale;
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.22;

      if (s.kind === 'plus') {
        ctx.fillRect(px + sz, py, sz, sz * 3);
        ctx.fillRect(px, py + sz, sz * 3, sz);
      } else if (s.kind === 'chip') {
        ctx.fillRect(px + sz, py + sz, sz * 3, sz * 3);
        ctx.fillRect(px, py + sz * 2, sz, sz);
        ctx.fillRect(px + sz * 4, py + sz * 2, sz, sz);
        ctx.fillRect(px + sz * 2, py, sz, sz);
        ctx.fillRect(px + sz * 2, py + sz * 4, sz, sz);
      } else if (s.kind === 'bolt') {
        ctx.fillRect(px + sz * 2, py, sz * 2, sz);
        ctx.fillRect(px + sz, py + sz, sz * 2, sz);
        ctx.fillRect(px + sz, py + sz * 2, sz * 3, sz);
        ctx.fillRect(px + sz * 2, py + sz * 3, sz * 2, sz);
        ctx.fillRect(px + sz, py + sz * 4, sz, sz);
      } else {
        // Pixel gear ring
        ctx.fillRect(px + sz, py, sz * 2, sz);
        ctx.fillRect(px + sz, py + sz * 3, sz * 2, sz);
        ctx.fillRect(px, py + sz, sz, sz * 2);
        ctx.fillRect(px + sz * 3, py + sz, sz, sz * 2);
      }
      ctx.globalAlpha = 1;
    };

    const renderFrame = (staticOnly: boolean) => {
      ctx.clearRect(0, 0, width, height);

      // Moving retro perspective/orthographic pixel grid near bottom horizon
      const cell = 44;
      if (!staticOnly) {
        gridOffset = (gridOffset + 0.35) % cell;
      }
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -cell; x < width + cell; x += cell) {
        const gx = Math.round(x + pointerX * 8);
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
      }
      for (let y = -cell; y < height + cell; y += cell) {
        const gy = Math.round(y + gridOffset + pointerY * 6);
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
      }
      ctx.stroke();

      // Pixel stars
      for (const st of stars) {
        if (!staticOnly) {
          st.y += st.speed;
          st.phase += 0.04;
          if (st.y > height + 4) {
            st.y = -4;
            st.x = Math.random() * width;
          }
        }
        const alpha = 0.25 + 0.45 * Math.abs(Math.sin(st.phase));
        ctx.fillStyle = st.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(Math.round(st.x + pointerX * 4), Math.round(st.y), st.size, st.size);
      }
      ctx.globalAlpha = 1;

      // Floating pixel engineering sprites
      for (const sp of sprites) {
        if (!staticOnly) {
          sp.y += sp.vy;
          sp.x += sp.vx;
          if (sp.y < -20) {
            sp.y = height + 20;
            sp.x = Math.random() * width;
          }
          if (sp.x < -20) sp.x = width + 20;
          if (sp.x > width + 20) sp.x = -20;
        }
        drawPixelSprite(sp, Math.round(sp.x + pointerX * 14), Math.round(sp.y + pointerY * 10));
      }

      if (!staticOnly) {
        animId = window.requestAnimationFrame(() => renderFrame(false));
      }
    };

    const onMove = (e: PointerEvent) => {
      pointerX = e.clientX / Math.max(1, width) - 0.5;
      pointerY = e.clientY / Math.max(1, height) - 0.5;
    };

    resize();
    initEntities();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });

    if (reducedMotion) {
      renderFrame(true);
    } else {
      animId = window.requestAnimationFrame(() => renderFrame(false));
    }

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      if (animId) window.cancelAnimationFrame(animId);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
};
