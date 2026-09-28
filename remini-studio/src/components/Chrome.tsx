import { motion } from 'framer-motion';
import { useStore } from '../state/store';
import type { Tab } from '../state/types';
import { I } from './Icons';
import { Img } from './Img';
import { ProBadge } from './ui';

export function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`fake-status pointer-events-none flex h-[50px] shrink-0 items-end justify-between px-8 pb-2 text-[16px] font-semibold ${dark ? 'text-black' : 'text-white'}`}>
      <span className="w-14 text-center">9:41</span>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.3 10.3 0 008 .4 10.3 10.3 0 00.8 3.3L2 4.6a8.5 8.5 0 016-2.4zm0 3.6c1.3 0 2.6.5 3.5 1.4l1.3-1.3A6.7 6.7 0 008 4a6.7 6.7 0 00-4.8 1.9l1.3 1.3c.9-.9 2.2-1.4 3.5-1.4zm0 3.6c.5 0 .9.2 1.2.5L8 11.3 6.8 9.9c.3-.3.7-.5 1.2-.5z" /></svg>
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x=".5" y=".5" width="23" height="12" rx="3.5" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="19" height="9" rx="2" fill="currentColor" /><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" fill="currentColor" opacity=".5" /></svg>
      </span>
    </div>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-extrabold tracking-[-0.04em] ${className}`}>Remini</span>;
}

export function TopBar() {
  const { push, mode, openSheet, isPro, identities } = useStore();
  return (
    <div className="sticky top-0 z-30 flex h-[52px] items-center justify-between bg-ink/95 px-4 backdrop-blur-xl">
      <Wordmark className="text-[26px]" />
      <div className="flex items-center gap-3">
        {isPro ? (
          <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-white/10 px-2 text-[11px] font-extrabold tracking-wide">
            <span className="bg-brand bg-clip-text text-transparent">PRO</span> ✓
          </span>
        ) : (
          <ProBadge />
        )}
        <button aria-label="Settings" onClick={() => push({ name: 'about' })} className="text-white/85 active:text-white">
          <I.Gear size={22} />
        </button>
        <button
          aria-label="Profile"
          data-demo="avatar"
          onClick={() => (mode === 'studio' ? push({ name: 'identity', id: 'me' }) : openSheet({ type: 'profileToday' }))}
          className="h-7 w-7 overflow-hidden rounded-full ring-1 ring-white/20"
        >
          {mode === 'studio' ? <Img src={identities[0].cover} className="h-full w-full" label={false} /> : <span className="grid h-full w-full place-items-center bg-white/10"><I.Photos size={16} /></span>}
        </button>
      </div>
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: keyof typeof I }[] = [
  { id: 'studio', label: 'Studio', icon: 'Studio' },
  { id: 'enhance', label: 'Enhance', icon: 'Enhance' },
  { id: 'aiphotos', label: 'AI Photos', icon: 'Photos' },
  { id: 'filters', label: 'AI Filters', icon: 'Filters' },
  { id: 'videos', label: 'AI Videos', icon: 'Videos' },
  { id: 'retouch', label: 'Retouch', icon: 'Retouch' },
];

export function BottomNav() {
  const { tab, goTab, mode } = useStore();
  const tabs = TABS.filter((t) => mode === 'studio' || t.id !== 'studio');
  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-ink/90 pb-[max(env(safe-area-inset-bottom),18px)] pt-2 backdrop-blur-xl">
      <div className="flex">
        {tabs.map((t) => {
          const Icon = I[t.icon];
          const active = tab === t.id;
          const isStudio = t.id === 'studio';
          return (
            <button
              key={t.id}
              data-demo={`tab-${t.id}`}
              onClick={() => goTab(t.id)}
              className={`relative flex flex-1 flex-col items-center gap-1 pt-1 text-[10px] font-medium transition ${active ? 'text-white' : 'text-white/45'}`}
            >
              <span className={`relative grid h-7 w-11 place-items-center rounded-full ${isStudio && !active ? 'bg-white/[0.07]' : ''}`}>
                {isStudio && active && <motion.span layoutId="studio-glow" className="absolute inset-0 rounded-full bg-brand opacity-90" />}
                <Icon size={21} className="relative" />
                {isStudio && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#FF2E7E] shadow-[0_0_0_2px_#0B0B0F]" />}
              </span>
              <span className="flex items-center gap-0.5">
                {t.label}
                {isStudio && <span className="ml-0.5 rounded bg-brand px-[3px] text-[7px] font-extrabold leading-[11px] text-white">NEW</span>}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
