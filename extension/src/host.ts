// The host adapter: the only file that touches the editor window around the
// dialog's iframe. Every access is inside try/catch, and an unreadable host
// means read-only, never a guessed write.

export type HostContext =
  | { kind: 'page'; id: string }
  /** Only for a node template in the `full` view mode with a preview node in the route. */
  | { kind: 'template'; id: string; bundle: string; previewId: string }
  /** `template` is true on any other template route. */
  | { kind: 'none'; template: boolean };

export interface EditorToken {
  clientInstanceId: string;
  autoSaves: Record<
    string,
    { autoSaveStartingPoint: string | number; hash: string | null }
  >;
  /** Parsed from the page's auto-save key; null for templates. */
  langcode: string | null;
}

export interface PageFacts {
  h1: string[];
  /** File names of images that have no alt attribute (an empty alt is fine), at most 20. */
  imagesWithoutAlt: string[];
  /** Visible text, capped at 20000 characters. */
  text: string;
}

export interface HostChange {
  context: boolean;
  inputs: boolean;
  roundTrip: boolean;
  conflict: boolean;
}

export interface Host {
  /** False when the editor store cannot be read. The target scope is then read-only. */
  readonly ok: boolean;
  basePath(): string;
  uid(): string | null;
  context(): HostContext;
  /** Entity route whose owner the editor has not set yet. */
  loading(): boolean;
  /** Fires only when one of the watched slices changed by reference. */
  subscribe(cb: (change: HostChange) => void): () => void;
  /** Canvas-owned live inputs; null off a page route. */
  inputs(): { title?: string; description?: string; alias?: string } | null;
  /** The three store actions, in the verified order. False when it could not be done. */
  setDescription(pageId: string, value: string): boolean;
  /** What a draft write must carry. Null means: do not write. */
  editorToken(ctx: HostContext): EditorToken | null;
  conflict(): boolean;
  whenIdle(): Promise<void>;
  quiet(ms: number): Promise<void>;
  refreshPending(): void;
  /** Reads the hydrated, same-origin preview document. Null when it cannot be read. */
  readFacts(): PageFacts | null;
  /** The supported bridge subscription, used only as a "something re-rendered" trigger. */
  onPreviewChange(cb: () => void): () => void;
  /** Opens http(s) URLs only, through an anchor in the editor document. */
  openExternal(url: string): void;
  reloadEditor(): void;
}

// The part of the editor's store this file reads. Shapes verified in the
// browser; the host-contract e2e spec fails loudly when they drift.
interface EditorState {
  ui: { currentRoute: { pathname: string } };
  pageDataOwner: { entityType: string; entityId: string } | null;
  pageData: { present: Record<string, unknown> };
  publishReview: {
    clientInstanceId?: string;
    autoSavesHash: Record<string, EditorToken['autoSaves']>;
  };
  queryError?: { latestError?: { status?: string } };
}

interface EditorStore {
  getState(): EditorState;
  dispatch(action: { type: string; payload: unknown }): unknown;
  subscribe(listener: () => void): () => void;
}

interface EditorWindow {
  drupalSettings: {
    path: { baseUrl: string };
    user: { uid: string | number };
    canvas: { store: EditorStore; canvasLayoutRequestInProgress?: unknown[] };
  };
  document: Document;
  location: Location;
  postMessage(message: unknown, targetOrigin: string): void;
}

const DESCRIPTION = 'description[0][value]';
const PREVIEW_MESSAGE = 'canvas:data:subscribe:previewHtml';

/** Routes are relative to the editor's base: "/editor/…" or "/template/…". */
export function parseRoute(pathname: string): HostContext {
  const page = pathname.match(/^\/editor\/canvas_page\/(\d+)(?:\/|$)/);
  if (page) {
    return { kind: 'page', id: page[1] };
  }
  // A fourth segment equal to "component" is not a preview id.
  const template = pathname.match(
    /^\/template\/([^/]+)\/([^/]+)\/([^/]+)(?:\/(?!component(?:\/|$))([^/]+))?/,
  );
  if (!template) {
    return { kind: 'none', template: /^\/template(?:\/|$)/.test(pathname) };
  }
  const [, entityType, bundle, viewMode, previewId] = template;
  return entityType === 'node' && viewMode === 'full' && previewId
    ? { kind: 'template', id: `node.${bundle}.full`, bundle, previewId }
    : { kind: 'none', template: true };
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createHost(win: Window = window): Host {
  const editor = () => win.parent as unknown as EditorWindow;
  const store = (): EditorStore | null => {
    try {
      const found = editor().drupalSettings.canvas.store;
      return typeof found?.getState === 'function' ? found : null;
    } catch {
      return null;
    }
  };
  /** Runs a read against the editor; any failure gives the fallback. */
  function read<T>(fn: (state: EditorState) => T, fallback: T): T {
    try {
      return fn(store()!.getState());
    } catch {
      return fallback;
    }
  }
  const inFlight = () => {
    try {
      return (
        editor().drupalSettings.canvas.canvasLayoutRequestInProgress ?? []
      ).length;
    } catch {
      return 0;
    }
  };

  try {
    // The host renders the iframe without a title.
    win.frameElement?.setAttribute('title', 'SEO');
  } catch {
    // Not in the editor.
  }

  const host: Host = {
    get ok() {
      return store() !== null;
    },

    basePath() {
      try {
        return editor().drupalSettings.path.baseUrl || '/';
      } catch {
        return '/';
      }
    },

    uid() {
      try {
        const uid = editor().drupalSettings.user.uid;
        return uid === undefined || uid === null ? null : String(uid);
      } catch {
        return null;
      }
    },

    context() {
      const route = read<string | null>(
        (state) => state.ui.currentRoute.pathname,
        null,
      );
      if (typeof route === 'string') {
        return parseRoute(route);
      }
      try {
        // Without the store: the editor's address, after any base path and
        // language prefix.
        const match = editor().location.pathname.match(
          /\/canvas(\/(?:editor|template)(?:\/.*)?)$/,
        );
        return match ? parseRoute(match[1]) : { kind: 'none', template: false };
      } catch {
        return { kind: 'none', template: false };
      }
    },

    loading() {
      const ctx = host.context();
      return read((state) => {
        const owner = state.pageDataOwner;
        return (
          ctx.kind === 'page' &&
          !(owner?.entityType === 'canvas_page' && owner.entityId === ctx.id)
        );
      }, false);
    },

    subscribe(cb) {
      try {
        const editorStore = store()!;
        let last = editorStore.getState();
        return editorStore.subscribe(() => {
          try {
            const now = editorStore.getState();
            const change: HostChange = {
              context:
                now.ui.currentRoute !== last.ui.currentRoute ||
                now.pageDataOwner !== last.pageDataOwner,
              inputs: now.pageData.present !== last.pageData.present,
              roundTrip:
                now.publishReview.autoSavesHash !==
                last.publishReview.autoSavesHash,
              conflict:
                now.queryError?.latestError !== last.queryError?.latestError,
            };
            last = now;
            // The store also fires for polls that change none of these.
            if (Object.values(change).some(Boolean)) {
              cb(change);
            }
          } catch {
            // A store that changed shape: stay silent.
          }
        });
      } catch {
        return () => {};
      }
    },

    inputs() {
      if (host.context().kind !== 'page') {
        return null;
      }
      return read((state) => {
        const present = state.pageData.present;
        const text = (key: string) =>
          typeof present[key] === 'string'
            ? (present[key] as string)
            : undefined;
        return {
          title: text('title[0][value]'),
          description: text(DESCRIPTION),
          alias: text('path[0][alias]'),
        };
      }, null);
    },

    setDescription(pageId, value) {
      try {
        const editorStore = store()!;
        const owner = editorStore.getState().pageDataOwner;
        if (owner?.entityType !== 'canvas_page' || owner.entityId !== pageId) {
          return false;
        }
        // All three, every time: without the second one a fresh editor shows
        // the value and sends no request.
        editorStore.dispatch({
          type: 'formState/setFieldValue',
          payload: { formId: 'page_data_form', fieldName: DESCRIPTION, value },
        });
        editorStore.dispatch({
          type: 'layoutModel/setUpdatePreview',
          payload: true,
        });
        editorStore.dispatch({
          type: 'pageData/updatePageDataExternally',
          payload: { [DESCRIPTION]: value },
        });
        return true;
      } catch {
        return false;
      }
    },

    editorToken(ctx) {
      if (ctx.kind === 'none') {
        return null;
      }
      return read((state) => {
        const clientInstanceId = state.publishReview.clientInstanceId;
        // The map holds one entry per page visited: pick this target's.
        const autoSaves =
          state.publishReview.autoSavesHash[
            ctx.kind === 'page'
              ? `canvas/api/v0/layout/canvas_page/${ctx.id}`
              : `canvas/api/v0/layout-content-template/${ctx.id}/${ctx.previewId}`
          ];
        const key = Object.keys(autoSaves ?? {}).find((name) =>
          ctx.kind === 'page'
            ? name.startsWith(`canvas_page:${ctx.id}:`)
            : name === `content_template:${ctx.id}`,
        );
        if (typeof clientInstanceId !== 'string' || !clientInstanceId || !key) {
          return null;
        }
        return {
          clientInstanceId,
          autoSaves,
          langcode: ctx.kind === 'page' ? key.split(':')[2] : null,
        };
      }, null);
    },

    conflict() {
      return read(
        (state) => state.queryError?.latestError?.status === '409',
        false,
      );
    },

    async whenIdle() {
      while (inFlight() > 0) {
        let done = () => {};
        const complete = new Promise<void>((resolve) => {
          done = resolve;
        });
        try {
          editor().document.addEventListener(
            'canvasLayoutRequestComplete',
            done,
            { once: true },
          );
        } catch {
          // The poll below still ends the wait.
        }
        // The event can be missed; the count is the truth.
        await Promise.race([complete, sleep(250)]);
        try {
          editor().document.removeEventListener(
            'canvasLayoutRequestComplete',
            done,
          );
        } catch {
          // Nothing to remove.
        }
      }
    },

    async quiet(ms) {
      let since = Date.now();
      while (Date.now() - since < ms) {
        if (inFlight() > 0) {
          await host.whenIdle();
          since = Date.now();
        }
        await sleep(20);
      }
    },

    refreshPending() {
      try {
        store()!.dispatch({
          type: 'pendingChangesApi/invalidateTags',
          payload: [{ type: 'PendingChanges', id: 'LIST' }],
        });
      } catch {
        // The editor's own poll catches up within ten seconds.
      }
    },

    readFacts() {
      try {
        const frame = editor().document.querySelector<HTMLIFrameElement>(
          'iframe[data-canvas-preview="true"][data-canvas-swap-active="true"]',
        );
        const doc = frame?.contentDocument;
        if (!doc?.body) {
          return null;
        }
        // The page's own text: the theme's skip link and status messages
        // around <main> are not part of it.
        const content = doc.querySelector<HTMLElement>('main') ?? doc.body;
        return {
          h1: Array.from(doc.querySelectorAll('h1'), (heading) =>
            (heading.textContent ?? '').replace(/\s+/g, ' ').trim(),
          ).filter(Boolean),
          imagesWithoutAlt: Array.from(doc.querySelectorAll('img:not([alt])'))
            .slice(0, 20)
            .map((image) => {
              const src = (image.getAttribute('src') ?? '').split(/[?#]/)[0];
              return src.slice(src.lastIndexOf('/') + 1) || 'image';
            }),
          text: (content.innerText ?? content.textContent ?? '').slice(
            0,
            20000,
          ),
        };
      } catch {
        return null;
      }
    },

    onPreviewChange(cb) {
      const listener = (event: MessageEvent) => {
        try {
          // Bridge messages are accepted from the editor window only.
          if (
            event.source === win.parent &&
            event.data?.type === PREVIEW_MESSAGE
          ) {
            cb();
          }
        } catch {
          // Not ours.
        }
      };
      const post = (type: string) => {
        try {
          editor().postMessage({ type }, win.location.origin);
        } catch {
          // No bridge: content checks read once and are not refreshed.
        }
      };
      win.addEventListener('message', listener);
      post(PREVIEW_MESSAGE);
      return () => {
        win.removeEventListener('message', listener);
        post('canvas:data:unsubscribe:previewHtml');
      };
    },

    openExternal(url) {
      try {
        // The iframe is same-origin with the editor: a script URL opened
        // here would run in the editor.
        const target = new URL(url, editor().location.href);
        if (target.protocol !== 'http:' && target.protocol !== 'https:') {
          return;
        }
        const anchor = editor().document.createElement('a');
        anchor.href = target.href;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        editor().document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } catch {
        // Not an address, or no editor document.
      }
    },

    reloadEditor() {
      try {
        editor().location.reload();
      } catch {
        // Nothing to reload.
      }
    },
  };
  return host;
}
