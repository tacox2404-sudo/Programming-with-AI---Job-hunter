import { useState } from 'react';
import { CAMERA_ROLL, TEMPLATES, suggestFor } from '../state/data';
import { useStore } from '../state/store';
import type { TemplateId } from '../state/types';
import { I } from '../components/Icons';
import { Img } from '../components/Img';
import { LeverTag, NavHeader, NewBadge, PillWhite } from '../components/ui';

export function IdentityScreen({ id }: { id: string }) {
  const { identities, looks, pop, push, openSheet, improveIdentity, showToast, track } = useStore();
  const idn = identities.find((i) => i.id === id) ?? identities[0];
  const [filter, setFilter] = useState<'all' | 'trend' | 'professional'>('all');
  const mine = looks.filter((l) => l.identityId === idn.id || (idn.id === 'me' && l.identityId === 'me-pro'));
  const shown = mine.filter((l) => filter === 'all' || l.category === filter);
  const strong = idn.refs.length >= 6;

  return (
    <div className="relative min-h-full pb-28">
      <NavHeader title="" onBack={pop} right={<button onClick={() => openSheet({ type: 'privacy' })} className="grid h-10 w-10 place-items-center"><I.Shield size={20} /></button>} />
      <div className="flex flex-col items-center px-4">
        <span className="rounded-full bg-brand p-[3px]">
          <Img src={idn.cover} className="h-24 w-24 rounded-full ring-4 ring-ink" label={false} />
        </span>
        <h1 className="mt-3 text-[26px] font-bold tracking-tight">{idn.name}</h1>
        <div className="mt-1 flex items-center gap-2 text-[13px] text-mute">
          <span>{idn.refs.length} reference photos</span>·<span>{mine.length} looks</span>·
          <span className={strong ? 'text-[#2ED47A]' : 'text-[#FFB020]'}>{strong ? 'Great likeness' : 'Good likeness'}</span>
        </div>
      </div>

      <div data-demo="identity-refs" className="px-4 pt-6">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-[17px] font-bold">Reference photos</h2>
          <span className="text-[12px] text-mute">Trained once, reused everywhere</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {idn.refs.slice(0, 8).map((r, i) => (
            <Img key={r + i} src={r} className="aspect-square rounded-xl" label={false} />
          ))}
        </div>
        {!strong && (
          <button
            data-demo="improve-likeness"
            onClick={() =>
              push({
                name: 'picker',
                title: 'Add 2 more photos',
                max: 2,
                pool: CAMERA_ROLL.filter((c) => c.startsWith('me_')),
                cta: 'Add to identity',
                onDone: (picked) => {
                  pop();
                  improveIdentity(idn.id, picked);
                  showToast('Likeness improved');
                },
              })
            }
            className="relative mt-3 flex w-full items-center gap-3 rounded-2xl bg-[#FFB020]/10 p-3 text-left ring-1 ring-[#FFB020]/25"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#FFB020]/20 text-[#FFB020]"><I.Bolt size={16} /></span>
            <span className="flex-1 text-[13px] leading-snug">
              <b>Improve likeness:</b> add 2 more photos (different light and angles)
            </span>
            <I.Chevron size={18} className="text-mute" />
            <LeverTag l="c" />
          </button>
        )}
      </div>

      <div className="px-4 pt-7">
        <h2 className="text-[17px] font-bold">Looks with {idn.name}</h2>
        <div className="mt-3 flex gap-2">
          {(['all', 'trend', 'professional'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`h-8 rounded-full px-3.5 text-[13px] font-semibold ${filter === f ? 'bg-white text-black' : 'bg-white/10'}`}>
              {f === 'all' ? 'All' : f === 'trend' ? 'Trends' : 'Professional'}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {shown.map((l) => (
            <button key={l.id} onClick={() => push({ name: 'result', kind: 'look', image: l.src, title: l.title })} className="relative aspect-[3/4] overflow-hidden rounded-xl">
              <Img src={l.src} className="absolute inset-0" label={false} />
              {l.isNew && <NewBadge className="absolute left-1.5 top-1.5" />}
            </button>
          ))}
          {!shown.length && <div className="col-span-3 py-6 text-center text-[13px] text-mute">No looks in this filter yet</div>}
        </div>
      </div>

      <button onClick={() => openSheet({ type: 'privacy' })} className="mx-4 mt-6 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl bg-card p-3.5 text-left">
        <I.Lock size={18} className="text-mute" />
        <span className="flex-1 text-[13px] leading-snug text-white/80">
          <b className="text-white">Privacy & data:</b> your face data is private; delete anytime
        </span>
        <I.Chevron size={16} className="text-mute" />
      </button>

      <div className="sticky bottom-0 mt-6 bg-gradient-to-t from-ink via-ink to-transparent px-4 pb-6 pt-6">
        <PillWhite
          demo="create-with"
          onClick={() => {
            track('identity_create_tapped', 'c');
            openSheet({ type: 'createWith', identityId: idn.id });
          }}
        >
          <I.Enhance size={18} /> Create with {idn.name}
        </PillWhite>
      </div>
    </div>
  );
}

const DEFAULT_NAME: Record<TemplateId, string> = {
  profile: 'LinkedIn refresh',
  archive: 'Family archive',
  trip: 'Summer trip',
  couple: 'Friends shoot',
};

export function NewProjectScreen({ fromPhoto, template: t0, prefill }: { fromPhoto?: string; template?: TemplateId; prefill?: boolean }) {
  const { pop, push, identities, createProject, replaceTop } = useStore();
  const [template, setTemplate] = useState<TemplateId | null>(t0 ?? (prefill ? 'profile' : null));
  const [name, setName] = useState(t0 || prefill ? DEFAULT_NAME[t0 ?? 'profile'] : '');
  const [identityId, setIdentityId] = useState('me');
  const [photos, setPhotos] = useState<string[]>(t0 || prefill ? suggestFor(t0 ?? 'profile') : []);

  const pool = template === 'archive' ? CAMERA_ROLL.filter((c) => c.startsWith('archive')) : CAMERA_ROLL.filter((c) => !c.startsWith('archive'));

  if (!template)
    return (
      <div>
        <NavHeader title="New project" onBack={pop} />
        <div className="px-4">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">What are you working on?</h1>
          <p className="mt-1 text-[14px] text-mute">Pick a template. You can change everything later.</p>
          {fromPhoto && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.05] p-2.5">
              <Img src={fromPhoto} className="h-12 w-12 rounded-xl" label={false} />
              <span className="text-[13px] text-white/80">Your enhanced photo will be the first in this project</span>
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3">
            {TEMPLATES.map((tp) => (
              <button
                key={tp.id}
                data-demo={`template-${tp.id}`}
                onClick={() => {
                  setTemplate(tp.id);
                  setName(DEFAULT_NAME[tp.id]);
                  setPhotos(suggestFor(tp.id));
                }}
                className="relative h-[200px] overflow-hidden rounded-[20px] text-left active:scale-[0.98]"
              >
                <Img src={tp.cover} className="absolute inset-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <span className="absolute left-3 top-3 text-[22px]">{tp.emoji}</span>
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="text-[15px] font-bold leading-tight">{tp.title}</div>
                  <div className="mt-0.5 text-[12px] leading-snug text-white/70">{tp.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );

  const tp = TEMPLATES.find((x) => x.id === template)!;
  const count = photos.length + (fromPhoto ? 1 : 0);
  return (
    <div className="flex h-full flex-col">
      <NavHeader title={tp.title} onBack={() => (t0 || prefill ? pop() : setTemplate(null))} />
      <div className="no-scrollbar flex-1 overflow-y-auto px-4">
        <label className="text-[13px] font-semibold text-mute">Project name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 h-12 w-full rounded-2xl bg-card px-4 text-[17px] font-semibold outline-none ring-1 ring-white/10 focus:ring-white/40"
        />

        <div className="mt-6 text-[13px] font-semibold text-mute">Identity</div>
        <div className="mt-2 flex gap-2">
          {identities.map((i) => (
            <button key={i.id} onClick={() => setIdentityId(i.id)} className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13px] font-semibold ${identityId === i.id ? 'bg-white text-black' : 'bg-white/10'}`}>
              <Img src={i.cover} className="h-7 w-7 rounded-full" label={false} /> {i.name}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-mute">Photos · {count} <span className="font-normal">· suggested from Recents</span></span>
          <button
            onClick={() =>
              push({
                name: 'picker',
                title: 'Add photos',
                max: 24,
                preselectAll: true,
                pool,
                cta: 'Add photos',
                onDone: (picked) => {
                  setPhotos(picked);
                  pop();
                },
              })
            }
            className="text-[14px] font-semibold text-[#FF6A8E]"
          >
            {photos.length ? 'Edit' : 'Add photos'}
          </button>
        </div>
        <div className="mt-2 grid grid-cols-6 gap-1">
          {fromPhoto && (
            <div className="relative">
              <Img src={fromPhoto} className="aspect-square rounded-lg ring-2 ring-[#FF2E7E]" label={false} />
            </div>
          )}
          {photos.slice(0, fromPhoto ? 17 : 18).map((p, i) => (
            <Img key={p + i} src={p} degrade={template !== 'archive'} className="aspect-square rounded-lg" label={false} />
          ))}
          {!photos.length && (
            <button
              onClick={() =>
                push({ name: 'picker', title: 'Add photos', max: 24, preselectAll: true, pool, cta: 'Add photos', onDone: (picked) => { setPhotos(picked); pop(); } })
              }
              className="col-span-2 grid aspect-[2/1] place-items-center rounded-lg border border-dashed border-white/20 text-white/60"
            >
              <I.Plus />
            </button>
          )}
        </div>
        {count > 18 && <div className="mt-1.5 text-[12px] text-mute">+{count - 18} more</div>}

        <div className="mt-6 rounded-2xl bg-white/[0.05] p-3.5 text-[13px] leading-relaxed text-white/75">
          <b className="text-white">Setup included:</b>{' '}
          {template === 'profile' ? 'Studio light · navy blazer. Re-run it on any new photo, anytime.' : template === 'archive' ? 'Faithful restore. Animate any memory in one tap.' : 'One look applied consistently across the set.'}
        </div>
      </div>
      <div className="px-4 pb-6 pt-3">
        <PillWhite
          demo="create-project"
          disabled={!name.trim()}
          onClick={() => {
            const id = createProject({ template, title: name.trim(), identityId, photos, fromPhoto });
            replaceTop({ name: 'project', id });
          }}
        >
          Create project
          <LeverTag l="t" />
        </PillWhite>
      </div>
    </div>
  );
}
