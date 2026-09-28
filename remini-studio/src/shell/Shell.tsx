import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { LEVER_META } from '../components/ui';
import { BEATS, TOTAL_STEPS } from '../state/demo';
import { useStore } from '../state/store';
import type { Lever } from '../state/types';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 text-[13px] font-medium text-white/85">
      {label}
      <span className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition ${on ? 'bg-[#34C759]' : 'bg-white/15'}`}>
        <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-[2px]'}`} />
      </span>
    </button>
  );
}

function LeverPill({ l }: { l: Lever }) {
  return (
    <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold text-black" style={{ background: LEVER_META[l].color }}>
      {l}
    </span>
  );
}

export function Controls({ compact = false }: { compact?: boolean }) {
  const s = useStore();
  const { mode, setMode, showLevers, setShowLevers, demo, setDemo, resetAll, resetStack, goTab } = s;
  return (
    <div className="space-y-4">
      {!compact && (
        <div>
          <div className="text-[18px] font-extrabold tracking-tight">
            Remini <span className="bg-brand bg-clip-text text-transparent">Studio</span>
          </div>
          <div className="text-[12px] text-white/45">Concept prototype · not the real app</div>
        </div>
      )}
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Experience</div>
        <div className="grid grid-cols-2 rounded-xl bg-white/[0.06] p-1">
          {(['today', 'studio'] as const).map((m) => (
            <button
              key={m}
              data-ctl={`mode-${m}`}
              onClick={() => mode !== m && setMode(m)}
              className={`h-8 rounded-lg text-[13px] font-semibold transition ${mode === m ? (m === 'studio' ? 'bg-brand text-white' : 'bg-white text-black') : 'text-white/60'}`}
            >
              {m === 'today' ? 'Today' : 'With Studio'}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-white/[0.04] p-3">
        <Toggle on={showLevers} onChange={setShowLevers} label="Show levers" />
        <AnimatePresence>
          {showLevers && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px] text-white/70">
                {(Object.keys(LEVER_META) as Lever[]).map((l) => (
                  <span key={l} className="flex items-center gap-1.5">
                    <LeverPill l={l} /> {LEVER_META[l].name}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="space-y-2">
        {demo === null ? (
          <button
            data-ctl="start-demo"
            onClick={() => {
              resetAll();
              setDemo(0);
            }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-[14px] font-semibold text-black active:scale-[0.98]"
          >
            ▶ Start demo
          </button>
        ) : (
          <button onClick={() => setDemo(null)} className="flex h-10 w-full items-center justify-center rounded-xl bg-white/10 text-[14px] font-semibold">
            Exit demo
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              if (mode !== 'studio') setMode('studio');
              goTab('studio');
              resetStack([{ name: 'lock' }]);
            }}
            className="h-9 rounded-xl bg-white/[0.06] text-[12px] font-semibold text-white/80"
          >
            Lock screen
          </button>
          <button
            onClick={() => {
              resetAll();
              setDemo(null);
            }}
            className="h-9 rounded-xl bg-white/[0.06] text-[12px] font-semibold text-white/80"
          >
            Reset
          </button>
        </div>
      </div>
      {!compact && <p className="text-[11px] leading-relaxed text-white/35">Demo keys: → next · ← back · Esc exit</p>}
    </div>
  );
}

export function EventLog() {
  const { events, clearEvents } = useStore();
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white/[0.04] p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Event log</span>
        <button onClick={clearEvents} className="text-[11px] text-white/40 hover:text-white/70">
          Clear
        </button>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto font-mono text-[12px]">
        {!events.length && <div className="text-white/30">Click around: events appear here.</div>}
        <AnimatePresence initial={false}>
          {events.map((e) => (
            <motion.div key={e.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
              <span className="text-white/30">{e.at}</span>
              <span className="flex-1 truncate text-white/85">{e.name}</span>
              {e.lever ? (
                <span className="flex items-center gap-1 text-white/40">
                  → <LeverPill l={e.lever} />
                </span>
              ) : (
                <span className="text-white/25">·</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function DemoCaption({ compact = false }: { compact?: boolean }) {
  const { demo, setDemo } = useStore();
  if (demo === null) return null;
  const b = BEATS[demo];
  const last = demo === BEATS.length - 1;
  return (
    <motion.div key={demo} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl bg-white text-black shadow-2xl ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-black/45">
        <span>
          Step {b.step} of {TOTAL_STEPS}
        </span>
        {b.lever && (
          <span className="flex items-center gap-1 normal-case">
            moves <LeverPill l={b.lever} />
          </span>
        )}
      </div>
      <div data-ctl={compact ? undefined : 'demo-title'} className={`mt-1 font-bold leading-tight ${compact ? 'text-[15px]' : 'text-[18px]'}`}>{b.title}</div>
      {!compact && <p className="mt-1.5 text-[14px] leading-snug text-black/70">{b.caption}</p>}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i + 1 <= b.step ? 'bg-[#FF2E7E]' : 'bg-black/10'}`} />
          ))}
        </div>
        <button disabled={demo === 0} onClick={() => setDemo(demo - 1)} className="h-8 rounded-full bg-black/[0.06] px-3 text-[13px] font-semibold disabled:opacity-30">
          ←
        </button>
        <button data-ctl={compact ? undefined : 'demo-next'} onClick={() => setDemo(last ? null : demo + 1)} className="h-8 rounded-full bg-black px-3.5 text-[13px] font-semibold text-white">
          {last ? 'Finish' : 'Next →'}
        </button>
      </div>
    </motion.div>
  );
}

function useDemoDriver() {
  const s = useStore();
  const { demo, setDemo } = s;

  useEffect(() => {
    if (demo === null) return;
    BEATS[demo]?.enter(s);
    // Only re-run when the beat changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (demo === null) return;
      if (e.key === 'ArrowRight') setDemo(demo >= BEATS.length - 1 ? null : demo + 1);
      else if (e.key === 'ArrowLeft') setDemo(Math.max(0, demo - 1));
      else if (e.key === 'Escape') setDemo(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [demo, setDemo]);
}

export function Shell({ phone }: { phone: ReactNode }) {
  const { showLevers, demo } = useStore();
  const [panel, setPanel] = useState(false);
  useDemoDriver();

  return (
    <div className="shell">
      <aside className="side side-left">
        <Controls />
      </aside>

      {phone}

      <aside className="side side-right">
        <AnimatePresence mode="wait">{demo !== null && <DemoCaption key="cap" />}</AnimatePresence>
        {showLevers && <EventLog />}
        {demo === null && !showLevers && (
          <div className="rounded-2xl border border-white/[0.06] p-4 text-[13px] leading-relaxed text-white/45">
            <b className="text-white/80">How to present</b>
            <br />
            Start in <b className="text-white/70">Today</b>, run a trend, then switch to <b className="text-white/70">With Studio</b>. Or press <b className="text-white/70">Start demo</b> for the guided 9-step path. Turn on <b className="text-white/70">Show levers</b> to tag UI with business levers and log events.
          </div>
        )}
      </aside>

      {/* Small screens: floating control */}
      <div className="mobile-ctl">
        <AnimatePresence>{demo !== null && <div className="pointer-events-auto mb-2 w-[300px]"><DemoCaption compact /></div>}</AnimatePresence>
        <button onClick={() => setPanel(!panel)} className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-white text-[18px] font-bold text-black shadow-2xl">
          {panel ? '×' : '⚑'}
        </button>
      </div>
      <AnimatePresence>
        {panel && (
          <motion.div
            className="fixed inset-x-3 bottom-20 z-[200] flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-3xl border border-white/10 bg-[#111116]/95 p-4 backdrop-blur-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Controls compact />
            {showLevers && (
              <div className="flex h-48 flex-col">
                <EventLog />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
