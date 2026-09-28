import { motion } from 'framer-motion';
import { useState } from 'react';
import { A, CAMERA_ROLL, TRENDS } from '../state/data';
import { useFlows } from '../state/flows';
import { useStore } from '../state/store';
import type { ResultKind } from '../state/types';
import { BeforeAfter } from '../components/BeforeAfter';
import { Wordmark } from '../components/Chrome';
import { I } from '../components/Icons';
import { Img } from '../components/Img';
import { LeverTag, NavHeader, PillGhost, PillWhite } from '../components/ui';

export function ResultScreen({ kind, image, title, before }: { kind: ResultKind; image: string; title: string; trendId?: string; before?: string }) {
  const { mode, pop, showToast, track, resetStack, openSheet, saveLookToStudio, goTab } = useStore();
  const studio = mode === 'studio';
  const [saved, setSaved] = useState(false);

  const saveToGallery = () => {
    track('saved_to_gallery');
    setSaved(true);
    showToast('Saved to Gallery');
    if (studio && kind === 'enhance') {
      window.setTimeout(() => openSheet({ type: 'saveToProject', photo: image, title }), 450);
    } else if (!studio) {
      window.setTimeout(() => resetStack([], -1), 1100);
    }
  };

  const saveToStudio = () => {
    saveLookToStudio(image, title, kind === 'trend' ? 'trend' : 'casual');
    showToast('Saved to your Studio · Me');
    window.setTimeout(() => goTab('studio'), 700);
  };

  return (
    <div className="flex h-full flex-col">
      <NavHeader
        title={title}
        onBack={pop}
        right={
          <button onClick={() => showToast('Opening share sheet')} className="grid h-10 w-10 place-items-center rounded-full active:bg-white/10" aria-label="Share">
            <I.Share size={20} />
          </button>
        }
      />
      <div className="flex-1 px-4">
        {kind === 'enhance' ? (
          <BeforeAfter after={image} before={before} className="h-full min-h-[420px] rounded-[24px]" />
        ) : (
          <motion.div initial={{ scale: 1.04, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }} className="relative h-full min-h-[420px] overflow-hidden rounded-[24px]">
            <Img src={image} className="absolute inset-0" />
            {studio && (
              <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 py-1 pl-1 pr-2.5 text-[12px] font-semibold backdrop-blur">
                <Img src={A.ref(1)} className="h-5 w-5 rounded-full" label={false} /> Me
              </span>
            )}
          </motion.div>
        )}
      </div>
      <div className="space-y-2.5 px-4 pb-6 pt-4">
        {!studio && (
          <>
            <PillWhite demo="save-gallery" onClick={saveToGallery} disabled={saved}>
              <I.Download size={18} /> {saved ? 'Saved' : 'Save to Gallery'}
            </PillWhite>
            <p className="text-center text-[12px] text-mute">Result goes to your camera roll. Nothing is kept in the app.</p>
          </>
        )}
        {studio && kind === 'enhance' && (
          <>
            <PillWhite demo="save-gallery" onClick={saveToGallery}>
              <I.Download size={18} /> Save to Gallery
            </PillWhite>
            <PillGhost demo="save-to-project" onClick={() => openSheet({ type: 'saveToProject', photo: image, title })}>
              <I.Studio size={18} /> Save to a Project
              <LeverTag l="t" />
            </PillGhost>
          </>
        )}
        {studio && kind !== 'enhance' && (
          <>
            <PillWhite demo="save-studio" onClick={saveToStudio}>
              <I.Studio size={18} /> Save to Studio
              <LeverTag l="w" />
            </PillWhite>
            <div className="flex gap-2.5">
              <PillGhost demo="add-to-project" onClick={() => openSheet({ type: 'saveToProject', photo: image, title })}>
                <I.Plus size={18} /> Add to project
              </PillGhost>
              <PillGhost
                onClick={() => {
                  track('look_shared', 'I');
                  showToast('Shared · link includes "Try with your face"');
                }}
              >
                <I.Share size={18} /> Share
                <LeverTag l="I" />
              </PillGhost>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function TrendScreen({ trendId }: { trendId: string }) {
  const { mode, pop, identities } = useStore();
  const { tryTrendToday, tryTrendWithIdentity } = useFlows();
  const t = TRENDS.find((x) => x.id === trendId) ?? TRENDS[0];
  const studio = mode === 'studio';
  const [idn, setIdn] = useState(identities[0]);
  return (
    <div className="flex h-full flex-col">
      <div className="relative h-[420px] shrink-0">
        <Img src={studio ? t.result : t.cover} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-black/30" />
        <div className="absolute inset-x-0 top-0">
          <NavHeader onBack={pop} transparent />
        </div>
        <div className="absolute inset-x-0 bottom-0 px-4">
          {t.hot && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold">🔥 Trending this week</span>}
          <h1 className="mt-2 text-[32px] font-bold leading-none tracking-tight">{t.title}</h1>
          <p className="mt-2 text-[14px] text-white/70">{t.tagline}. 20 photos in one pack.</p>
        </div>
      </div>
      <div className="flex gap-2 px-4 pt-4">
        {[1, 2, 3, 4].map((n) => (
          <Img key={n} src={studio ? A.look(n) : `pack_${t.id}_${n}.jpg`} className="aspect-[3/4] flex-1 rounded-xl" label={false} />
        ))}
      </div>
      <div className="mt-auto space-y-3 px-4 pb-6 pt-5">
        {studio ? (
          <>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {identities.map((i) => (
                <button key={i.id} onClick={() => setIdn(i)} className={`flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13px] font-semibold ${idn.id === i.id ? 'bg-white text-black' : 'bg-white/10'}`}>
                  <Img src={i.cover} className="h-7 w-7 rounded-full" label={false} /> {i.name}
                </button>
              ))}
            </div>
            <PillWhite demo="try-with-me" onClick={() => tryTrendWithIdentity(t.id, idn.name)}>
              Try with {idn.name}
              <LeverTag l="w" />
            </PillWhite>
            <p className="text-center text-[12px] text-mute">No re-upload. Uses your saved identity; the result lands in your Studio.</p>
          </>
        ) : (
          <>
            <PillWhite demo="upload-selfies" onClick={() => tryTrendToday(t.id)}>
              <I.Camera size={18} /> Upload 8–12 selfies
            </PillWhite>
            <p className="text-center text-[12px] text-mute">We train a model for this pack. Takes a few minutes.</p>
          </>
        )}
      </div>
    </div>
  );
}

export function PickerScreen({ title, max, preselectAll, pool, cta, onDone }: { title: string; max: number; preselectAll?: boolean; pool?: string[]; cta: string; onDone: (p: string[]) => void }) {
  const { pop } = useStore();
  const items = pool ?? CAMERA_ROLL;
  const [sel, setSel] = useState<string[]>(preselectAll ? items.slice(0, max) : max === 1 ? [] : []);
  const toggle = (src: string) =>
    setSel((s) => (s.includes(src) ? s.filter((x) => x !== src) : max === 1 ? [src] : s.length < max ? [...s, src] : s));
  return (
    <div className="flex h-full flex-col">
      <NavHeader
        title={title}
        onBack={pop}
        right={
          max > 1 ? (
            <button onClick={() => setSel(sel.length ? [] : items.slice(0, max))} className="px-2 text-[14px] font-semibold text-[#FF6A8E]">
              {sel.length ? 'Clear' : `Select ${Math.min(max, items.length)}`}
            </button>
          ) : null
        }
      />
      <div className="flex items-center gap-2 px-4 pb-3 text-[13px] text-mute">
        <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-white">Recents</span>
        <span className="px-1">Selfies</span>
        <span className="px-1">Favourites</span>
        <span className="ml-auto">Fake picker · demo assets</span>
      </div>
      <div className="no-scrollbar grid flex-1 auto-rows-min grid-cols-4 gap-[2px] overflow-y-auto">
        {items.map((src, i) => {
          const idx = sel.indexOf(src);
          return (
            <button key={src + i} onClick={() => toggle(src)} className="relative aspect-square">
              <Img src={src} className={`absolute inset-0 transition ${idx >= 0 ? 'scale-[0.92] rounded-lg' : ''}`} label={false} />
              <span className={`absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full border-[1.5px] text-[10px] font-bold ${idx >= 0 ? 'border-white bg-[#FF2E7E]' : 'border-white/80 bg-black/20'}`}>
                {idx >= 0 ? (max === 1 ? '✓' : idx + 1) : ''}
              </span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-white/[0.06] px-4 pb-6 pt-3">
        <PillWhite demo="picker-done" disabled={!sel.length} onClick={() => onDone(sel)}>
          {cta}
          {max > 1 && sel.length > 0 && <span className="text-black/50">· {sel.length}</span>}
        </PillWhite>
      </div>
    </div>
  );
}

export function AnimateScreen({ src, projectId }: { src: string; projectId: string }) {
  const { pop, showToast, projects, track } = useStore();
  const p = projects.find((x) => x.id === projectId);
  return (
    <div className="flex h-full flex-col">
      <NavHeader title="Animated memory" onBack={pop} />
      <div className="relative mx-4 flex-1 overflow-hidden rounded-[24px]">
        <motion.div
          className="absolute inset-0"
          animate={{ scale: [1.02, 1.12, 1.02], x: [0, -10, 0], y: [0, -6, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Img src={src} className="absolute inset-0" />
        </motion.div>
        <motion.div
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent"
          animate={{ left: ['-40%', '120%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
        />
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-semibold backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF2E7E]" /> 0:05 · Animate (existing capability)
        </div>
      </div>
      <div className="space-y-2.5 px-4 pb-6 pt-4">
        <PillWhite onClick={() => showToast('Video saved to Gallery')}>
          <I.Download size={18} /> Save video
        </PillWhite>
        {p && (
          <PillGhost
            onClick={() => {
              track('animation_added_to_project', 'w');
              showToast(`Added to ${p.title}`);
              pop();
            }}
          >
            <I.Studio size={18} /> Keep in {p.title}
          </PillGhost>
        )}
      </div>
    </div>
  );
}

export function GridScreen({ title, items }: { title: string; items: { src: string; title?: string }[] }) {
  const { pop } = useStore();
  const { openTrend } = useFlows();
  return (
    <div>
      <NavHeader title={title} onBack={pop} />
      <div className="grid grid-cols-2 gap-3 px-4 pt-2">
        {items.map((it, i) => (
          <button
            key={i}
            onClick={() => {
              const t = TRENDS.find((x) => x.title === it.title);
              if (t) openTrend(t.id);
            }}
            className="relative h-[210px] overflow-hidden rounded-[18px] text-left"
          >
            <Img src={it.src} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            {it.title && <span className="absolute bottom-3 left-3 text-[15px] font-bold">{it.title}</span>}
          </button>
        ))}
      </div>
      <div className="h-10" />
    </div>
  );
}

export function AboutScreen() {
  const { pop, resetAll } = useStore();
  return (
    <div className="flex h-full flex-col">
      <NavHeader title="Settings" onBack={pop} />
      <div className="flex flex-1 flex-col items-center px-8 pt-16 text-center">
        <Wordmark className="text-[44px]" />
        <span className="mt-3 rounded-full border border-white/20 px-3 py-1 text-[12px] font-semibold text-white/70">Concept prototype</span>
        <p className="mt-6 text-[14px] leading-relaxed text-mute">
          Remini Studio is a design concept for a personal creative space: identities, projects, saved looks and shared projects. It is not the real app. No real Remini assets are used, and all AI results are simulated with prepared images.
        </p>
      </div>
      <div className="px-4 pb-8">
        <PillGhost
          onClick={() => {
            resetAll();
          }}
        >
          Reset prototype
        </PillGhost>
      </div>
    </div>
  );
}

export function Splash() {
  return (
    <motion.div className="absolute inset-0 z-[90] flex flex-col items-center justify-center bg-ink" exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }}>
        <Wordmark className="text-[52px]" />
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-2 text-[15px] font-semibold">
        <span className="bg-brand bg-clip-text text-transparent">Studio</span>
      </motion.div>
      <span className="absolute bottom-12 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-white/50">Concept prototype</span>
    </motion.div>
  );
}
