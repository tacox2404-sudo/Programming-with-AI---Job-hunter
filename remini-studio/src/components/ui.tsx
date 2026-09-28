import { AnimatePresence, motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useStore } from '../state/store';
import type { Lever } from '../state/types';
import { I } from './Icons';

export const LEVER_META: Record<Lever, { label: string; color: string; name: string }> = {
  t: { label: 't', color: '#FFB020', name: 'Trial start' },
  c: { label: 'c', color: '#2ED47A', name: 'Trial → paid' },
  w: { label: 'w', color: '#3DA5FF', name: 'Paid weeks' },
  I: { label: 'I', color: '#B57CFF', name: 'Installs' },
};

/** Small tag showing which business lever a UI element moves. Parent must be `relative`. */
export function LeverTag({ l, className = '-right-1.5 -top-1.5' }: { l: Lever; className?: string }) {
  const { showLevers } = useStore();
  const m = LEVER_META[l];
  return (
    <AnimatePresence>
      {showLevers && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 26 }}
          className={`pointer-events-none absolute z-20 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold leading-none text-black shadow-[0_0_0_2px_#0B0B0F] ${className}`}
          style={{ background: m.color }}
          title={m.name}
        >
          {m.label}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; demo?: string };

export function PillWhite({ children, className = '', demo, ...rest }: BtnProps) {
  return (
    <button
      data-demo={demo}
      className={`relative flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-semibold text-black transition active:scale-[0.98] disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function PillBrand({ children, className = '', demo, ...rest }: BtnProps) {
  return (
    <button
      data-demo={demo}
      className={`relative flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-brand text-[16px] font-semibold text-white shadow-[0_8px_30px_-8px_rgba(255,46,126,.6)] transition active:scale-[0.98] disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function PillGhost({ children, className = '', demo, ...rest }: BtnProps) {
  return (
    <button
      data-demo={demo}
      className={`relative flex h-[48px] w-full items-center justify-center gap-2 rounded-full bg-white/10 text-[15px] font-semibold text-white transition active:scale-[0.98] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Chip({ children, className = '', demo, ...rest }: BtnProps) {
  return (
    <button
      data-demo={demo}
      className={`relative flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-3.5 text-[13px] font-semibold text-white transition active:scale-95 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ProBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex h-[22px] items-center rounded-full bg-brand px-2 text-[11px] font-extrabold tracking-wide text-white ${className}`}>
      PRO
    </span>
  );
}

export function V2Badge() {
  return <span className="rounded-md border border-white/20 px-1.5 py-[1px] text-[10px] font-bold tracking-wide text-white/60">V2</span>;
}

export function NewBadge({ className = '' }: { className?: string }) {
  return <span className={`rounded-md bg-brand px-1.5 py-[1px] text-[10px] font-extrabold tracking-wide text-white ${className}`}>NEW</span>;
}

export function SectionHeader({ title, onSeeAll, right, demo }: { title: ReactNode; onSeeAll?: () => void; right?: ReactNode; demo?: string }) {
  return (
    <div data-demo={demo} className="flex items-center justify-between px-4 pb-3 pt-6">
      <h2 className="flex items-center gap-2 text-[19px] font-bold tracking-tight">{title}</h2>
      {right ?? (onSeeAll && (
        <button onClick={onSeeAll} className="text-[14px] font-medium text-mute active:text-white">
          See all
        </button>
      ))}
    </div>
  );
}

export function HScroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 ${className}`}>{children}</div>;
}

export function NavHeader({ title, onBack, right, transparent }: { title?: ReactNode; onBack: () => void; right?: ReactNode; transparent?: boolean }) {
  return (
    <div className={`sticky top-0 z-30 flex h-12 items-center justify-between px-2 ${transparent ? '' : 'bg-ink/95 backdrop-blur-xl'}`}>
      <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full active:bg-white/10" aria-label="Back">
        <I.Back />
      </button>
      <div className="truncate px-2 text-[16px] font-semibold">{title}</div>
      <div className="flex min-w-10 items-center justify-end">{right}</div>
    </div>
  );
}

export function Avatar({ name, size = 28, className = '' }: { name: string; size?: number; className?: string }) {
  const colors = ['#FF7A59', '#3DA5FF', '#2ED47A', '#B57CFF', '#FFB020', '#FF4F9A'];
  const c = colors[(name.charCodeAt(0) + name.length) % colors.length];
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-bold text-black shadow-[0_0_0_2px_#0B0B0F] ${className}`}
      style={{ width: size, height: size, background: c, fontSize: size * 0.42 }}
    >
      {name[0]}
    </span>
  );
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-white/10 ${className}`}>
      <motion.div className="h-full rounded-full bg-brand" animate={{ width: `${Math.round(value * 100)}%` }} transition={{ duration: 0.35 }} />
    </div>
  );
}
