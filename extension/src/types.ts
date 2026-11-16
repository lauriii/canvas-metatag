import type { HostContext, PageFacts } from './host';

/** What every page and node has: the facts a value can link to. */
export type Fact =
  | 'title'
  | 'description'
  | 'site'
  | 'url'
  | 'author'
  | 'published'
  | 'modified'
  | 'image';

/** The kind of value a place takes, and a fact or a source gives. */
export type Kind = 'text' | 'address' | 'date' | 'number' | 'image';

/** A Canvas entity-field source: a template's link to a field. */
export interface SourceRef {
  sourceType: 'entity-field';
  expression: string;
}

/**
 * A value: typed text (never scanned for names), a fact, a chosen media item
 * (images only) or a link to a field (templates only).
 */
export type Value =
  | { text: string }
  | { fact: Fact }
  | { media: string }
  | { source: SourceRef };

/** One shape at every scope. Every key is optional and absent means "inherit". */
export interface SeoValues {
  /** The title's main part. Not at site scope. */
  title?: Value;
  /** The title's ending; `{text: ''}` is "No ending". */
  title_end?: Value;
  /** Template scope only: a page uses Canvas's own field. */
  description?: Value;
  /** Page scope only. */
  canonical?: string;
  social?: {
    title?: Value;
    description?: Value;
    image?: Value;
  };
  robots?: Robots;
  schema?: {
    type?: string;
    props?: Record<string, Value>;
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
  default?: Value;
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

export interface FactInfo {
  label: string;
  kind: Kind;
  value: string;
  /** The Image fact's image. */
  image?: ImageInfo | null;
  /** The field a node's Description or Image fact is taken from. */
  via?: string;
}

/** A field a template value can link to, with the previewed node's value. */
export interface SourceRow {
  source: SourceRef;
  /** The path joined: "Venue › Street address". */
  label: string;
  /** The labels along the way, entity type hops left out. */
  path: string[];
  /** The machine name of the field it starts from. */
  field: string;
  /** It follows a reference: its first label is a level of the menu. */
  hop: boolean;
  kinds: Kind[];
  /** `none`: there is no node to preview. A hidden entry has no value. */
  status: 'ok' | 'empty' | 'hidden' | 'none';
  value: string;
  image?: ImageInfo | null;
  /** A list key's label, which the dialog shows. */
  shown?: string;
  /** A list field: its value is one of its keys. */
  list?: true;
  /** The referenced item's own name (its title, its name). */
  names?: true;
}

/** A stored link that cannot be read, and why. */
export interface BrokenLink {
  field: string;
  reason: 'missing' | 'kind' | 'error';
}

export interface MediaInfo {
  name: string;
  thumb: string;
  width: number;
  height: number;
  bytes: number;
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

/** Why AI suggestions are off, from `capabilities.ai.reason`. */
export type AiOffReason = 'no_provider' | 'not_usable' | 'no_prompt';

export interface StatePayload {
  langcode: string;
  languages: Record<string, string>;
  origin: { url: string; source: 'settings' | 'frontend' | 'request' };
  can: { target: boolean; site: boolean };
  capabilities: {
    ai: {
      available: boolean;
      reason: AiOffReason | null;
    } | null;
  };
  site: SiteSettings;
  target: Target | null;
  preview: {
    entity_type: string;
    id: string;
    label: string;
    url: string;
    /** Whether visitors can see it now. */
    published: boolean;
  } | null;
  facts: Record<Fact, FactInfo>;
  /** The identity's separator, with configuration overrides. */
  separator: string;
  /** Template scope: the fields the values may link to. */
  sources: SourceRow[];
  /** Template scope: stored links that cannot be read, by dotted path. */
  broken: Record<string, BrokenLink>;
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
      /** `ending`: the separator and the title ending, added after a title. */
      page: { title: string; site: string; text: string; ending?: string };
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
  /**
   * `refreshing`: another node previewed in the same template; the view
   * stays as it was until its answer arrives.
   */
  phase: 'loading' | 'refreshing' | 'ready' | 'forbidden' | 'error';
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
  /** `empty`: a template whose type has no content to preview. */
  readonly: 'no' | 'store' | 'conflict' | 'access' | 'empty';
  /** A pending change of the current scope's storage key that may not be applied by itself. */
  offer: { scope: Scope; pending: Pending } | null;
  /** Snapshot before a reset, discard or restore. */
  undo: { text: string; edits: Edits; path?: string } | null;
  /** Footer text for 4 s. */
  flash: string | null;
}

export type Action =
  | { type: 'loading'; ctx: HostContext; refresh?: boolean }
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
    | { label: string; suggest: string }
    /** Leads to the field and opens its link menu. */
    | { label: string; link: true };
}

export type Source = 'target' | 'default' | 'site' | 'fallback';

export interface Texts {
  title: string;
  description: string;
  social_title: string;
  social_description: string;
  /** The parts the title is made of, as cut. */
  title_main: string;
  title_end: string;
}

/** Text width in px for a CSS font, or null when text cannot be measured. */
export type Measurer = ((text: string, font: string) => number) | null;
