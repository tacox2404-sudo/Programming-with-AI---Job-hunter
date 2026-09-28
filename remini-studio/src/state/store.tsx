import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { A, IDENTITIES, LINKEDIN_SETUP, LOOKS, SAVED_LOOKS, linkedInPhotos, photo, seedProjects } from './data';
import type {
  Generating,
  Identity,
  Lever,
  LogEvent,
  Look,
  Mode,
  Project,
  Route,
  SavedLook,
  Setup,
  Sheet,
  Tab,
  TemplateId,
} from './types';

export const FREE_LIMIT = 5;

/** A mutable value mirrored into React state, so actions can read the latest value synchronously. */
function useSyncState<T>(initial: T | (() => T)) {
  const [state, setState] = useState<T>(initial);
  const ref = useRef(state);
  const set = useCallback((next: T | ((prev: T) => T)) => {
    const value = typeof next === 'function' ? (next as (p: T) => T)(ref.current) : next;
    ref.current = value;
    setState(value);
  }, []);
  return [state, set, ref] as const;
}

let lookSeq = 100;
const newLook = (src: string, title: string, category: Look['category'], identityId = 'me'): Look => ({
  id: `lk${++lookSeq}`,
  src,
  title,
  category,
  identityId,
  when: 'Just now',
  isNew: true,
});

const SETUPS: Record<TemplateId, Setup> = {
  profile: LINKEDIN_SETUP,
  archive: {
    name: 'Faithful restore',
    style: 'Restore, keep period look',
    background: 'Keep original',
    outfit: 'Keep original',
    prompt: 'Repair scratches and fading, sharpen faces, subtle colorization',
  },
  trip: {
    name: 'Golden hour',
    style: 'Warm film, late sun',
    background: 'Keep original',
    outfit: 'Keep original',
    prompt: 'Golden hour light, warm tones, soft grain, consistent across the set',
  },
  couple: {
    name: 'Editorial duo',
    style: 'Editorial, natural light',
    background: 'City street, shallow depth',
    outfit: 'Coordinated neutrals',
    prompt: 'Two friends laughing, candid editorial shot, 50mm',
  },
};

const NEXT_STEP: Record<TemplateId, string> = {
  profile: 'Add a headshot with natural light for a better match',
  archive: 'Animate a memory from the album',
  trip: 'Apply one look to the whole set',
  couple: 'Add the second identity',
};

function useStoreValue() {
  const [mode, setModeState] = useState<Mode>('today');
  const [tab, setTab] = useState<Tab>('enhance');
  const [stack, setStack, stackRef] = useSyncState<Route[]>([]);
  const [navDir, setNavDir] = useState<1 | -1>(1);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [generating, setGenerating] = useState<Generating | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showLevers, setShowLevers] = useState(false);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [identities, setIdentities] = useSyncState<Identity[]>(IDENTITIES);
  const [looks, setLooks] = useSyncState<Look[]>(LOOKS);
  const [projects, setProjects, projectsRef] = useSyncState<Project[]>(seedProjects);
  const [savedLooks] = useState<SavedLook[]>(SAVED_LOOKS);
  const [freeUsed, setFreeUsed] = useState(4);
  const [isPro, setIsPro] = useState(false);
  const [demo, setDemo] = useState<number | null>(null);
  const [splash, setSplash] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const timers = useRef<number[]>([]);
  const genDone = useRef<(() => void) | null>(null);
  const toastTimer = useRef<number>();
  const startedAt = useRef(Date.now());
  const evSeq = useRef(0);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    genDone.current = null;
    setGenerating(null);
    setProcessing(null);
  }, []);

  // ---------- analytics ----------
  const track = useCallback((name: string, lever?: Lever) => {
    const s = Math.floor((Date.now() - startedAt.current) / 1000);
    const at = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    setEvents((ev) => [{ id: ++evSeq.current, name, lever, at }, ...ev].slice(0, 60));
  }, []);

  // ---------- navigation ----------
  const push = useCallback((r: Route) => {
    setNavDir(1);
    setStack((s) => [...s, r]);
  }, [setStack]);

  const pop = useCallback(() => {
    setNavDir(-1);
    setStack((s) => s.slice(0, -1));
  }, [setStack]);

  const replaceTop = useCallback((r: Route) => {
    setNavDir(1);
    setStack((s) => [...s.slice(0, -1), r]);
  }, [setStack]);

  const resetStack = useCallback((routes: Route[] = [], dir: 1 | -1 = 1) => {
    setNavDir(dir);
    setStack(routes);
  }, [setStack]);

  const goTab = useCallback((t: Tab) => {
    setNavDir(1);
    setTab(t);
    setStack([]);
    setSheet(null);
  }, [setStack]);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    setSheet(null);
    setGenerating(null);
    genDone.current = null;
    setStack([]);
    setTab(m === 'studio' ? 'studio' : 'enhance');
    track(m === 'studio' ? 'mode_with_studio' : 'mode_today');
  }, [setStack, track]);

  // ---------- overlays ----------
  const openSheet = useCallback((s: Sheet) => setSheet(s), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const runGenerating = useCallback((g: Generating, onDone: () => void) => {
    setGenerating(g);
    genDone.current = onDone;
    later(() => {
      const fn = genDone.current;
      genDone.current = null;
      setGenerating(null);
      fn?.();
    }, g.duration);
  }, [later]);

  // ---------- domain ----------
  const updateProject = useCallback((id: string, fn: (p: Project) => Project) => {
    setProjects((ps) => ps.map((p) => (p.id === id ? fn(p) : p)));
  }, [setProjects]);

  const createProject = useCallback(
    (opts: { template: TemplateId; title: string; identityId: string; photos: string[]; fromPhoto?: string }) => {
      const id = `p${Date.now().toString(36)}`;
      const archive = opts.template === 'archive';
      const photos = [
        ...(opts.fromPhoto ? [photo(opts.fromPhoto, 'enhanced' as const)] : []),
        ...opts.photos.map((src) => {
          const m = src.match(/archive_old_(\d+)/);
          return photo(src, 'original', archive && m ? A.restored(Number(m[1])) : undefined);
        }),
      ];
      const p: Project = {
        id,
        title: opts.title || 'Untitled project',
        template: opts.template,
        identityId: opts.identityId,
        cover: opts.fromPhoto ?? photos[0]?.original ?? A.ref(1),
        photos,
        looks: [],
        setup: SETUPS[opts.template],
        lastEdit: 'Just now',
        nextStep: NEXT_STEP[opts.template],
      };
      setProjects((ps) => [p, ...ps]);
      track('project_created', 't');
      return id;
    },
    [setProjects, track],
  );

  const ensureLinkedIn = useCallback((fresh = false) => {
    const existing = projectsRef.current.find((p) => p.template === 'profile');
    if (existing && !fresh) return existing.id;
    const p: Project = {
      id: existing?.id ?? 'linkedin',
      title: existing?.title ?? 'LinkedIn refresh',
      template: 'profile',
      identityId: 'me',
      cover: existing?.cover ?? A.enhanceSrc,
      photos: linkedInPhotos(existing?.photos[0]?.original ?? A.enhanceSrc),
      looks: [],
      setup: LINKEDIN_SETUP,
      lastEdit: 'Just now',
      nextStep: NEXT_STEP.profile,
    };
    setProjects((ps) => [p, ...ps.filter((x) => x.id !== p.id)]);
    return p.id;
  }, [projectsRef, setProjects]);

  /** Demo helper: mark every photo of a project as enhanced. */
  const completeProject = useCallback((id: string) => {
    updateProject(id, (pr) => ({ ...pr, photos: pr.photos.map((ph) => ({ ...ph, status: 'enhanced' })) }));
  }, [updateProject]);

  const processProject = useCallback(
    (id: string) => {
      const p = projectsRef.current.find((x) => x.id === id);
      if (!p) return;
      const todo = p.photos.filter((ph) => ph.status !== 'enhanced').map((ph) => ph.id);
      if (!todo.length) return;
      setProcessing(id);
      updateProject(id, (pr) => ({
        ...pr,
        lastEdit: 'Just now',
        photos: pr.photos.map((ph) => (todo.includes(ph.id) ? { ...ph, status: 'processing' } : ph)),
      }));
      todo.forEach((phId, i) => {
        later(() => {
          updateProject(id, (pr) => ({
            ...pr,
            photos: pr.photos.map((ph) => (ph.id === phId ? { ...ph, status: 'enhanced' } : ph)),
          }));
          if (i === todo.length - 1) {
            setProcessing(null);
            track('batch_enhance_completed', 'c');
            showToast(`${todo.length} photos enhanced`);
            updateProject(id, (pr) => ({
              ...pr,
              nextStep: pr.template === 'profile' ? 'Generate 4 looks with your saved setup' : pr.nextStep,
            }));
          }
        }, 500 + i * 110);
      });
    },
    [later, projectsRef, showToast, track, updateProject],
  );

  const enhanceAll = useCallback(
    (id: string) => {
      const p = projectsRef.current.find((x) => x.id === id);
      if (!p) return;
      const remaining = p.photos.filter((ph) => ph.status === 'original').length;
      if (!remaining) {
        showToast('Everything in this project is enhanced');
        return;
      }
      track('enhance_all_tapped', 't');
      if (!isPro && freeUsed + remaining > FREE_LIMIT) {
        setFreeUsed(FREE_LIMIT);
        track('paywall_viewed_in_project', 't');
        setSheet({ type: 'paywall', projectId: id, stage: 'offer' });
        return;
      }
      processProject(id);
    },
    [freeUsed, isPro, processProject, projectsRef, showToast, track],
  );

  const startTrial = useCallback(
    (projectId: string) => {
      setIsPro(true);
      track('trial_started', 't');
      setSheet({ type: 'paywall', projectId, stage: 'success' });
    },
    [track],
  );

  const addLooksToProject = useCallback(
    (id: string, list: Look[]) => {
      updateProject(id, (pr) => ({ ...pr, looks: [...list, ...pr.looks], lastEdit: 'Just now' }));
      setLooks((ls) => [...list.map((l) => ({ ...l, id: `${l.id}i` })), ...ls]);
    },
    [setLooks, updateProject],
  );

  const lookSet = (p: Project, n: number) => {
    if (p.template === 'profile') {
      const titles = ['Headshot · grey', 'Headshot · window', 'Half body · office', 'Candid · coffee'];
      return Array.from({ length: n }, (_, i) =>
        newLook(`${A.linkedin((p.looks.length + i) % 4 + 1)}|${A.look(7 + (i % 2))}`, titles[i % 4], 'professional', p.identityId),
      );
    }
    return Array.from({ length: n }, (_, i) => newLook(A.look(((p.looks.length + i) % 8) + 1), p.setup?.name ?? 'New look', 'casual', p.identityId));
  };

  const generateLooks = useCallback(
    (id: string, instant = false) => {
      const p = projectsRef.current.find((x) => x.id === id);
      if (!p) return;
      const finish = () => {
        const p2 = projectsRef.current.find((x) => x.id === id)!;
        addLooksToProject(id, lookSet(p2, 4));
        track('looks_generated_from_setup', 'c');
        updateProject(id, (pr) => ({ ...pr, nextStep: 'Pick your favourite and export the set' }));
        if (!instant) showToast('4 new looks added');
      };
      if (instant) return finish();
      runGenerating({ steps: [`Loading "${p.setup?.name ?? 'setup'}"`, 'Generating with your identity', 'Matching light and color'], duration: 2200 }, finish);
    },
    [addLooksToProject, projectsRef, runGenerating, showToast, track, updateProject],
  );

  const rerunSetup = useCallback(
    (id: string, src: string) => {
      const p = projectsRef.current.find((x) => x.id === id);
      if (!p) return;
      runGenerating({ steps: ['Applying your saved setup', `${p.setup?.style ?? 'Style'}`, 'Finishing'], duration: 2000, preview: src }, () => {
        const look = newLook(src, `${p.setup?.name ?? 'Setup'} · new photo`, p.template === 'profile' ? 'professional' : 'casual', p.identityId);
        addLooksToProject(id, [look]);
        track('setup_rerun', 'c');
        showToast('Same setup, new photo: added to Looks');
        setNavDir(1);
        setStack((s) => s.map((r) => (r.name === 'project' && r.id === id ? { ...r, tab: 'looks' } : r)));
      });
    },
    [addLooksToProject, projectsRef, runGenerating, setStack, showToast, track],
  );

  const saveLookToStudio = useCallback(
    (src: string, title: string, category: Look['category'] = 'trend') => {
      setLooks((ls) => (ls.some((l) => l.src === src && l.isNew) ? ls : [newLook(src, title, category), ...ls]));
      track('saved_to_studio', 'w');
    },
    [setLooks, track],
  );

  const addPhotoToProject = useCallback(
    (id: string, src: string) => {
      updateProject(id, (pr) => ({ ...pr, photos: [photo(src, 'enhanced'), ...pr.photos], lastEdit: 'Just now' }));
      track('photo_added_to_project', 'w');
    },
    [track, updateProject],
  );

  const joinShared = useCallback(
    (picked: string[]) => {
      updateProject('summer', (pr) => ({
        ...pr,
        photos: [...picked.map((s) => photo(s, 'enhanced')), ...pr.photos],
        shared: pr.shared && {
          ...pr.shared,
          collaborators: pr.shared.collaborators.includes('You') ? pr.shared.collaborators : [...pr.shared.collaborators, 'You'],
          feed: [{ who: 'You', text: `joined and added ${picked.length} photos`, when: 'now' }, ...pr.shared.feed],
        },
      }));
      track('invite_joined', 'I');
    },
    [track, updateProject],
  );

  const improveIdentity = useCallback(
    (id: string, picked: string[]) => {
      setIdentities((is) => is.map((i) => (i.id === id ? { ...i, refs: [...i.refs, ...picked].slice(0, 8) } : i)));
      track('identity_improved', 'c');
    },
    [setIdentities, track],
  );

  const addIdentity = useCallback(
    (name: string, refs: string[]) => {
      const id = `id${Date.now().toString(36)}`;
      setIdentities((is) => [...is, { id, name, subtitle: `${refs.length} photos`, cover: refs[0], refs }]);
      track('identity_saved', 'c');
      return id;
    },
    [setIdentities, track],
  );

  const markAnimated = useCallback(
    (projectId: string, src: string) => {
      updateProject(projectId, (pr) => ({ ...pr, animated: [...(pr.animated ?? []), src] }));
    },
    [updateProject],
  );

  const setFlags = useCallback((f: { isPro?: boolean; freeUsed?: number }) => {
    if (f.isPro !== undefined) setIsPro(f.isPro);
    if (f.freeUsed !== undefined) setFreeUsed(f.freeUsed);
  }, []);

  const resetAll = useCallback(() => {
    clearTimers();
    setModeState('today');
    setTab('enhance');
    setStack([]);
    setSheet(null);
    setGenerating(null);
    setToast(null);
    setEvents([]);
    setIdentities(IDENTITIES);
    setLooks(LOOKS);
    setProjects(seedProjects());
    setFreeUsed(4);
    setIsPro(false);
    setProcessing(null);
    startedAt.current = Date.now();
  }, [clearTimers, setIdentities, setLooks, setProjects, setStack]);

  const useFreeEnhancement = useCallback(() => {
    setFreeUsed((n) => Math.min(FREE_LIMIT, n + 1));
  }, []);

  return {
    mode, setMode, tab, goTab, stack, stackRef, navDir, push, pop, replaceTop, resetStack,
    sheet, openSheet, closeSheet, generating, runGenerating, toast, showToast,
    showLevers, setShowLevers, events, track, clearEvents: useCallback(() => setEvents([]), []),
    identities, looks, projects, projectsRef, savedLooks, freeUsed, isPro, processing,
    demo, setDemo, splash, setSplash,
    createProject, ensureLinkedIn, completeProject, enhanceAll, processProject, startTrial, generateLooks, rerunSetup,
    saveLookToStudio, addPhotoToProject, joinShared, improveIdentity, addIdentity, markAnimated,
    setFlags, resetAll, clearTimers, useFreeEnhancement, updateProject,
  };
}

export type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}
