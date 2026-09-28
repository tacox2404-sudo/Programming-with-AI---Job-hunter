import { A } from './data';
import type { Store } from './store';
import type { Lever, Mode, Route, Tab } from './types';

export interface Beat {
  step: number;
  title: string;
  caption: string;
  target: string | null;
  lever?: Lever;
  enter: (s: Store) => void;
}

/** Put the app in a known state so every beat works regardless of what was clicked before. */
function scene(s: Store, mode: Mode, tab: Tab, routes: Route[] = []) {
  s.clearTimers();
  s.closeSheet();
  if (s.mode !== mode) s.setMode(mode);
  s.goTab(tab);
  s.resetStack(routes);
}

const y2kResult: Route = { name: 'result', kind: 'trend', image: A.y2kMe, title: 'Y2K Yearbook', trendId: 'y2k' };
const enhanceResult: Route = { name: 'result', kind: 'enhance', image: A.enhanceSrc, title: 'Enhanced' };

export const BEATS: Beat[] = [
  {
    step: 1,
    title: 'Today: a trend is a one-shot',
    caption: 'Trends are how Remini acquires users. Tap Y2K Yearbook, upload 8–12 selfies, wait for a model to train.',
    target: 'trend-card',
    enter: (s) => scene(s, 'today', 'enhance'),
  },
  {
    step: 1,
    title: 'Today: one exit, Save to Gallery',
    caption: 'The result has a single action. The model it just trained is used once and forgotten.',
    target: 'save-gallery',
    enter: (s) => scene(s, 'today', 'enhance', [{ name: 'trend', trendId: 'y2k' }, y2kResult]),
  },
  {
    step: 1,
    title: 'Today: nothing to come back to',
    caption: 'Back in the app nothing persists: no space, no history, no projects. The face model is buried in AI Photos. The next visit waits for the next trend.',
    target: 'buried-models',
    enter: (s) => {
      scene(s, 'today', 'aiphotos');
      s.showToast('Saved to Gallery');
    },
  },
  {
    step: 2,
    title: 'With Studio: a place to come back to',
    caption: 'Same app, same tech. A new first tab, Studio, turns one-shot results into a personal creative space.',
    target: 'tab-studio',
    enter: (s) => scene(s, 'studio', 'studio'),
  },
  {
    step: 3,
    title: 'Identities, brought to the front',
    caption: 'The tech already exists; we bring it to the front. Train "Me" once, reuse it in every tool, every trend, every project.',
    target: 'identities',
    lever: 'c',
    enter: (s) => scene(s, 'studio', 'studio'),
  },
  {
    step: 3,
    title: 'Identity page',
    caption: 'Reference photos, a likeness tip that improves quality, every look made with Me, and clear privacy controls.',
    target: 'identity-refs',
    lever: 'c',
    enter: (s) => scene(s, 'studio', 'studio', [{ name: 'identity', id: 'me' }]),
  },
  {
    step: 4,
    title: 'Save to a Project?',
    caption: 'The key entry point: after any enhancement, the flow 90% of users already use, we offer to start a project.',
    target: 'sheet-new-project',
    lever: 't',
    enter: (s) => {
      scene(s, 'studio', 'enhance', [enhanceResult]);
      s.setFlags({ isPro: false, freeUsed: 5 });
      s.openSheet({ type: 'saveToProject', photo: A.enhanceSrc, title: 'Enhanced' });
    },
  },
  {
    step: 4,
    title: 'Create "LinkedIn refresh"',
    caption: 'Template "Profile refresh", identity Me, and Studio suggests 23 more photos of you. One tap and the project exists.',
    target: 'create-project',
    lever: 't',
    enter: (s) => scene(s, 'studio', 'enhance', [enhanceResult, { name: 'newProject', fromPhoto: A.enhanceSrc, template: 'profile' }]),
  },
  {
    step: 5,
    title: 'The free-limit moment',
    caption: 'A free user with a 24-photo project taps "Enhance all 24".',
    target: 'enhance-all',
    lever: 't',
    enter: (s) => {
      const id = s.ensureLinkedIn(true);
      s.setFlags({ isPro: false, freeUsed: 5 });
      scene(s, 'studio', 'studio', [{ name: 'project', id }]);
    },
  },
  {
    step: 5,
    title: 'Trial framed around the project',
    caption: '"Finish your project": unlimited enhancements and your Studio, 7 days free. Same trial-then-weekly plan as today; the reason to start is a job the user wants done.',
    target: 'start-trial',
    lever: 't',
    enter: (s) => {
      const id = s.ensureLinkedIn(true);
      s.setFlags({ isPro: false, freeUsed: 5 });
      scene(s, 'studio', 'studio', [{ name: 'project', id }]);
      s.openSheet({ type: 'paywall', projectId: id, stage: 'offer' });
    },
  },
  {
    step: 5,
    title: 'Back into the project',
    caption: 'Trial started. We land back in the project and all 24 photos process. No dead end, no "now what?".',
    target: 'project-progress',
    lever: 't',
    enter: (s) => {
      const id = s.ensureLinkedIn(true);
      s.setFlags({ isPro: true, freeUsed: 5 });
      scene(s, 'studio', 'studio', [{ name: 'project', id }]);
      s.processProject(id);
    },
  },
  {
    step: 6,
    title: 'Saved setup + re-run',
    caption: 'The recipe is saved: style, background, outfit, prompt. Re-run it on a new photo or generate 4 more looks. Value that compounds while the trial runs.',
    target: 'rerun-setup',
    lever: 'c',
    enter: (s) => {
      const id = s.ensureLinkedIn();
      s.setFlags({ isPro: true });
      s.completeProject(id);
      const p = s.projectsRef.current.find((x) => x.id === id);
      if (p && !p.looks.length) s.generateLooks(id, true);
      scene(s, 'studio', 'studio', [{ name: 'project', id, tab: 'setup' }]);
    },
  },
  {
    step: 7,
    title: 'A trend drops: "Try with Me"',
    caption: 'Next week a new trend lands on the Home feed. The CTA is now "Try with Me": no re-upload, seconds instead of minutes.',
    target: 'trend-cta',
    lever: 'w',
    enter: (s) => scene(s, 'studio', 'enhance'),
  },
  {
    step: 7,
    title: 'The result lands in the Studio',
    caption: 'Save to Studio, add to a project, or share. The trend still acquires; now it also feeds the space users return to.',
    target: 'save-studio',
    lever: 'w',
    enter: (s) => scene(s, 'studio', 'enhance', [y2kResult]),
  },
  {
    step: 7,
    title: 'Every trend lands in the Studio',
    caption: 'The new look sits under the identity on Studio home, next to projects and saved looks.',
    target: 'new-look',
    lever: 'w',
    enter: (s) => {
      scene(s, 'studio', 'studio');
      s.saveLookToStudio(A.y2kMe, 'Y2K Yearbook', 'trend');
    },
  },
  {
    step: 8,
    title: 'Reasons to come back',
    caption: 'Persistent state gives Remini honest notifications: a finished set, a friend’s photos, a trend already rendered on you. Each deep-links to the right screen.',
    target: 'notif-linkedin',
    lever: 'w',
    enter: (s) => scene(s, 'studio', 'studio', [{ name: 'lock' }]),
  },
  {
    step: 9,
    title: 'Share the project (v2)',
    caption: 'One link, collaborators, a contributions feed. Friends add photos and get the same look.',
    target: 'share-link',
    lever: 'I',
    enter: (s) => {
      scene(s, 'studio', 'studio', [{ name: 'project', id: 'summer' }]);
      s.openSheet({ type: 'share', projectId: 'summer' });
    },
  },
  {
    step: 9,
    title: 'The recipient joins, on the web',
    caption: '"Marta invited you to Summer ’26" → Join and add your photos. Works in any browser; every share is an install opportunity.',
    target: 'join',
    lever: 'I',
    enter: (s) => scene(s, 'studio', 'studio', [{ name: 'project', id: 'summer' }, { name: 'recipient' }]),
  },
];

export const TOTAL_STEPS = 9;
