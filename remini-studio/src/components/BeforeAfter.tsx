import { useEffect, useRef, useState } from 'react';
import { Img } from './Img';

/**
 * Drag the handle to compare. If `before` is omitted the "after" image is rendered
 * degraded to simulate the original.
 */
export function BeforeAfter({ after, before, className = '', autoplay = true }: { after: string; before?: string; className?: string; autoplay?: boolean }) {
  const [pos, setPos] = useState(autoplay ? 0.85 : 0.5);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const touched = useRef(false);

  useEffect(() => {
    if (!autoplay) return;
    const t = window.setTimeout(() => !touched.current && setPos(0.5), 350);
    return () => clearTimeout(t);
  }, [autoplay]);

  const move = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(0.98, Math.max(0.02, (clientX - r.left) / r.width)));
  };

  return (
    <div
      ref={box}
      className={`relative select-none overflow-hidden ${className}`}
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        dragging.current = true;
        touched.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <Img src={after} className="absolute inset-0" label={false} />
      <div className="absolute inset-0 transition-[clip-path] duration-500 ease-out" style={{ clipPath: `inset(0 ${100 - pos * 100}% 0 0)`, transitionDuration: dragging.current ? '0ms' : undefined }}>
        <Img src={before ?? after} degrade={!before} className="absolute inset-0" label={false} />
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">Before</span>
      <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">After</span>
      <div
        className="absolute inset-y-0 w-[2px] bg-white shadow-[0_0_12px_rgba(0,0,0,.5)] transition-[left] duration-500 ease-out"
        style={{ left: `calc(${pos * 100}% - 1px)`, transitionDuration: dragging.current ? '0ms' : undefined }}
      >
        <div className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-black shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </div>
      </div>
    </div>
  );
}
