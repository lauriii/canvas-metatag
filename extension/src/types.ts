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
  | 'image'
  /** The publisher: the site's own identity. References only. */
  | 'identity';

/** The kind of value a place takes, and a fact or a source gives. */
export type Kind = 'text' | 'address' | 'date' | 'number' | 'image' | 'html' | 'ref' | 'hours';

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
  | { source: SourceRef; unit?: 'minute' | 'hour' };

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
    /** Hand-added items left out, by their `@id` as written. */
    skip?: string[];
    /** Details added to the module's own items, by short id: JSON text as written. */
    extend?: Partial<Record<'#primary' | '#webpage' | '#identity', string>>;
    /** The hand-added item the page is mainly about, by `@id` as written. */
    main?: string;
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
  /** An ISO 4217 code: the currency of every price that names none. '' = none. */
  currency: string;
  /** The site's default country (ISO 3166-1), which a country picker suggests; '' = none. State only. */
  country?: string;
  /** The site's default time zone, as an IANA name. State only. */
  timezone?: string;
}

// The JSON-LD type registry (data/schema-types.json), in the dialog's language.

export interface SchemaProp {
  key: string;
  label: string;
  kind: 'text' | 'url' | 'date' | 'number' | 'enum' | 'currency' | 'image' | 'ref' | 'hours';
  default?: Value;
  /** The main node is left out without it. */
  level?: 'required';
  options?: string[];
  /** Each option in words, in a sentence: "in stock". */
  option_labels?: Record<string, string>;
  pattern?: string;
  ai?: boolean;
  /** How an enum is emitted; false: stored, never in the graph, it decides what is. */
  emit?: false | 'url' | 'code' | 'type';
  /** Several values, in order. */
  list?: true;
  max?: number;
  /** The choices are a code list: "country". */
  codes?: string;
  /** A duration: whole units of this. */
  unit?: 'minute' | 'hour';
  /** The units a linked duration's field may count in. */
  units?: ('minute' | 'hour')[];
  /** Each item is a node of this type. */
  item?: string;
  /** Several values become one text, joined with this. */
  join?: string;
  /** Emitted with this detail, or not at all. */
  pair?: string;
  /** Formatted text, linked only. */
  html?: true;
  link_only?: true;
  /** Each page has its own: on a template only a field gives it (a closing date, performers). */
  per_item?: true;
  /** A reference: the kinds of page it accepts, and its type when it names. */
  accept?: string[];
  as?: string;
  /** The publisher can be it. */
  site?: true;
  /** On a Canvas page, the publisher when nobody set it. */
  page_default?: true;
  /** A reference carries its target's address. */
  inline?: string;
  /** Where it is not offered, and why. */
  scopes?: Partial<Record<'page' | 'template', 'component' | 'policy'>>;
  /** Counts only while these details have one of these values. */
  when?: Record<string, string[]>;
  /** Shown as a line under this detail. */
  under?: string;
  range?: [number, number];
  format?: string;
  /** A value the dialog suggests, never emitted unless chosen. */
  suggest?: string;
  /** The characters a result shows of it. */
  meter?: number;
  /** Its label inside its group, where it differs: "Name" for "Venue". */
  short?: string;
  /** The group it is a part of, and the nested group it sits in. */
  group?: string;
  part?: string;
}

/** A nested node of the main thing: a venue, an address, the pay. */
export interface SchemaGroup {
  label?: string;
  type: string;
  shape: string;
  /** Its parts in order: property keys and nested groups. */
  parts: string[];
  /** Each entry is a list of parts of which one must be set. */
  requires: string[][];
  needs?: string[];
  level?: 'required';
  list?: true;
  parent?: string;
}

/** One fact of a read-back sentence: a path in the built graph. */
export interface Slot {
  path: string;
  /** The detail that sets it. */
  prop?: string;
  /** The fact it shows. */
  fact?: Fact;
  /** The site setting that sets it. */
  site?: string;
  label?: string;
  /** The path of a price's currency. */
  currency?: string;
  /** Resolves only when these paths give these values. */
  if?: Record<string, string>;
  /** Resolves only when this path gives nothing. */
  unless?: string;
}

export interface SchemaType {
  label: string;
  /** A kind the editor chooses in "What this page is". */
  kind?: {
    label: string;
    /** In a sentence: "a product". */
    name: string;
    earn: string;
    not_for?: string;
    icon: string;
    order: number;
  };
  /** The detail its variants are chosen with: "Kind of article". */
  variants?: string;
  variant_of?: string;
  page_type?: string;
  primary_type?: string;
  og_type?: string;
  props?: SchemaProp[];
  /** The details shown before More details: properties and groups. */
  main?: string[];
  groups?: Record<string, SchemaGroup>;
  /** Where the type is not offered, and why. */
  scopes?: Partial<Record<'page' | 'template', 'component' | 'policy'>>;
  /** References to the site's nodes: fixed, or with the detail that replaces them. */
  refs?: Record<string, string | { to: string; unless?: string; if?: Record<string, string> }>;
  slots?: Record<string, Slot>;
  /** Sentences, each a list of variants; null when one has no translation. */
  say?: string[][] | null;
}

export type Registry = Record<string, SchemaType>;

/** A fact a feature asks for: its path, and what sets it. */
export interface FeatureFact {
  path: string;
  prop?: string;
  site?: string;
  /** The index of the rule it fails. */
  rule?: number;
  /** A value of another shape: the shape it must have. */
  expects?: ExpectsSpec;
}

/**
 * What a value must look like: "text", "number|text", "date|datetime",
 * "url|item:ImageObject", "enum:InStock|OutOfStock", or an item with the
 * names it must carry.
 */
export type ExpectsSpec = string | { is: string; needs?: string[] };

export type VerdictName =
  | 'needs'
  | 'unanswered'
  | 'ready'
  | 'complete'
  | 'not_fit'
  | 'not_here'
  | 'closed'
  | 'elsewhere'
  | 'retired'
  | 'none';

export interface Verdict {
  feature: string | null;
  /** The `@id` of the node it is about. */
  node: string | null;
  verdict: VerdictName;
  missing?: FeatureFact[];
  helps?: FeatureFact[];
  /** Why it does not fit: a `not_for` id. */
  reason?: string;
  /** A closed job's closing date. */
  date?: string;
  /** A list: the complete things it lists, of how many. */
  count?: number;
  of?: number;
}

/** data/search-features.json, in the dialog's language. */
export interface SearchFeatures {
  reviewed: string;
  props: Record<string, string>;
  site: Record<string, string>;
  facts: Record<string, { label: string; need: string }>;
  /** What each documented name's value must look like. */
  expects?: Record<string, ExpectsSpec>;
  /** Types that count as another without the downloaded vocabulary; "*" is any. */
  subtypes?: Record<string, string[]>;
  /** One line about each documented type, in the module's own words. */
  about?: Record<string, string>;
  /** A plain label for types whose name in words is not one. */
  labels?: Record<string, string>;
  features: Record<
    string,
    {
      label: string;
      /** "merchant listings": what a fact is needed for. */
      for?: string;
      where: string;
      status: 'shown' | 'retired';
      since?: string;
      changelog?: string;
      doc?: string;
      on: string[];
      /** Judged only on this site node ("identity"), on the home page. */
      node?: string;
      /** A list is one of; "a|b" either. */
      required?: (string | string[])[];
      complete?: string[];
      recommended?: string[];
      rules?: { path: string; need?: string; gt?: number; is?: string; when?: string }[];
      /** Judged only on hand-added items, or only on the page node. */
      only?: 'hand' | 'page';
      expects?: Record<string, ExpectsSpec>;
      /** The item list's sentence: clauses of variants, each dropped when its values are missing. */
      say?: string[][] | null;
      names?: string[];
      /** A list feature: what it lists, and how many at least. */
      list?: { of: string; min: number };
      /** What a thing it lists needs: "a list page with at least 3 courses". */
      elsewhere?: string;
      accepts?: Record<string, string[]>;
      not_for?: { id: string; reason: string; why: string; suggest?: string; seller?: string; ours?: string }[];
      confirm?: string[];
    }
  >;
}

/** One node of the graph, emitted or left out. */
export interface GraphNode {
  id: string | null;
  type: string;
  origin: 'site' | 'page' | 'main' | 'hand';
  /** A hand-added item's index in the custom JSON-LD. */
  item?: number;
  /** Its index in `@graph`, when emitted. */
  at?: number;
  left_out?: 'withheld' | 'skip' | 'reserved' | 'duplicate' | 'empty' | 'over';
  /** A module node details were added to. */
  extended?: true;
}

/** A rule a hand-added item breaks. */
export interface GraphRule {
  rule: 'second_identity' | 'dangling' | 'own_reviews' | 'relative';
  item: number;
  node: string | null;
  value?: string;
}

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
  /** A field of several values, and how many the previewed item has. */
  many?: true;
  /** One long plain text: a list takes its lines. */
  lines?: true;
  count?: number;
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
    /** Why the main node was left out, and the node it would have been. */
    withheld: { missing: string[]; dropped: string[]; node: Record<string, unknown> } | null;
    /** Values that do not fit their kind, with what they gave. */
    dropped: { key: string; value: string; kind: string }[];
    /** Where each value of the main node came from. */
    sources: Record<string, 'set' | 'default' | 'site'> | [];
    /** The values of the details that decide, never emitted. */
    gates: Record<string, string> | [];
    /** The registry type the graph was built as. */
    type: string;
    /** A stored type the registry does not have. */
    unknown_type: string | null;
    nodes: GraphNode[];
    /** Groups with values that were left out, and what they miss. */
    incomplete?: { group: string; missing: string[] }[];
    /** List items left out. */
    dropped_items?: { key: string; count: number; reason: 'invalid' | 'private' | 'hidden' | 'max' }[];
    /** References that name their target instead of pointing at it. */
    refs_inline?: { key: string; name: string; reason: string }[];
    /** References that are the publisher only by a Canvas page's default. */
    defaults?: string[];
    /** Details left out because their pair gives nothing. */
    unpaired?: string[];
    /** Pay left out: From above To. */
    pay_order?: boolean;
    /** The main node as the verdicts judge it, with its incomplete groups, when it ships without them. */
    judged?: Record<string, unknown> | null;
    front: boolean;
    features: Verdict[];
    rules: GraphRule[];
    /** Added details the module's own values win over, by node and path. */
    clashes?: { node: string; path: string; prop?: string }[];
    /** Added details that merged. */
    added?: { node: string; path: string }[];
    /** List selectors that named no item, or a node the page has not. */
    unmatched?: { node: string; path: string }[];
    /** Nodes a type was added to. */
    type_added?: string[];
    /** Hand-added values left out because their link gave nothing. */
    empty?: { path: string; item?: number; extend?: string; name: string; status: string }[];
    /** Linked text cut at 5,000 characters. */
    cut?: { path: string; item?: number; extend?: string }[];
    /** The hand-added main thing, and why it is ignored. */
    main?: { id: string; ignored: 'kind' | 'absent' | null } | null;
    /** Hand-added JSON-LD left out: the structured data would be over 256 KB. */
    over?: boolean;
    /** The structured data could not be written out: the head has no script. */
    unencodable?: boolean;
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
  /** Hand-added JSON-LD stored before a rule: the items read mode leaves out, as written. */
  refused?: { text: string; message: string; item: number; path: string } | null;
  /** A page translation: its default translation's hand-added JSON-LD, to copy. */
  source?: { langcode: string; custom: string; count: number } | null;
}

/** Why AI suggestions are off, from `capabilities.ai.reason`. */
export type AiOffReason = 'no_provider' | 'not_usable' | 'no_prompt';

export interface StatePayload {
  /** The dialog's own language. */
  ui: string;
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
  registry: Registry;
  /** The code lists of enums that have one: "country" => ISO 3166-1 codes. */
  codes?: Record<string, string[]>;
  /** The ids the module emits, by name, with what each is anchored on. */
  module_ids?: Record<string, 'home' | 'url'>;
  /** The type an added @type list must keep, by node (Values::nodeTypes()). */
  extend_types?: Record<'#primary' | '#webpage' | '#identity', string[]>;
  /** The schema.org vocabulary the site downloaded, or null. */
  vocabulary?: { release: string } | null;
  search_features: SearchFeatures;
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

/** The published places a site save changes the structured data of. */
export interface SiteEffect {
  count: number;
  /** The first 25, by name. */
  places: string[];
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
  /** Where the unsaved site settings change structured data, once asked. */
  effect: SiteEffect | null;
  save: Record<Scope, SaveStatus>;
  /** Dotted path => the server's sentence, per scope. */
  errors: Record<Scope, Record<string, string>>;
  /** Where in a hand-added text a refusal is, by the same dotted path (target and site paths never meet). */
  places?: Record<string, { item: number; path: string }>;
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
  /** The Undo of a sheet that was left, or of a change edited since: it goes. */
  | { type: 'forgetUndo'; text: string }
  | { type: 'discard' }
  /** `sent`: canon() of the site settings that were saved. */
  | { type: 'siteSaved'; payload: StatePayload; sent: string }
  | { type: 'scope'; scope: Scope }
  | { type: 'tab'; tab: Tab }
  | { type: 'save'; scope: Scope; save: SaveStatus }
  | { type: 'errors'; scope: Scope; fields: Record<string, string>; places?: Record<string, { item: number; path: string }> }
  | { type: 'live'; live: State['live'] }
  | { type: 'facts'; facts: PageFacts | null }
  | { type: 'readonly'; readonly: State['readonly'] }
  | { type: 'effect'; effect: SiteEffect | null }
  | { type: 'offer'; offer: State['offer'] }
  | { type: 'flash'; flash: string | null };

// Checks.

export interface Jump {
  scope: Scope;
  tab: Tab;
  /** The field's dotted path within its scope. */
  field: string;
  /** Inside hand-added JSON-LD or added details: the item and its value's dotted path. */
  at?: { item: number; path: string };
}

export interface Issue {
  id: string;
  severity: 'fix' | 'improve' | 'info';
  message: string;
  detail?: string;
  jump?: Jump;
  fix?:
    /** `undo`: what the bar says once it is applied, when not "Fixed". */
    | { label: string; apply(values: SeoValues): SeoValues; undo?(values: SeoValues): string }
    | { label: string; suggest: string }
    /** Leads to the field and opens its link menu. */
    | { label: string; link: true }
    /** Opens the image chooser for the image at this path. */
    | { label: string; image: string };
  /** The page may show it after all: reads the preview again. */
  recheck?: string;
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
