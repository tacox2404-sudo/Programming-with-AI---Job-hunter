import { motion } from 'framer-motion';
import { useState } from 'react';
import { CAMERA_ROLL } from '../state/data';
import { FREE_LIMIT, useStore } from '../state/store';
import type { Project, ProjectPhoto } from '../state/types';
import { BeforeAfter } from '../components/BeforeAfter';
import { I } from '../components/Icons';
import { Img } from '../components/Img';
import { Avatar, Chip, LeverTag, NavHeader, NewBadge, PillWhite, ProgressBar, V2Badge } from '../components/ui';
import { progressOf } from './Studio';

const TEMPLATE_LABEL = { profile: 'Profile refresh', archive: 'Family archive', trip: 'Trip or event', couple: 'Friends shoot' };

function PhotoTile({ ph, archive, onOpen }: { ph: ProjectPhoto; archive: boolean; onOpen: () => void }) {
  const done = ph.status === 'enhanced';
  const src = done ? ph.enhanced ?? ph.original : ph.original;
  return (
    <button onClick={onOpen} className="relative aspect-[3/4] overflow-hidden rounded-[12px] bg-card2">
      <Img src={src} degrade={!done && !archive} className="absolute inset-0" label={false} />
      {ph.status === 'processing' && (
        <div className="absolute inset-0 grid place-items-center bg-black/40">
          <div className="shimmer absolute inset-0" />
          <span className="spinner relative" />
        </div>
      )}
      {done && (
        <span className="absolute bottom-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-black">
          <I.Check size={12} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function useAnimateMemory() {
  const { runGenerating, track, markAnimated, push } = useStore();
  return (projectId: string, src: string) =>
    runGenerating({ steps: ['Reading the scene', 'Animating faces', 'Rendering 5s clip'], duration: 2200, preview: src }, () => {
      track('memory_animated', 'w');
      markAnimated(projectId, src);
      push({ name: 'animate', src, projectId });
    });
}

export function ProjectScreen({ id, tab: initialTab }: { id: string; tab?: 'photos' | 'looks' | 'setup' }) {
  const s = useStore();
  const { projects, pop, enhanceAll, generateLooks, rerunSetup, openSheet, push, isPro, freeUsed, processing, showToast, track, identities, stack } = s;
  const animateMemory = useAnimateMemory();
  const p = projects.find((x) => x.id === id);
  const [localTab, setTab] = useState<'photos' | 'looks' | 'setup'>(initialTab ?? 'photos');
  // A deep link (e.g. re-run → Looks) updates the route's tab; follow it.
  const routeTab = stack[stack.length - 1]?.name === 'project' ? (stack[stack.length - 1] as { tab?: typeof localTab }).tab : undefined;
  const [seenRouteTab, setSeenRouteTab] = useState(routeTab);
  if (routeTab !== seenRouteTab) {
    setSeenRouteTab(routeTab);
    if (routeTab) setTab(routeTab);
  }
  const tab = localTab;

  if (!p) return <NavHeader title="Project" onBack={pop} />;
  const pr = progressOf(p);
  const remaining = p.photos.filter((ph) => ph.status === 'original').length;
  const archive = p.template === 'archive';
  const identity = identities.find((i) => i.id === p.identityId) ?? identities[0];
  const isProcessing = processing === p.id;

  const pickNewPhoto = () =>
    push({
      name: 'picker',
      title: 'Re-run setup on a new photo',
      max: 1,
      cta: 'Apply setup',
      onDone: (picked) => {
        pop();
        rerunSetup(p.id, picked[0] ?? CAMERA_ROLL[0]);
      },
    });

  const animate = (src: string) => animateMemory(p.id, src);

  return (
    <div className="relative min-h-full">
      <NavHeader
        title={p.title}
        onBack={pop}
        right={
          <button onClick={() => openSheet({ type: 'share', projectId: p.id })} className="relative grid h-10 w-10 place-items-center rounded-full active:bg-white/10" aria-label="Share">
            <I.Share size={20} />
            <LeverTag l="I" className="right-0 top-0" />
          </button>
        }
      />

      {/* Header */}
      <div className="px-4 pt-1">
        <div className="relative h-[150px] overflow-hidden rounded-[22px]">
          <Img src={p.cover} className="absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
            <div>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-white/75">
                {TEMPLATE_LABEL[p.template]} {p.shared && <V2Badge />}
              </div>
              <div className="text-[24px] font-bold leading-tight">{p.title}</div>
            </div>
            {p.shared ? (
              <div className="flex -space-x-2">
                {p.shared.collaborators.map((c) => (
                  <Avatar key={c} name={c} size={28} />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full bg-black/50 py-1 pl-1 pr-2.5 text-[12px] font-semibold backdrop-blur">
                <Img src={identity.cover} className="h-6 w-6 rounded-full" label={false} /> with {identity.name}
              </div>
            )}
          </div>
        </div>

        <div data-demo="project-progress" className="mt-4">
          <div className="flex justify-between text-[13px]">
            <span className="font-semibold">{pr.label}</span>
            <span className="text-mute">{Math.round((pr.done / Math.max(pr.total, 1)) * 100)}%</span>
          </div>
          <ProgressBar value={pr.done / Math.max(pr.total, 1)} className="mt-2" />
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FFB020]/15 text-[#FFB020]">
            <I.Bulb size={17} />
          </span>
          <div className="text-[13px] leading-snug">
            <span className="text-mute">Next step · </span>
            {p.nextStep}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-1.5">
        {remaining > 0 && (
          <button
            data-demo="enhance-all"
            onClick={() => enhanceAll(p.id)}
            disabled={isProcessing}
            className="relative flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-semibold text-black active:scale-95 disabled:opacity-50"
          >
            <I.Enhance size={17} /> Enhance all {p.photos.length}
            <LeverTag l="t" />
          </button>
        )}
        {archive ? (
          <>
            <Chip demo="animate-memory" onClick={() => animate(p.photos[0].enhanced ?? p.photos[0].original)}>
              <I.Play size={14} /> Animate a memory
            </Chip>
            <Chip onClick={() => openSheet({ type: 'share', projectId: p.id })}>
              <I.Users size={16} /> Invite family to add photos <V2Badge />
              <LeverTag l="I" />
            </Chip>
          </>
        ) : (
          <>
            <Chip demo="generate-looks" onClick={() => generateLooks(p.id)}>
              <I.Wand size={16} /> Generate 4 more looks
              <LeverTag l="c" />
            </Chip>
            <Chip demo="rerun-chip" onClick={pickNewPhoto}>
              <I.Refresh size={15} /> Re-run setup on a new photo
            </Chip>
          </>
        )}
        <Chip
          onClick={() => {
            track('set_exported');
            showToast(`Exported ${pr.done} photos to Gallery`);
          }}
        >
          <I.Download size={16} /> Export set
        </Chip>
        <Chip demo="share-project" onClick={() => openSheet({ type: 'share', projectId: p.id })}>
          <I.Share size={16} /> Share project
          <LeverTag l="I" />
        </Chip>
      </div>
      {!isPro && remaining > 0 && (
        <div className="mt-2 px-4 text-[12px] text-mute">
          Free plan · {freeUsed} of {FREE_LIMIT} free enhancements used
        </div>
      )}

      {/* Shared activity */}
      {p.shared && (
        <div className="mx-4 mt-4 rounded-2xl bg-card p-3.5">
          <div className="mb-2 text-[13px] font-semibold text-mute">Activity</div>
          {p.shared.feed.slice(0, 3).map((f, i) => (
            <div key={i} className="flex items-center gap-2.5 py-1.5 text-[13px]">
              <Avatar name={f.who} size={24} />
              <span className="flex-1">
                <b>{f.who}</b> {f.text}
              </span>
              <span className="text-mute">{f.when}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="sticky top-12 z-20 mt-4 flex gap-6 border-b border-white/[0.06] bg-ink/90 px-4 backdrop-blur-xl">
        {(['photos', 'looks', 'setup'] as const).map((t) => (
          <button
            key={t}
            data-demo={`ptab-${t}`}
            onClick={() => setTab(t)}
            className={`relative pb-2.5 pt-1 text-[15px] font-semibold capitalize ${tab === t ? 'text-white' : 'text-white/45'}`}
          >
            {t === 'photos' ? `Photos · ${p.photos.length}` : t === 'looks' ? `Looks · ${p.looks.length}` : 'Setup'}
            {tab === t && <motion.span layoutId="ptab" className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-white" />}
          </button>
        ))}
      </div>

      <div className="px-4 pt-3">
        {tab === 'photos' && (
          <div className="grid grid-cols-3 gap-1.5">
            {p.photos.map((ph) => (
              <PhotoTile key={ph.id} ph={ph} archive={archive} onOpen={() => push({ name: 'photo', projectId: p.id, photoId: ph.id })} />
            ))}
          </div>
        )}
        {tab === 'looks' && <LooksTab p={p} onGenerate={() => generateLooks(p.id)} />}
        {tab === 'setup' && <SetupTab p={p} onRerun={pickNewPhoto} />}
      </div>
      <div className="h-16" />

    </div>
  );
}

export function PhotoScreen({ projectId, photoId }: { projectId: string; photoId: string }) {
  const { enhanceAll, projects, pop } = useStore();
  const animateMemory = useAnimateMemory();
  const p = projects.find((x) => x.id === projectId);
  const ph = p?.photos.find((x) => x.id === photoId);
  if (!p || !ph) return <NavHeader title="Photo" onBack={pop} />;
  const onClose = pop;
  const onAnimate = (src: string) => animateMemory(p.id, src);
  const archive = p.template === 'archive';
  const done = ph.status === 'enhanced';
  return (
    <div className="flex h-full flex-col">
      <NavHeader title={done ? (archive ? 'Restored' : 'Enhanced') : 'Original'} onBack={onClose} transparent />
      <div className="flex-1 px-4 pb-4">
        {done ? (
          <BeforeAfter after={ph.enhanced ?? ph.original} before={ph.enhanced ? ph.original : undefined} className="h-full rounded-[22px]" />
        ) : (
          <div className="relative h-full overflow-hidden rounded-[22px]">
            <Img src={ph.original} degrade={!archive} className="absolute inset-0" />
          </div>
        )}
      </div>
      <div className="space-y-2.5 px-4 pb-8">
        {done && archive && (
          <PillWhite onClick={() => onAnimate(ph.enhanced ?? ph.original)}>
            <I.Play size={16} /> Animate this memory
          </PillWhite>
        )}
        {!done && (
          <PillWhite
            onClick={() => {
              onClose();
              enhanceAll(p.id);
            }}
          >
            <I.Enhance size={18} /> Enhance all {p.photos.length}
          </PillWhite>
        )}
        {done && !archive && <p className="text-center text-[13px] text-mute">Drag the handle to compare</p>}
      </div>
    </div>
  );
}

function LooksTab({ p, onGenerate }: { p: Project; onGenerate: () => void }) {
  const { push } = useStore();
  if (!p.looks.length)
    return (
      <div className="rounded-[20px] border border-dashed border-white/15 p-6 text-center">
        <div className="text-[16px] font-semibold">No looks yet</div>
        <p className="mt-1 text-[13px] text-mute">Generate shots of {p.identityId === 'me' ? 'Me' : 'your identity'} with this project's setup.</p>
        <button onClick={onGenerate} className="relative mx-auto mt-4 flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-semibold text-black">
          <I.Wand size={16} /> Generate 4 looks
          <LeverTag l="c" />
        </button>
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-2">
      {p.looks.map((l) => (
        <button key={l.id} onClick={() => push({ name: 'result', kind: 'look', image: l.src, title: l.title })} className="relative aspect-[3/4] overflow-hidden rounded-[16px]">
          <Img src={l.src} className="absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          {l.isNew && <NewBadge className="absolute left-2 top-2" />}
          <span className="absolute bottom-2 left-2.5 right-2 truncate text-left text-[12px] font-semibold">{l.title}</span>
        </button>
      ))}
    </div>
  );
}

function SetupTab({ p, onRerun }: { p: Project; onRerun: () => void }) {
  const { showToast, track } = useStore();
  if (!p.setup)
    return <div className="rounded-[20px] bg-card p-5 text-[14px] text-mute">No setup yet. Apply a look to any photo and it's saved here as a reusable recipe.</div>;
  const rows: [string, string][] = [
    ['Style', p.setup.style],
    ['Background', p.setup.background],
    ['Outfit', p.setup.outfit],
  ];
  return (
    <div data-demo="setup-card">
      <div className="relative rounded-[20px] bg-card p-4">
        <LeverTag l="c" />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wider text-mute">Saved recipe</div>
            <div className="mt-0.5 text-[18px] font-bold">{p.setup.name}</div>
          </div>
          <span className="rounded-full bg-[#2ED47A]/15 px-2.5 py-1 text-[11px] font-bold text-[#2ED47A]">Reusable</span>
        </div>
        <div className="mt-3 divide-y divide-white/[0.06]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5 text-[14px]">
              <span className="text-mute">{k}</span>
              <span className="text-right font-medium">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-xl bg-black/30 p-3 font-mono text-[12px] leading-relaxed text-white/75">{p.setup.prompt}</div>
      </div>
      <PillWhite demo="rerun-setup" className="mt-4" onClick={onRerun}>
        <I.Refresh size={17} /> Re-run setup on a new photo
        <LeverTag l="c" />
      </PillWhite>
      <button
        onClick={() => {
          track('setup_saved_as_look', 'c');
          showToast('Saved to your looks');
        }}
        className="mt-2 h-11 w-full text-[14px] font-semibold text-white/70"
      >
        Save as a reusable look
      </button>
    </div>
  );
}
