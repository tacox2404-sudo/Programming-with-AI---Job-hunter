import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { A, CAMERA_ROLL, TRENDS } from '../state/data';
import { useFlows } from '../state/flows';
import { FREE_LIMIT, useStore } from '../state/store';
import type { Sheet } from '../state/types';
import { I } from '../components/Icons';
import { Img } from '../components/Img';
import { SheetFrame } from '../components/Overlays';
import { Avatar, LeverTag, PillBrand, PillGhost, PillWhite, V2Badge } from '../components/ui';

export function SheetHost() {
  const { sheet, closeSheet } = useStore();
  return (
    <AnimatePresence>
      {sheet && (
        <SheetFrame key={sheet.type} onClose={closeSheet} tall={sheet.type === 'paywall'}>
          <SheetBody sheet={sheet} />
        </SheetFrame>
      )}
    </AnimatePresence>
  );
}

function SheetBody({ sheet }: { sheet: Sheet }) {
  switch (sheet.type) {
    case 'saveToProject':
      return <SaveToProject photo={sheet.photo} />;
    case 'paywall':
      return <Paywall projectId={sheet.projectId} stage={sheet.stage} />;
    case 'share':
      return <ShareSheet projectId={sheet.projectId} />;
    case 'createWith':
      return <CreateWith identityId={sheet.identityId} />;
    case 'privacy':
      return <Privacy />;
    case 'newIdentity':
      return <NewIdentity />;
    case 'profileToday':
      return <ProfileToday />;
  }
}

function SaveToProject({ photo }: { photo: string }) {
  const { projects, closeSheet, push, addPhotoToProject, showToast, resetStack, goTab } = useStore();
  const own = projects.filter((p) => !p.shared);
  return (
    <div className="px-5 pt-2">
      <div className="flex items-center gap-3">
        <Img src={photo} className="h-14 w-14 rounded-xl" label={false} />
        <div>
          <h3 className="text-[20px] font-bold leading-tight">Save to a Project?</h3>
          <p className="text-[13px] text-mute">Keep it, build on it, come back to it.</p>
        </div>
      </div>
      <button
        data-demo="sheet-new-project"
        onClick={() => {
          closeSheet();
          push({ name: 'newProject', fromPhoto: photo });
        }}
        className="relative mt-5 flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left text-black active:scale-[0.99]"
      >
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-black text-white">
          <I.Plus />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-bold">New project</span>
          <span className="block text-[12px] text-black/55">Profile refresh, family archive, trip…</span>
        </span>
        <I.Chevron size={18} />
        <LeverTag l="t" />
      </button>
      <div className="mt-4 text-[12px] font-semibold uppercase tracking-wider text-mute">Your projects</div>
      <div className="mt-2 space-y-1.5">
        {own.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              closeSheet();
              addPhotoToProject(p.id, photo);
              showToast(`Added to ${p.title}`);
              goTab('studio');
              resetStack([{ name: 'project', id: p.id }]);
            }}
            className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.05] p-2.5 text-left active:bg-white/10"
          >
            <Img src={p.cover} className="h-11 w-11 rounded-xl" label={false} />
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">{p.title}</span>
              <span className="block text-[12px] text-mute">{p.photos.length} photos · edited {p.lastEdit}</span>
            </span>
          </button>
        ))}
      </div>
      <button onClick={closeSheet} className="mt-3 h-11 w-full text-[14px] font-semibold text-white/60">
        Not now
      </button>
    </div>
  );
}

function Paywall({ projectId, stage }: { projectId: string; stage: 'offer' | 'success' }) {
  const { projects, startTrial, closeSheet, processProject, freeUsed } = useStore();
  const [trial, setTrial] = useState(true);
  const p = projects.find((x) => x.id === projectId);
  if (!p) return null;

  if (stage === 'success')
    return (
      <div className="flex flex-col items-center px-6 pb-2 pt-8 text-center">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }} className="grid h-20 w-20 place-items-center rounded-full bg-brand">
          <I.Check size={40} strokeWidth={2.6} />
        </motion.span>
        <h3 className="mt-5 text-[24px] font-bold">Your trial has started</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-mute">7 days of unlimited enhancements and your Studio. We'll remind you before it ends.</p>
        <PillWhite
          demo="back-to-project"
          className="mt-7"
          onClick={() => {
            closeSheet();
            processProject(projectId);
          }}
        >
          Finish {p.title}
        </PillWhite>
      </div>
    );

  const remaining = p.photos.filter((ph) => ph.status === 'original').length;
  return (
    <div className="px-5">
      <div className="relative -mx-5 -mt-1 h-[150px] overflow-hidden">
        <div className="grid h-full grid-cols-4 gap-1 px-5">
          {p.photos.slice(0, 4).map((ph, i) => (
            <Img key={ph.id} src={ph.enhanced ?? ph.original} degrade={i > 0} className="rounded-xl" label={false} />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#141419] via-transparent to-transparent" />
      </div>
      <div className="relative z-10 -mt-3 flex justify-center">
        <span className="rounded-full bg-[#FFB020]/15 px-3 py-1 text-[12px] font-bold text-[#FFB020]">
          You've used {freeUsed} of {FREE_LIMIT} free enhancements
        </span>
      </div>
      <h3 className="mt-4 text-center text-[26px] font-bold leading-tight tracking-tight">Finish your project</h3>
      <p className="mt-1.5 text-center text-[14px] leading-snug text-white/70">Unlimited enhancements and your Studio, 7 days free</p>

      <ul className="mt-5 space-y-2.5 text-[14px]">
        {[
          `Enhance all ${p.photos.length} photos in “${p.title}” (${remaining} left)`,
          'Keep your identities, projects and saved setups',
          'New looks with Me every week, no re-uploads',
        ].map((t) => (
          <li key={t} className="flex gap-2.5">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand">
              <I.Check size={12} strokeWidth={3} />
            </span>
            {t}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3">
        <span className="text-[15px] font-semibold">Free trial enabled</span>
        <button onClick={() => setTrial(!trial)} className={`relative h-[31px] w-[51px] rounded-full transition ${trial ? 'bg-[#34C759]' : 'bg-white/20'}`}>
          <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-all ${trial ? 'left-[22px]' : 'left-[2px]'}`} />
        </button>
      </div>
      <div className="mt-2.5 rounded-2xl p-4 ring-2 ring-[#FF2E7E]">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-bold">{trial ? '7-day free trial' : 'Weekly'}</span>
          {trial && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold">FREE</span>}
        </div>
        <div className="mt-0.5 text-[13px] text-mute">{trial ? 'Then billed weekly' : 'Billed weekly'}</div>
      </div>

      <PillBrand demo="start-trial" className="mt-5" onClick={() => startTrial(projectId)}>
        {trial ? 'Start free trial' : 'Continue'}
        <LeverTag l="t" />
      </PillBrand>
      <div className="mt-3 flex justify-center gap-4 text-[12px] text-mute">
        <span>Cancel anytime</span>·<span>Restore</span>·<span>Terms</span>
      </div>
      <button onClick={closeSheet} className="mt-1 h-10 w-full text-[13px] font-semibold text-white/50">
        Not now
      </button>
    </div>
  );
}

function ShareSheet({ projectId }: { projectId: string }) {
  const { projects, showToast, track, closeSheet, push } = useStore();
  const p = projects.find((x) => x.id === projectId);
  if (!p) return null;
  const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const link = p.shared?.link ?? `remini.app/p/${slug}`;
  const people = p.shared?.collaborators ?? ['You'];
  const feed = p.shared?.feed ?? [{ who: 'You', text: `created ${p.title}`, when: p.lastEdit }];
  const send = (via: string) => {
    track('invite_sent', 'I');
    showToast(`Invite sent via ${via}`);
  };
  return (
    <div className="px-5 pt-1">
      <div className="flex items-center justify-between">
        <h3 className="text-[20px] font-bold">Share “{p.title}”</h3>
        <V2Badge />
      </div>
      <p className="mt-1 text-[13px] text-mute">Friends can view, add photos and apply the same look. No app needed to join.</p>

      <div data-demo="share-link" className="relative mt-4 flex items-center gap-2 rounded-2xl bg-white/[0.06] p-2 pl-3.5">
        <I.Link size={18} className="text-mute" />
        <span className="flex-1 truncate text-[15px] font-semibold">{link}</span>
        <button
          onClick={() => {
            track('share_link_copied', 'I');
            showToast('Link copied');
          }}
          className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold text-black"
        >
          <I.Copy size={15} /> Copy
        </button>
        <LeverTag l="I" />
      </div>

      <div className="mt-4 flex justify-between">
        {['Messages', 'WhatsApp', 'Instagram', 'Mail', 'More'].map((v, i) => (
          <button key={v} onClick={() => send(v)} className="flex flex-col items-center gap-1.5 text-[11px] text-white/70">
            <span className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-white/[0.08] text-[15px] font-bold text-white" style={{ background: ['#2ED47A33', '#25D36633', '#FF4F9A33', '#3DA5FF33', '#ffffff14'][i] }}>
              {v === 'More' ? <I.More /> : v[0]}
            </span>
            {v}
          </button>
        ))}
      </div>

      <div className="mt-5 text-[12px] font-semibold uppercase tracking-wider text-mute">Collaborators</div>
      <div className="mt-2.5 flex items-center gap-2">
        {people.map((c) => (
          <div key={c} className="flex flex-col items-center gap-1">
            <Avatar name={c} size={40} />
            <span className="text-[11px] text-white/70">{c}</span>
          </div>
        ))}
        <button onClick={() => send('contacts')} className="flex flex-col items-center gap-1">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-white/30">
            <I.Plus size={18} />
          </span>
          <span className="text-[11px] text-white/70">Invite</span>
        </button>
      </div>

      <div className="mt-5 text-[12px] font-semibold uppercase tracking-wider text-mute">Contributions</div>
      <div className="mt-1.5">
        {feed.map((f, i) => (
          <div key={i} className="flex items-center gap-2.5 py-1.5 text-[13px]">
            <Avatar name={f.who} size={24} />
            <span className="flex-1">
              <b>{f.who}</b> {f.text}
            </span>
            <span className="text-mute">{f.when}</span>
          </div>
        ))}
      </div>

      <PillGhost
        demo="preview-recipient"
        className="mt-4"
        onClick={() => {
          track('web_invite_viewed', 'I');
          closeSheet();
          push({ name: 'recipient' });
        }}
      >
        <I.Globe size={18} /> Preview what an invited friend sees
      </PillGhost>
    </div>
  );
}

function CreateWith({ identityId }: { identityId: string }) {
  const { identities, closeSheet, push } = useStore();
  const { tryTrendWithIdentity } = useFlows();
  const idn = identities.find((i) => i.id === identityId) ?? identities[0];
  const opt = (icon: JSX.Element, title: string, sub: string, fn: () => void) => (
    <button onClick={fn} className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.05] p-3 text-left active:bg-white/10">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10">{icon}</span>
      <span className="flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[12px] text-mute">{sub}</span>
      </span>
      <I.Chevron size={18} className="text-mute" />
    </button>
  );
  return (
    <div className="space-y-2 px-5 pt-1">
      <h3 className="mb-3 text-[20px] font-bold">Create with {idn.name}</h3>
      {opt(<I.Studio />, 'New project', 'Profile refresh, archive, trip, friends', () => {
        closeSheet();
        push({ name: 'newProject' });
      })}
      {opt(<Img src={TRENDS[0].result} className="h-11 w-11 rounded-xl" label={false} />, 'Try this week’s trend', 'Y2K Yearbook · no upload', () => {
        closeSheet();
        tryTrendWithIdentity('y2k', idn.name);
      })}
      {opt(<I.Refresh />, 'Use a saved look', 'Studio light · navy blazer', () => {
        closeSheet();
        push({ name: 'result', kind: 'look', image: `${A.linkedin(2)}|${A.look(7)}`, title: 'Studio light · navy blazer' });
      })}
    </div>
  );
}

function Privacy() {
  const { closeSheet, showToast } = useStore();
  return (
    <div className="px-5 pt-1">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#2ED47A]/15 text-[#2ED47A]">
        <I.Shield />
      </span>
      <h3 className="mt-3 text-[20px] font-bold">Your face data is private</h3>
      <ul className="mt-3 space-y-2.5 text-[14px] leading-snug text-white/80">
        <li>• Identities are only used when you tap “Create” or “Try with”.</li>
        <li>• Never shared with collaborators; they see results, not your model.</li>
        <li>• Delete an identity and its reference photos anytime, instantly.</li>
      </ul>
      <PillWhite className="mt-6" onClick={closeSheet}>
        Got it
      </PillWhite>
      <button onClick={() => showToast('Demo: deletion is disabled in the prototype')} className="mt-2 h-11 w-full text-[14px] font-semibold text-[#FF5A6E]">
        Delete this identity
      </button>
    </div>
  );
}

function NewIdentity() {
  const { closeSheet, push, pop, runGenerating, addIdentity, showToast } = useStore();
  return (
    <div className="px-5 pt-1">
      <h3 className="text-[20px] font-bold">New identity</h3>
      <p className="mt-1 text-[14px] text-mute">A saved version of you (or someone who agreed) that every tool can reuse: a new haircut, a professional look, your partner.</p>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="grid aspect-square place-items-center rounded-xl border border-dashed border-white/20 text-white/40">
            <I.Camera size={18} />
          </div>
        ))}
      </div>
      <PillWhite
        className="mt-5"
        onClick={() => {
          closeSheet();
          push({
            name: 'picker',
            title: 'Pick 4 photos',
            max: 4,
            preselectAll: true,
            pool: CAMERA_ROLL.filter((c) => c.startsWith('me_')),
            cta: 'Create identity',
            onDone: (picked) => {
              pop();
              runGenerating({ steps: ['Checking faces', 'Learning your features', 'Saving identity'], duration: 2000, preview: picked[0] }, () => {
                addIdentity('Me · New look', picked);
                showToast('Identity saved');
              });
            },
          });
        }}
      >
        Pick 4 photos
      </PillWhite>
    </div>
  );
}

function ProfileToday() {
  const { closeSheet } = useStore();
  return (
    <div className="px-5 pt-1">
      <h3 className="text-[20px] font-bold">Account</h3>
      <div className="mt-3 rounded-2xl bg-white/[0.05] p-4 text-[14px]">
        <div className="flex justify-between">
          <span className="text-mute">Plan</span>
          <span className="font-semibold">Free</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span className="text-mute">History</span>
          <span className="font-semibold">Not kept</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span className="text-mute">Your models</span>
          <span className="font-semibold">In AI Photos</span>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-mute">Results are saved to your camera roll. There's nothing here to come back to.</p>
      <PillWhite className="mt-5" onClick={closeSheet}>
        Close
      </PillWhite>
    </div>
  );
}
