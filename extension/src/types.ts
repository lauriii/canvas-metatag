import type { HostContext, PageFacts } from './host';

/** Plain text that may contain {tokens}. A literal is a template with no tokens. */
export type Template = string;

/** One shape at every scope. Every key is optional and absent means "inherit". */
export interface SeoValues {
  title?: Template;
  /** Template scope only: a page uses Canvas's own field. */
  description?: Template;
  /** Page scope only. */
  canonical?: string;
  social?: {
    title?: Template;
    description?: Template;
    /** A media UUID, or exactly one image token. */
    image?: string;
  };
  robots?: Robots;
  schema?: {
    type?: string;
    props?: Record<string, Template>;
    custom?: string;
  };
}

export interface Robots {
  noindex?: boolean;
  nofollow?: boolean;
  nosnippet?: boolean;
  /** -1 = no limit; 0 to 1000 characters. */
  max_snippet?: number;
  max_image_preview?: 'none' | 'standard' | 'large';
}

export interface Identity {
  kind: 'organization' | 'person';
  /** '' = the site name. */
  name: string;
  separator: string;
  logo: string;
  default_image: string;
  same_as: string[];
}

export interface SiteSettings {
  identity: Identity;
  values: SeoValues;
}

// The JSON-LD type registry (data/schema-types.json).

export interface SchemaProp {
  key: string;
  label: string;
  kind: 'text' | 'url' | 'date' | 'number' | 'enum' | 'image';
  default?: Template;
  level?: 'required' | 'recommended';
  options?: string[];
  pattern?: string;
  ai?: boolean;
}

export interface SchemaType {
  label: string;
  group: string;
  hint: string;
  extends?: string;
  page_type?: string;
  primary_type?: string;
  og_type?: string;
  refs?: Record<string, string>;
  nested?: Record<string, string>;
  props?: SchemaProp[];
}

export type Registry = Record<string, SchemaType>;

// GET /state.

export interface ImageInfo {
  url: string;
  width: number;
  height: number;
  alt: string;
  bytes: number;
  mime: string;
  name: string;
  thumb: string;
  /** Set on the effective social image only. */
  source?: 'override' | 'entity' | 'site';
}

export interface TokenInfo {
  label: string;
  type: 'text' | 'url' | 'datetime' | 'number' | 'image';
  value: string;
  image?: ImageInfo | null;
}

export interface MediaInfo {
  name: string;
  thumb: string;
  width: number;
  height: number;
}

export interface Head {
  title: string;
  meta: Record<string, string>[];
  link: Record<string, string>[];
  script: { type: string; textContent: unknown }[];
}

export interface Resolved {
  head: Head;
  image: ImageInfo | null;
  schema: {
    withheld: boolean;
    missing_required: string[];
    missing_recommended: string[];
  };
}

export interface Target {
  scope: 'page' | 'template';
  entity_type: 'canvas_page' | 'content_template';
  id: string;
  /** The page's label, or the bundle label for a template. */
  label: string;
  auto_save_key: string;
  translatable: boolean;
  default_langcode: string | null;
  published: boolean;
  has_draft: boolean;
  values: SeoValues;
  from_default: SeoValues;
}

export interface StatePayload {
  langcode: string;
  languages: Record<string, string>;
  origin: { url: string; source: 'settings' | 'frontend' | 'request' };
  can: { target: boolean; site: boolean };
  capabilities: {
    ai: {
      available: boolean;
      reason: null | 'no_provider' | 'not_usable';
    } | null;
  };
  site: SiteSettings;
  target: Target | null;
  preview: {
    entity_type: string;
    id: string;
    label: string;
    url: string;
  } | null;
  tokens: Record<string, TokenInfo>;
  media: Record<string, MediaInfo>;
  resolved: Resolved | null;
}

export interface MediaItem extends MediaInfo {
  uuid: string;
  alt: string;
}

export interface MediaPage {
  items: MediaItem[];
  more: boolean;
}

// AI submodule route.

export type SuggestField =
  'title' | 'description' | 'social.title' | 'social.description';

export type SuggestRequest =
  | {
      task: 'text';
      fields: SuggestField[];
      count: number;
      langcode: string;
      current: Partial<Record<SuggestField, string>>;
      hint: string;
      page: { title: string; site: string; text: string };
    }
  | {
      task: 'schema';
      langcode: string;
      page: { title: string; site: string; text: string };
    };

export interface TextSuggestions {
  suggestions: Partial<Record<SuggestField, string[]>>;
}

export interface SchemaSuggestion {
  type: string;
  props: Record<string, string>;
  unverified: string[];
}

// App state.

export type Scope = 'target' | 'site';

export type Tab =
  'search' | 'social' | 'schema' | 'checks' | 'identity' | 'defaults';

export interface Edits {
  target: SeoValues;
  site: SiteSettings;
}

/** A change that could not be confirmed, mirrored to session storage. */
export interface Pending {
  /** The user who made the first change; '' when it could not be read. */
  uid: string;
  /** canon() of the server values the changes were made against. */
  base: string;
  /** Dotted path => new value; null = override removed. */
  changes: Record<string, unknown>;
}

export interface SaveStatus {
  phase: 'idle' | 'pending' | 'saving' | 'saved' | 'error';
  message?: string;
}

export interface State {
  phase: 'loading' | 'ready' | 'forbidden' | 'error';
  ctx: HostContext;
  /** Last server truth. */
  server: StatePayload | null;
  scope: Scope;
  /** Always tabs[scope]. */
  tab: Tab;
  /** Each scope remembers its tab. */
  tabs: Record<Scope, Tab>;
  /** Working copies. */
  edits: Edits;
  /** canon() of the last confirmed draft payload. */
  sent: string | null;
  siteDirty: boolean;
  save: Record<Scope, SaveStatus>;
  /** Dotted path => the server's sentence, per scope. */
  errors: Record<Scope, Record<string, string>>;
  live: { title?: string; description?: string; alias?: string };
  facts: PageFacts | null;
  readonly: 'no' | 'store' | 'conflict' | 'access';
  /** A pending change of the current scope's storage key that may not be applied by itself. */
  offer: { scope: Scope; pending: Pending } | null;
  /** Snapshot before a reset, discard or restore. */
  undo: { text: string; edits: Edits; path?: string } | null;
  /** Footer text for 4 s. */
  flash: string | null;
}

export type Action =
  | { type: 'loading'; ctx: HostContext }
  | {
      type: 'loaded';
      ctx: HostContext;
      payload: StatePayload;
      readonly: State['readonly'];
      flash?: string;
    }
  | { type: 'failed'; phase: 'forbidden' | 'error' }
  /** An editor round trip, a publish or a discard: new server truth. */
  | { type: 'refreshed'; payload: StatePayload; readonly: State['readonly'] }
  /** Our own write was confirmed. Never touches the inputs. */
  | { type: 'confirmed'; payload: StatePayload; sent: string }
  | { type: 'edit'; scope: Scope; path: string; value: unknown }
  | { type: 'reset'; scope: Scope; path: string }
  /** Replaces a working copy, as typing would. With `undo` the copy from before is kept. */
  | {
      type: 'apply';
      scope: Scope;
      values: SeoValues | SiteSettings;
      undo?: string;
      /** With `undo: 'Reset'`: the field whose source line offers the Undo. */
      path?: string;
    }
  | { type: 'undo' }
  | { type: 'discard' }
  /** `sent`: canon() of the site settings that were saved. */
  | { type: 'siteSaved'; payload: StatePayload; sent: string }
  | { type: 'scope'; scope: Scope }
  | { type: 'tab'; tab: Tab }
  | { type: 'save'; scope: Scope; save: SaveStatus }
  | { type: 'errors'; scope: Scope; fields: Record<string, string> }
  | { type: 'live'; live: State['live'] }
  | { type: 'facts'; facts: PageFacts | null }
  | { type: 'readonly'; readonly: State['readonly'] }
  | { type: 'offer'; offer: State['offer'] }
  | { type: 'flash'; flash: string | null };

// Checks.

export interface Jump {
  scope: Scope;
  tab: Tab;
  /** The field's dotted path within its scope. */
  field: string;
}

export interface Issue {
  id: string;
  severity: 'fix' | 'improve' | 'info';
  message: string;
  detail?: string;
  jump?: Jump;
  fix?:
    | { label: string; apply(values: SeoValues): SeoValues }
    | { label: string; suggest: string };
}

export type Source = 'target' | 'default' | 'site' | 'fallback';

export interface Texts {
  title: string;
  description: string;
  social_title: string;
  social_description: string;
}

/** Text width in px for a CSS font, or null when text cannot be measured. */
export type Measurer = ((text: string, font: string) => number) | null;
