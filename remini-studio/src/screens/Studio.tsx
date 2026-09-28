import { A } from '../state/data';
import { useFlows } from '../state/flows';
import { useStore } from '../state/store';
import type { Project } from '../state/types';
import { TopBar } from '../components/Chrome';
import { I } from '../components/Icons';
import { Img } from '../components/Img';
import { Avatar, HScroll, LeverTag, NewBadge, ProgressBar, SectionHeader, V2Badge } from '../components/ui';

export function progressOf(p: Project) {
  const done = p.photos.filter((ph) => ph.status === 'enhanced').length;
  const verb = p.template === 'archive' ? 'restored' : 'enhanced';
  return { done, total: p.photos.length, label: `${done}/${p.photos.length} photos ${verb}` };
}

function ProjectCard({ p }: { p: Project }) {
  const { push } = useStore();
  const pr = progressOf(p);
  return (
    <button data-demo={`project-${p.id}`} onClick={() => push({ name: 'project', id: p.id })} className="w-[220px] shrink-0 overflow-hidden rounded-[20px] bg-card text-left active:scale-[0.98]">
      <div className="relative h-[140px]">
        <Img src={p.cover} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {p.lastEdit === 'Just now' && <NewBadge className="absolute left-2.5 top-2.5" />}
        <div className="absolute bottom-2 left-3 flex -space-x-1.5">
          {p.photos.slice(1, 4).map((ph) => (
            <Img key={ph.id} src={ph.enhanced ?? ph.original} className="h-7 w-7 rounded-lg ring-2 ring-card" label={false} />
          ))}
        </div>
      </div>
      <div className="p-3">
        <div className="truncate text-[15px] font-bold">{p.title}</div>
        <div className="mt-0.5 text-[12px] text-mute">{pr.label}</div>
        <ProgressBar value={pr.done / Math.max(pr.total, 1)} className="mt-2" />
        <div className="mt-2 text-[11px] text-white/45">Edited {p.lastEdit}</div>
      </div>
    </button>
  );
}

export function StudioHome() {
  const { identities, projects, looks, savedLooks, push, openSheet, runGenerating, track } = useStore();
  const { tryTrendWithIdentity } = useFlows();
  const own = projects.filter((p) => !p.shared);
  const shared = projects.filter((p) => p.shared);
  const meLooks = looks.filter((l) => l.identityId === 'me');
  const hasNew = meLooks.some((l) => l.isNew);

  return (
    <div>
      <TopBar />
      <div className="flex items-end justify-between px-4 pb-1 pt-3">
        <div>
          <h1 className="text-[30px] font-bold leading-none tracking-tight">My Studio</h1>
          <p className="mt-1.5 text-[13px] text-mute">Your identities, projects and looks in one place</p>
        </div>
      </div>

      {/* Identities */}
      <div data-demo="identities" className="pb-1">
      <SectionHeader title={<span className="relative">My identities<LeverTag l="c" className="-right-5 -top-1" /></span>} />
      <HScroll className="gap-4">
        {identities.map((idn, i) => (
          <button key={idn.id} data-demo={`identity-${idn.id}`} onClick={() => push({ name: 'identity', id: idn.id })} className="flex w-[76px] shrink-0 flex-col items-center gap-2">
            <span className={`relative rounded-full p-[2.5px] ${i === 0 ? 'bg-brand' : 'bg-white/15'}`}>
              <Img src={idn.cover} className="h-[68px] w-[68px] rounded-full ring-[3px] ring-ink" label={false} />
              {i === 0 && hasNew && <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full bg-[#FF2E7E] ring-[3px] ring-ink" />}
            </span>
            <span className="line-clamp-2 text-center text-[12px] font-medium leading-tight">{idn.name}</span>
          </button>
        ))}
        <button onClick={() => openSheet({ type: 'newIdentity' })} className="flex w-[76px] shrink-0 flex-col items-center gap-2">
          <span className="grid h-[73px] w-[73px] place-items-center rounded-full border-2 border-dashed border-white/20 text-white/70">
            <I.Plus />
          </span>
          <span className="text-center text-[12px] font-medium leading-tight text-white/70">New identity</span>
        </button>
      </HScroll>
      </div>

      {/* Latest looks with Me */}
      <SectionHeader
        demo="latest-looks"
        title="Latest looks · Me"
        onSeeAll={() => push({ name: 'identity', id: 'me' })}
      />
      <HScroll>
        {meLooks.slice(0, 8).map((l, i) => (
          <button
            key={l.id}
            data-demo={l.isNew && meLooks.findIndex((x) => x.isNew) === i ? 'new-look' : undefined}
            onClick={() => push({ name: 'result', kind: 'look', image: l.src, title: l.title })}
            className="relative h-[150px] w-[112px] shrink-0 overflow-hidden rounded-[16px]"
          >
            <Img src={l.src} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
            {l.isNew && <NewBadge className="absolute left-2 top-2" />}
            <span className="absolute bottom-2 left-2 right-2 truncate text-left text-[12px] font-semibold">{l.title}</span>
          </button>
        ))}
      </HScroll>

      {/* Continue */}
      <SectionHeader
        demo="continue"
        title={<span className="relative">Continue<LeverTag l="w" className="-right-5 -top-1" /></span>}
        right={
          <button data-demo="new-project" onClick={() => push({ name: 'newProject' })} className="relative flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[13px] font-semibold text-black active:scale-95">
            <I.Plus size={16} /> New project
            <LeverTag l="t" />
          </button>
        }
      />
      <HScroll>
        {own.map((p) => (
          <ProjectCard key={p.id} p={p} />
        ))}
      </HScroll>

      {/* New for you */}
      <SectionHeader title="New for you this week" />
      <div data-demo="weekly-banner" className="relative mx-4 overflow-hidden rounded-[22px] bg-card">
        <div className="flex">
          <div className="flex flex-1 flex-col justify-between p-4">
            <div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold">🔥 Trending</span>
              <div className="mt-2.5 text-[18px] font-bold leading-tight">Y2K Yearbook is trending: see it on you</div>
              <div className="mt-1 text-[12px] text-mute">Already rendered on Me. No upload.</div>
            </div>
            <button onClick={() => tryTrendWithIdentity('y2k')} className="relative mt-3 flex h-10 items-center justify-center gap-1.5 rounded-full bg-white text-[14px] font-semibold text-black active:scale-95">
              Try with Me
              <LeverTag l="w" />
            </button>
          </div>
          <div className="relative w-[140px] shrink-0">
            <Img src={A.y2kMe} className="absolute inset-0" />
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">Preview · Me</span>
          </div>
        </div>
      </div>

      {/* Saved looks */}
      <SectionHeader title={<span className="relative">Saved looks<LeverTag l="w" className="-right-5 -top-1" /></span>} />
      <HScroll>
        {savedLooks.map((s) => (
          <div key={s.id} className="flex w-[250px] shrink-0 items-center gap-3 rounded-[18px] bg-card p-2.5">
            <Img src={s.cover} className="h-14 w-14 shrink-0 rounded-xl" label={false} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">{s.title}</div>
              <button
                onClick={() =>
                  runGenerating({ steps: [`Loading "${s.title}"`, 'Generating with Me', 'Done'], duration: 1800, preview: s.cover }, () => {
                    track('saved_look_reused', 'w');
                    push({ name: 'result', kind: 'look', image: s.cover, title: s.title });
                  })
                }
                className="mt-1.5 flex h-7 items-center gap-1 rounded-full bg-white/10 px-2.5 text-[12px] font-semibold active:bg-white/20"
              >
                <I.Refresh size={13} /> Use again
              </button>
            </div>
          </div>
        ))}
      </HScroll>

      {/* Shared with me */}
      <SectionHeader title={<span className="relative flex items-center gap-2">Shared with me <V2Badge /><LeverTag l="I" className="-right-5 -top-1" /></span>} />
      <div className="space-y-2 px-4">
        {shared.map((p) => (
          <button key={p.id} data-demo="shared-summer" onClick={() => push({ name: 'project', id: p.id })} className="flex w-full items-center gap-3 rounded-[18px] bg-card p-2.5 text-left">
            <Img src={p.cover} className="h-14 w-14 rounded-xl" label={false} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">
                {p.title} · {p.shared!.owner} + {p.shared!.collaborators.length - 1}
              </div>
              <div className="mt-0.5 truncate text-[12px] text-mute">
                {p.shared!.feed[0].who} {p.shared!.feed[0].text} · {p.shared!.feed[0].when}
              </div>
            </div>
            <div className="flex -space-x-2">
              {p.shared!.collaborators.slice(0, 3).map((c) => (
                <Avatar key={c} name={c} size={24} />
              ))}
            </div>
          </button>
        ))}
      </div>
      <div className="h-28" />
    </div>
  );
}
