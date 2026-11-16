import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHost, parseRoute } from './host';

// A fake editor window around a fake dialog iframe.

type Json = Record<string, unknown>;

function editorState(over: Json = {}): Json {
  return {
    ui: {
      currentRoute: { pathname: '/editor/canvas_page/8', search: '', hash: '' },
    },
    pageDataOwner: { entityType: 'canvas_page', entityId: '8' },
    pageData: {
      present: {
        'title[0][value]': 'Pricing',
        'path[0][alias]': '/pricing',
        'path[0][pid]': '9',
        'description[0][value]': 'Plans.',
      },
    },
    publishReview: {
      clientInstanceId: 'client-1',
      autoSavesHash: {
        'canvas/api/v0/layout/canvas_page/9': {
          'canvas_page:9:en': { autoSaveStartingPoint: '9-1', hash: 'abc' },
        },
        'canvas/api/v0/layout/canvas_page/8': {
          'canvas_page:8:en': {
            autoSaveStartingPoint: '8-1784047486',
            hash: null,
          },
        },
        'canvas/api/v0/layout-content-template/node.article.full/11': {
          'content_template:node.article.full': {
            autoSaveStartingPoint: 'a23f4a14354cca47',
            hash: null,
          },
        },
      },
    },
    ...over,
  };
}

function fakeWindow(initial: Json | null = editorState()) {
  let state = initial;
  const listeners = new Set<() => void>();
  const actions: { type: string; payload: unknown }[] = [];
  const anchors: Json[] = [];
  const posted: unknown[] = [];
  const editorDocument = Object.assign(new EventTarget(), {
    body: { appendChild: vi.fn() },
    createElement: () => {
      const anchor = { click: vi.fn(), remove: vi.fn() } as Json;
      anchors.push(anchor);
      return anchor;
    },
    querySelector: (_selector: string): unknown => null,
  });
  const canvas: Json = {};
  if (state) {
    canvas.store = {
      getState: () => state,
      dispatch: (action: { type: string; payload: unknown }) =>
        actions.push(action),
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }
  const parent = {
    drupalSettings: { path: { baseUrl: '/' }, user: { uid: 1 }, canvas },
    document: editorDocument,
    location: {
      pathname: '/canvas/editor/canvas_page/8',
      href: 'https://cms.example.com/canvas/editor/canvas_page/8',
      reload: vi.fn(),
    },
    postMessage: (message: unknown) => posted.push(message),
  };
  const frame = { setAttribute: vi.fn() };
  const win = Object.assign(new EventTarget(), {
    parent,
    frameElement: frame,
    location: { origin: 'https://cms.example.com' },
  });
  return {
    win: win as unknown as Window,
    parent,
    canvas,
    frame,
    actions,
    anchors,
    posted,
    editorDocument,
    /** Replaces slices and notifies, as the editor's store does. */
    set(over: Json) {
      state = { ...state, ...over };
      listeners.forEach((listener) => listener());
    },
    notify: () => listeners.forEach((listener) => listener()),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('parseRoute()', () => {
  it.each([
    ['/editor/canvas_page/8', { kind: 'page', id: '8' }],
    [
      '/editor/canvas_page/8/component/1c2f3d4e-5a6b',
      { kind: 'page', id: '8' },
    ],
    [
      '/template/node/article/full/11',
      {
        kind: 'template',
        id: 'node.article.full',
        bundle: 'article',
        previewId: '11',
      },
    ],
    [
      '/template/node/article/full/11/component/1c2f3d4e',
      {
        kind: 'template',
        id: 'node.article.full',
        bundle: 'article',
        previewId: '11',
      },
    ],
    // A type with no content to preview: the template, without a node.
    [
      '/template/node/article/full',
      {
        kind: 'template',
        id: 'node.article.full',
        bundle: 'article',
        previewId: null,
      },
    ],
    [
      '/template/node/article/full/',
      {
        kind: 'template',
        id: 'node.article.full',
        bundle: 'article',
        previewId: null,
      },
    ],
    [
      '/template/node/article/full/component/1c2f3d4e',
      { kind: 'none', template: true },
    ],
    ['/template/node/article/teaser', { kind: 'none', template: true }],
    // Another view mode, another entity type.
    ['/template/node/article/teaser/11', { kind: 'none', template: true }],
    ['/template/taxonomy_term/tags/full/3', { kind: 'none', template: true }],
    ['/template', { kind: 'none', template: true }],
    ['/editor/node/5', { kind: 'none', template: false }],
    ['/editor/canvas_page/new', { kind: 'none', template: false }],
    ['/code-editor/component/hero', { kind: 'none', template: false }],
    ['/', { kind: 'none', template: false }],
  ])('%s', (pathname, expected) => {
    expect(parseRoute(pathname)).toEqual(expected);
  });
});

describe('context', () => {
  it('reads the store route first', () => {
    const fake = fakeWindow();
    // The store wins over the address.
    fake.parent.location.pathname = '/canvas/editor/canvas_page/99';
    expect(createHost(fake.win).context()).toEqual({ kind: 'page', id: '8' });
  });

  it('falls back to the editor address, after a base path and a language prefix', () => {
    const fake = fakeWindow(null);
    const host = createHost(fake.win);
    expect(host.ok).toBe(false);
    expect(host.context()).toEqual({ kind: 'page', id: '8' });
    fake.parent.location.pathname =
      '/sub/dir/fi/canvas/template/node/article/full/11';
    expect(host.context()).toEqual({
      kind: 'template',
      id: 'node.article.full',
      bundle: 'article',
      previewId: '11',
    });
    fake.parent.location.pathname =
      '/sub/canvas/editor/canvas_page/8/component/abc';
    expect(host.context()).toEqual({ kind: 'page', id: '8' });
    fake.parent.location.pathname = '/admin/content';
    expect(host.context()).toEqual({ kind: 'none', template: false });
  });

  it('is none when nothing can be read', () => {
    const fake = fakeWindow(null);
    (fake.parent as Json).location = undefined;
    expect(createHost(fake.win).context()).toEqual({
      kind: 'none',
      template: false,
    });
  });

  it('loading(): an entity route whose owner the editor has not set yet', () => {
    const fake = fakeWindow();
    const host = createHost(fake.win);
    expect(host.loading()).toBe(false);
    fake.set({ pageDataOwner: null });
    expect(host.loading()).toBe(true);
    // The route moved on, the owner is still the previous page.
    fake.set({
      ui: { currentRoute: { pathname: '/editor/canvas_page/9' } },
      pageDataOwner: { entityType: 'canvas_page', entityId: '8' },
    });
    expect(host.loading()).toBe(true);
    fake.set({ pageDataOwner: { entityType: 'canvas_page', entityId: '9' } });
    expect(host.loading()).toBe(false);
    // A template route never has an owner.
    fake.set({
      ui: { currentRoute: { pathname: '/template/node/article/full/11' } },
      pageDataOwner: null,
    });
    expect(host.loading()).toBe(false);
    expect(createHost(fakeWindow(null).win).loading()).toBe(false);
  });

  it('uid() and basePath()', () => {
    const fake = fakeWindow();
    const host = createHost(fake.win);
    expect(host.uid()).toBe('1');
    expect(host.basePath()).toBe('/');
    fake.parent.drupalSettings.path.baseUrl = '/sub/';
    expect(host.basePath()).toBe('/sub/');
    (fake.parent.drupalSettings as Json).user = undefined;
    expect(host.uid()).toBeNull();
  });

  it('inputs(): the three Canvas-owned values, null off a page route', () => {
    const fake = fakeWindow();
    const host = createHost(fake.win);
    expect(host.inputs()).toEqual({
      title: 'Pricing',
      description: 'Plans.',
      alias: '/pricing',
    });
    fake.set({ pageData: { present: {} } });
    expect(host.inputs()).toEqual({
      title: undefined,
      description: undefined,
      alias: undefined,
    });
    fake.set({
      ui: { currentRoute: { pathname: '/template/node/article/full/11' } },
    });
    expect(host.inputs()).toBeNull();
  });
});

describe('editorToken()', () => {
  it('picks the entry for the current layout URL and the right inner key', () => {
    const host = createHost(fakeWindow().win);
    expect(host.editorToken({ kind: 'page', id: '8' })).toEqual({
      clientInstanceId: 'client-1',
      autoSaves: {
        'canvas_page:8:en': {
          autoSaveStartingPoint: '8-1784047486',
          hash: null,
        },
      },
      langcode: 'en',
    });
    expect(host.editorToken({ kind: 'page', id: '9' })?.autoSaves).toEqual({
      'canvas_page:9:en': { autoSaveStartingPoint: '9-1', hash: 'abc' },
    });
    expect(
      host.editorToken({
        kind: 'template',
        id: 'node.article.full',
        bundle: 'article',
        previewId: '11',
      }),
    ).toEqual({
      clientInstanceId: 'client-1',
      autoSaves: {
        'content_template:node.article.full': {
          autoSaveStartingPoint: 'a23f4a14354cca47',
          hash: null,
        },
      },
      langcode: null,
    });
    // A template without a node to preview has no entry to write under.
    expect(
      host.editorToken({
        kind: 'template',
        id: 'node.article.full',
        bundle: 'article',
        previewId: null,
      }),
    ).toBeNull();
  });

  it('passes the entry through untouched', () => {
    const fake = fakeWindow();
    const entry = (
      (fake.canvas.store as { getState(): Json }).getState()
        .publishReview as Json
    ).autoSavesHash as Json;
    expect(
      createHost(fake.win).editorToken({ kind: 'page', id: '8' })!.autoSaves,
    ).toBe(entry['canvas/api/v0/layout/canvas_page/8']);
  });

  it('is null without a client id, an entry or a matching key', () => {
    const page = { kind: 'page', id: '8' } as const;
    const publishReview = (over: Json) => ({
      publishReview: { ...(editorState().publishReview as Json), ...over },
    });
    expect(
      createHost(
        fakeWindow(editorState(publishReview({ clientInstanceId: undefined })))
          .win,
      ).editorToken(page),
    ).toBeNull();
    expect(
      createHost(
        fakeWindow(editorState(publishReview({ clientInstanceId: '' }))).win,
      ).editorToken(page),
    ).toBeNull();
    expect(
      createHost(
        fakeWindow(editorState(publishReview({ autoSavesHash: {} }))).win,
      ).editorToken(page),
    ).toBeNull();
    expect(
      createHost(
        fakeWindow(
          editorState(
            publishReview({
              autoSavesHash: {
                'canvas/api/v0/layout/canvas_page/8': {
                  'canvas_page:80:en': {},
                },
              },
            }),
          ),
        ).win,
      ).editorToken(page),
    ).toBeNull();
    const host = createHost(fakeWindow().win);
    expect(host.editorToken({ kind: 'page', id: '7' })).toBeNull();
    // Another preview node is another layout request.
    expect(
      host.editorToken({
        kind: 'template',
        id: 'node.article.full',
        bundle: 'article',
        previewId: '12',
      }),
    ).toBeNull();
    expect(host.editorToken({ kind: 'none', template: false })).toBeNull();
    expect(createHost(fakeWindow(null).win).editorToken(page)).toBeNull();
  });
});

describe('setDescription()', () => {
  it('dispatches the three actions in order', () => {
    const fake = fakeWindow();
    expect(createHost(fake.win).setDescription('8', 'New text')).toBe(true);
    expect(fake.actions).toEqual([
      {
        type: 'formState/setFieldValue',
        payload: {
          formId: 'page_data_form',
          fieldName: 'description[0][value]',
          value: 'New text',
        },
      },
      { type: 'layoutModel/setUpdatePreview', payload: true },
      {
        type: 'pageData/updatePageDataExternally',
        payload: { 'description[0][value]': 'New text' },
      },
    ]);
  });

  it('refuses on an owner mismatch and without a store', () => {
    const fake = fakeWindow();
    const host = createHost(fake.win);
    expect(host.setDescription('9', 'x')).toBe(false);
    fake.set({ pageDataOwner: null });
    expect(host.setDescription('8', 'x')).toBe(false);
    expect(fake.actions).toEqual([]);
    expect(createHost(fakeWindow(null).win).setDescription('8', 'x')).toBe(
      false,
    );
  });
});

describe('subscribe()', () => {
  it('fires only when a watched slice changed by reference', () => {
    const fake = fakeWindow();
    const changes: unknown[] = [];
    const stop = createHost(fake.win).subscribe((change) =>
      changes.push(change),
    );
    const quiet = {
      context: false,
      inputs: false,
      roundTrip: false,
      conflict: false,
    };

    // The pending-changes poll: the store fires, nothing we watch changed.
    fake.notify();
    fake.set({ pendingChangesApi: { queries: {} } });
    expect(changes).toEqual([]);

    fake.set({ pageData: { present: { 'title[0][value]': 'Prices' } } });
    fake.set({
      publishReview: { clientInstanceId: 'client-1', autoSavesHash: {} },
    });
    fake.set({ pageDataOwner: null });
    fake.set({ ui: { currentRoute: { pathname: '/editor/canvas_page/9' } } });
    fake.set({ queryError: { latestError: { status: '409' } } });
    expect(changes).toEqual([
      { ...quiet, inputs: true },
      { ...quiet, roundTrip: true },
      { ...quiet, context: true },
      { ...quiet, context: true },
      { ...quiet, conflict: true },
    ]);

    stop();
    fake.set({ pageDataOwner: { entityType: 'canvas_page', entityId: '9' } });
    expect(changes).toHaveLength(5);
  });

  it('conflict(): the editor reported a 409', () => {
    const fake = fakeWindow();
    const host = createHost(fake.win);
    expect(host.conflict()).toBe(false);
    fake.set({
      queryError: {
        latestError: {
          status: '409',
          message: 'You do not have the latest changes.',
        },
      },
    });
    expect(host.conflict()).toBe(true);
    fake.set({ queryError: { latestError: { status: '500' } } });
    expect(host.conflict()).toBe(false);
  });
});

describe('a host that cannot be read', () => {
  it('gives ok: false and never throws', async () => {
    const win = Object.assign(new EventTarget(), {
      location: { origin: 'https://cms.example.com' },
    });
    Object.defineProperty(win, 'parent', {
      get() {
        throw new DOMException(
          'Blocked a frame from accessing a cross-origin frame.',
        );
      },
    });
    Object.defineProperty(win, 'frameElement', {
      get() {
        throw new DOMException('Blocked.');
      },
    });
    const host = createHost(win as unknown as Window);
    expect(host.ok).toBe(false);
    expect(host.basePath()).toBe('/');
    expect(host.uid()).toBeNull();
    expect(host.context()).toEqual({ kind: 'none', template: false });
    expect(host.loading()).toBe(false);
    expect(host.inputs()).toBeNull();
    expect(host.editorToken({ kind: 'page', id: '8' })).toBeNull();
    expect(host.setDescription('8', 'x')).toBe(false);
    expect(host.conflict()).toBe(false);
    expect(host.readFacts()).toBeNull();
    const stop = host.subscribe(() => {});
    const stopPreview = host.onPreviewChange(() => {});
    host.refreshPending();
    host.openExternal('https://example.com/');
    host.reloadEditor();
    await host.whenIdle();
    stop();
    stopPreview();
  });

  it('a store that changed shape is the same as no store for a write', () => {
    const fake = fakeWindow({ ui: {} });
    const host = createHost(fake.win);
    expect(host.ok).toBe(true);
    // The address still gives the context; nothing vouches for a write.
    expect(host.context()).toEqual({ kind: 'page', id: '8' });
    expect(host.editorToken({ kind: 'page', id: '8' })).toBeNull();
    expect(host.inputs()).toBeNull();
  });
});

describe('whenIdle() and quiet()', () => {
  it('resolves at once with an undefined or empty in-flight list', async () => {
    const fake = fakeWindow();
    const host = createHost(fake.win);
    await host.whenIdle();
    fake.canvas.canvasLayoutRequestInProgress = [];
    await host.whenIdle();
  });

  it('waits for the editor to finish', async () => {
    vi.useFakeTimers();
    const fake = fakeWindow();
    const host = createHost(fake.win);
    fake.canvas.canvasLayoutRequestInProgress = ['request'];
    let idle = false;
    void host.whenIdle().then(() => {
      idle = true;
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(idle).toBe(false);
    // The event can fire while a follow-up request has already started.
    fake.editorDocument.dispatchEvent(new Event('canvasLayoutRequestComplete'));
    await vi.advanceTimersByTimeAsync(0);
    expect(idle).toBe(false);
    fake.canvas.canvasLayoutRequestInProgress = [];
    fake.editorDocument.dispatchEvent(new Event('canvasLayoutRequestComplete'));
    await vi.advanceTimersByTimeAsync(0);
    expect(idle).toBe(true);
  });

  it('does not depend on the event', async () => {
    vi.useFakeTimers();
    const fake = fakeWindow();
    const host = createHost(fake.win);
    fake.canvas.canvasLayoutRequestInProgress = ['request'];
    let idle = false;
    void host.whenIdle().then(() => {
      idle = true;
    });
    fake.canvas.canvasLayoutRequestInProgress = [];
    await vi.advanceTimersByTimeAsync(250);
    expect(idle).toBe(true);
  });

  it('quiet(): no editor request ran for the whole time', async () => {
    vi.useFakeTimers();
    const fake = fakeWindow();
    const host = createHost(fake.win);
    let quiet = false;
    void host.quiet(250).then(() => {
      quiet = true;
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(quiet).toBe(false);
    // A request starts and ends: the clock starts again.
    fake.canvas.canvasLayoutRequestInProgress = ['request'];
    await vi.advanceTimersByTimeAsync(100);
    fake.canvas.canvasLayoutRequestInProgress = [];
    fake.editorDocument.dispatchEvent(new Event('canvasLayoutRequestComplete'));
    await vi.advanceTimersByTimeAsync(200);
    expect(quiet).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(quiet).toBe(true);
  });
});

describe('the editor document', () => {
  it('refreshPending() dispatches the invalidation', () => {
    const fake = fakeWindow();
    createHost(fake.win).refreshPending();
    expect(fake.actions).toEqual([
      {
        type: 'pendingChangesApi/invalidateTags',
        payload: [{ type: 'PendingChanges', id: 'LIST' }],
      },
    ]);
  });

  it('openExternal() opens http(s) only, with noopener noreferrer', () => {
    const fake = fakeWindow();
    const host = createHost(fake.win);
    host.openExternal('javascript:alert(1)');
    host.openExternal('data:text/html,<script>alert(1)</script>');
    host.openExternal('JaVaScRiPt:alert(1)');
    host.openExternal(' javascript:alert(1)');
    host.openExternal('vbscript:x');
    expect(fake.anchors).toEqual([]);

    host.openExternal('https://www.example.com/pricing');
    host.openExternal('/about');
    expect(fake.anchors).toHaveLength(2);
    expect(fake.anchors[0]).toMatchObject({
      href: 'https://www.example.com/pricing',
      target: '_blank',
      rel: 'noopener noreferrer',
    });
    expect(fake.anchors[1].href).toBe('https://cms.example.com/about');
    expect(fake.anchors[0].click).toHaveBeenCalledOnce();
    expect(fake.anchors[0].remove).toHaveBeenCalledOnce();
    expect(fake.editorDocument.body.appendChild).toHaveBeenCalledTimes(2);
  });

  it('reloadEditor() reloads the editor, not the iframe', () => {
    const fake = fakeWindow();
    createHost(fake.win).reloadEditor();
    expect(fake.parent.location.reload).toHaveBeenCalledOnce();
  });

  it('the frame gets its title', () => {
    const fake = fakeWindow();
    createHost(fake.win);
    expect(fake.frame.setAttribute).toHaveBeenCalledExactlyOnceWith(
      'title',
      'SEO',
    );
  });

  it('readFacts() reads the active preview document', () => {
    const fake = fakeWindow();
    const host = createHost(fake.win);
    expect(host.readFacts()).toBeNull();

    const element = (text: string, src?: string) => ({
      textContent: text,
      getAttribute: (name: string) => (name === 'src' ? (src ?? null) : null),
    });
    const images = Array.from({ length: 25 }, (_, index) =>
      element('', `/sites/default/files/photo-${index}.jpg?itok=abc`),
    );
    const selectors: string[] = [];
    fake.editorDocument.querySelector = (selector) => {
      selectors.push(selector);
      return {
        contentDocument: {
          body: { innerText: 'x'.repeat(30000) },
          // No <main>: the whole body is the page text.
          querySelector: () => null,
          querySelectorAll: (inner: string) =>
            inner === 'h1'
              ? [element('  Simple \n plans '), element('')]
              : images,
        },
      };
    };
    const facts = host.readFacts()!;
    expect(selectors).toEqual([
      'iframe[data-canvas-preview="true"][data-canvas-swap-active="true"]',
    ]);
    expect(facts.h1).toEqual(['Simple plans']);
    expect(facts.imagesWithoutAlt).toHaveLength(20);
    expect(facts.imagesWithoutAlt[0]).toBe('photo-0.jpg');
    // Every image the page shows, for the structured data's image.
    expect(facts.images).toHaveLength(25);
    expect(facts.images?.[0]).toBe('/sites/default/files/photo-0.jpg?itok=abc');
    expect(facts.text).toHaveLength(20000);
  });

  it('readFacts() takes the page text from <main> when the theme has one', () => {
    const fake = fakeWindow();
    const host = createHost(fake.win);
    fake.editorDocument.querySelector = () => ({
      contentDocument: {
        body: { innerText: 'Skip to main content\nStatus message\nPricing' },
        querySelector: (inner: string) =>
          inner === 'main' ? { innerText: 'Pricing' } : null,
        querySelectorAll: () => [],
      },
    });
    expect(host.readFacts()!.text).toBe('Pricing');
  });
});

describe('onPreviewChange()', () => {
  it('subscribes over the bridge and ignores messages from other windows', () => {
    const fake = fakeWindow();
    const host = createHost(fake.win);
    const calls = vi.fn();
    const stop = host.onPreviewChange(calls);
    expect(fake.posted).toEqual([
      { type: 'canvas:data:subscribe:previewHtml' },
    ]);

    const message = (source: unknown, type: string) =>
      Object.assign(new Event('message'), {
        source,
        data: { type, payload: '<html></html>' },
      });
    const target = fake.win as unknown as EventTarget;
    target.dispatchEvent(message({}, 'canvas:data:subscribe:previewHtml'));
    target.dispatchEvent(
      message(fake.win, 'canvas:data:subscribe:previewHtml'),
    );
    target.dispatchEvent(message(fake.parent, 'canvas:data:get:previewHtml'));
    expect(calls).not.toHaveBeenCalled();
    target.dispatchEvent(
      message(fake.parent, 'canvas:data:subscribe:previewHtml'),
    );
    expect(calls).toHaveBeenCalledOnce();

    stop();
    target.dispatchEvent(
      message(fake.parent, 'canvas:data:subscribe:previewHtml'),
    );
    expect(calls).toHaveBeenCalledOnce();
    expect(fake.posted.at(-1)).toEqual({
      type: 'canvas:data:unsubscribe:previewHtml',
    });
  });
});

describe('fitFrame()', () => {
  /**
   * The dialog as Canvas builds it: the frame in a wrapper in the scroll
   * container in the panel, 45 px below the panel's top. Canvas opened the
   * panel `opened` px from the top of the window (a fifth of the window it
   * opened in).
   */
  function dialog(innerHeight: number, opened = 180) {
    const panel = {
      style: { top: '' },
      // Canvas's drag: a translate() the rect includes.
      drag: 0,
      getBoundingClientRect: () => ({
        top: opened + panel.drag + (parseFloat(panel.style.top) || 0),
      }),
    };
    const box = { style: { maxHeight: '' }, parentElement: panel };
    const wrapper = { style: {}, parentElement: box };
    const top = Object.assign(new EventTarget(), {
      innerHeight,
      getComputedStyle: (element: unknown) => ({
        overflowY: element === box ? 'auto' : 'visible',
        maxHeight: element === panel ? `${top.innerHeight * 0.85}px` : 'none',
        paddingBottom: element === panel ? '16px' : '0px',
        top: element === panel ? panel.style.top || '0px' : 'auto',
      }),
    });
    const frame = {
      isConnected: true,
      setAttribute: vi.fn(),
      style: { height: 'calc(100vh - 300px)' },
      parentElement: wrapper,
      closest: (): unknown => panel,
      // Canvas's height for the window, unless one was set here.
      getBoundingClientRect: () => ({
        top: panel.getBoundingClientRect().top + 45,
        height: frame.style.height.endsWith('px')
          ? parseFloat(frame.style.height)
          : top.innerHeight - 300,
      }),
    };
    const win = Object.assign(new EventTarget(), {
      parent: top,
      frameElement: frame,
    }) as unknown as Window;
    return { win, top, frame, box, panel };
  }

  it('grows a short window to the space below the heading, and follows the window', () => {
    // Opened in this window: Canvas's own place stays.
    const { win, top, frame, box, panel } = dialog(350, 70);
    const undo = createHost(win).fitFrame();
    // 350 less the 115 above the frame, the dialog's 16 px padding and 16
    // px of window below it.
    expect(frame.style.height).toBe('203px');
    expect(box.style.maxHeight).toBe('203px');
    expect(panel.style.top).toBe('');
    top.innerHeight = 420;
    top.dispatchEvent(new Event('resize'));
    expect(frame.style.height).toBe('273px');
    undo();
    expect(frame.style.height).toBe('calc(100vh - 300px)');
    expect(box.style.maxHeight).toBe('');
    top.innerHeight = 350;
    top.dispatchEvent(new Event('resize'));
    expect(frame.style.height).toBe('calc(100vh - 300px)');
  });

  it('moves a dialog opened in a taller window up to where Canvas opens it in this one', () => {
    // Opened at 180 in a 900 px window, which is now 350 px tall.
    const { win, top, frame, panel } = dialog(350, 180);
    const undo = createHost(win).fitFrame();
    expect(panel.style.top).toBe('-110px');
    expect(frame.style.height).toBe(`${350 - 16 - 16 - 70 - 45}px`);
    // Taller again: back to Canvas's place.
    top.innerHeight = 1000;
    top.dispatchEvent(new Event('resize'));
    expect(panel.style.top).toBe('');
    undo();
    top.innerHeight = 350;
    top.dispatchEvent(new Event('resize'));
    expect(panel.style.top).toBe('');
  });

  it('keeps a drag of the dialog when the window resizes', () => {
    const { win, top, panel } = dialog(350, 180);
    createHost(win).fitFrame();
    expect(panel.getBoundingClientRect().top).toBe(70);
    // Dragged 100 px lower, then the window resizes without changing.
    panel.drag = 100;
    top.dispatchEvent(new Event('resize'));
    expect(panel.getBoundingClientRect().top).toBe(170);
    // A taller window: up by the window's change only.
    top.innerHeight = 400;
    top.dispatchEvent(new Event('resize'));
    expect(panel.getBoundingClientRect().top).toBe(180);
  });

  it('is undone when the frame goes away', () => {
    // Canvas closes the dialog by removing the frame: this document is
    // unloaded, React is never unmounted.
    const { win, top, frame, box, panel } = dialog(350, 180);
    createHost(win).fitFrame();
    win.dispatchEvent(new Event('pagehide'));
    expect([frame.style.height, box.style.maxHeight, panel.style.top]).toEqual(
      ['calc(100vh - 300px)', '', ''],
    );
    top.dispatchEvent(new Event('resize'));
    expect(frame.style.height).toBe('calc(100vh - 300px)');

    // Without a pagehide, the first resize after the frame is gone undoes it.
    const other = dialog(350, 180);
    createHost(other.win).fitFrame();
    other.frame.isConnected = false;
    other.top.dispatchEvent(new Event('resize'));
    expect(other.panel.style.top).toBe('');
    other.frame.isConnected = true;
    other.top.dispatchEvent(new Event('resize'));
    expect(other.frame.style.height).toBe('calc(100vh - 300px)');
  });

  it("stays within the dialog, and never below Canvas's own height", () => {
    // The dialog's own maximum, 85% of 1400 from 180, ends first.
    const { win, top, frame } = dialog(1400);
    createHost(win).fitFrame();
    expect(frame.style.height).toBe(`${180 + 1190 - 16 - 225}px`);
    // The heading lower than Canvas expects: Canvas's size stays.
    frame.getBoundingClientRect = () => ({ top: 400, height: 600 });
    top.innerHeight = 900;
    top.dispatchEvent(new Event('resize'));
    expect(frame.style.height).toBe('calc(100vh - 300px)');
  });

  it('does nothing when the editor cannot be read', () => {
    const outside = Object.assign(new EventTarget(), {
      parent: null,
      frameElement: null,
    }) as unknown as Window;
    expect(() => createHost(outside).fitFrame()()).not.toThrow();
    const { win, frame } = dialog(350);
    frame.closest = () => null;
    createHost(win).fitFrame();
    expect(frame.style.height).toBe('calc(100vh - 300px)');
  });
});
