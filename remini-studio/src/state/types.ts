export type Mode = 'today' | 'studio';
export type Lever = 't' | 'c' | 'w' | 'I';
export type Tab = 'studio' | 'enhance' | 'aiphotos' | 'filters' | 'videos' | 'retouch';

export type TemplateId = 'profile' | 'archive' | 'trip' | 'couple';

export interface Identity {
  id: string;
  name: string;
  subtitle: string;
  cover: string;
  refs: string[];
}

export interface Look {
  id: string;
  src: string;
  title: string;
  category: 'trend' | 'professional' | 'casual';
  identityId: string;
  when: string;
  isNew?: boolean;
}

export interface ProjectPhoto {
  id: string;
  original: string;
  /** Separate restored/enhanced file. When absent, "before" is the original rendered degraded. */
  enhanced?: string;
  status: 'original' | 'processing' | 'enhanced';
}

export interface Setup {
  name: string;
  style: string;
  background: string;
  outfit: string;
  prompt: string;
}

export interface FeedItem {
  who: string;
  text: string;
  when: string;
}

export interface Project {
  id: string;
  title: string;
  template: TemplateId;
  identityId: string;
  cover: string;
  photos: ProjectPhoto[];
  looks: Look[];
  setup: Setup | null;
  lastEdit: string;
  nextStep: string;
  shared?: { owner: string; collaborators: string[]; link: string; feed: FeedItem[] };
  animated?: string[];
}

export interface SavedLook {
  id: string;
  title: string;
  cover: string;
  identityId: string;
}

export interface Trend {
  id: string;
  title: string;
  tagline: string;
  cover: string;
  result: string;
  hot?: boolean;
}

export type ResultKind = 'trend' | 'enhance' | 'look';

export type Route =
  | { name: 'trend'; trendId: string }
  | { name: 'result'; kind: ResultKind; image: string; title: string; trendId?: string; before?: string }
  | { name: 'picker'; title: string; max: number; preselectAll?: boolean; pool?: string[]; cta: string; onDone: (picked: string[]) => void }
  | { name: 'identity'; id: string }
  | { name: 'newProject'; fromPhoto?: string; template?: TemplateId; prefill?: boolean }
  | { name: 'project'; id: string; tab?: 'photos' | 'looks' | 'setup' }
  | { name: 'photo'; projectId: string; photoId: string }
  | { name: 'lock' }
  | { name: 'recipient' }
  | { name: 'about' }
  | { name: 'animate'; src: string; projectId: string }
  | { name: 'grid'; title: string; items: { src: string; title?: string }[] };

export type Sheet =
  | { type: 'saveToProject'; photo: string; title: string }
  | { type: 'paywall'; projectId: string; stage: 'offer' | 'success' }
  | { type: 'share'; projectId: string }
  | { type: 'createWith'; identityId: string }
  | { type: 'privacy' }
  | { type: 'newIdentity' }
  | { type: 'profileToday' };

export interface Generating {
  steps: string[];
  duration: number;
  preview?: string;
}

export interface LogEvent {
  id: number;
  name: string;
  lever?: Lever;
  at: string;
}
