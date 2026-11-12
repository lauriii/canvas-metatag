import {
  ExclamationTriangleIcon,
  LockClosedIcon,
} from '@radix-ui/react-icons';
import { Tabs } from '@radix-ui/themes';
import {
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

import { type Api, ApiError, createApi } from './api';
import { checks } from './checks';
import { CHECKS_NOTE, ChecksSheet } from './components/ChecksSheet';
import { Header, Sheet } from './components/Header';
import { type ImageRequest, ImageSheet } from './components/MediaPicker';
import { OutputSheet, originNote } from './components/Output';
import { SearchSkeleton } from './components/Previews';
import { CustomJson, SchemaTab } from './components/SchemaTab';
import { SearchTab } from './components/SearchTab';
import { SiteView } from './components/SiteTab';
import { SocialTab } from './components/SocialTab';
import { Btn, InfoTip, Notice, reveal } from './components/ui';
import { type Host, type HostContext, createHost } from './host';
import {
  type DraftIO,
  type Footer,
  type FooterAction,
  MESSAGES,
  REGISTRY,
  type Strip,
  type View,
  applyChanges,
  canon,
  draftPayload,
  footer,
  initialState,
  openPending,
  pendingFor,
  pendingKey,
  prune,
  readPending,
  reducer,
  saveDraft,
  sitePaths,
  strips,
  tabOf,
  unsent,
  view,
} from './model';
import type {
  Action,
  Issue,
  Jump,
  Measurer,
  Pending,
  Scope,
  State,
  StatePayload,
  Texts,
} from './types';

/** A full-frame tool over the view. */
export type SheetState =
  | { kind: 'checks' }
  | { kind: 'output'; section?: 'schema' }
  | { kind: 'custom' }
  | { kind: 'image'; request: ImageRequest };

// What components get. One context, read with useApp().

export interface AppContext {
  state: State;
  /** Every change goes through here; `{ type: 'edit', scope, path, value }` is typing. */
  dispatch(action: Action): void;
  host: Host;
  api: Api;
  /** The target scope's derived values. Null until the first state. */
  view: View | null;
  /** The Checks rules for the target; empty at Site scope. */
  issues: Issue[];
  /** For meter() and previewText(); null when text cannot be measured. */
  measurer: Measurer;
  /** A scope whose controls are disabled: values stay readable. */
  locked: Record<Scope, boolean>;
  /** The last jump: fields compare `field` and `seq` to take focus. */
  jump: (Jump & { seq: number; suggest: boolean }) | null;
  /**
   * Closes any sheet, switches scope and tab, then names the field.
   * `suggest`: open its suggestions.
   */
  goTo(jump: Jump, how?: { suggest?: boolean }): void;
  /** The texts a suggestion is trying out: the previews show them. */
  trial: (Texts & { index?: number }) | null;
  setTrial(trial: (Texts & { index?: number }) | null): void;
  /** Canvas's own Description is the field's while it has focus: previews follow `text`. */
  holdDescription(text: string): void;
  /** Hands the Description to Canvas, once. False when the editor did not take it. */
  commitDescription(text: string): boolean;
  /** The sheet over the view, if any. */
  sheet: SheetState | null;
  /** Opens a sheet; closing it returns focus to what had it. */
  openSheet(sheet: SheetState): void;
  /** `restore`: focus goes back to the opener. */
  closeSheet(restore?: boolean): void;
  /** The path of the field that has focus: its part of the preview lights up. */
  focusField: string | null;
  setFocusField: Dispatch<SetStateAction<string | null>>;
  /** The preview of the shown view is in sight. */
  stageVisible: boolean;
  setStageVisible(visible: boolean): void;
}

const Context = createContext<AppContext | null>(null);

export function useApp(): AppContext {
  const app = useContext(Context);
  if (!app) {
    throw new Error('useApp() needs <App>.');
  }
  return app;
}

const TARGET_TABS = ['search', 'social', 'schema'];

// Outside React.

const storage = {
  get(key: string): Pending | null {
    try {
      return readPending(sessionStorage.getItem(key));
    } catch {
      return null;
    }
  },
  set(key: string, entry: Pending | null) {
    try {
      if (entry) {
        sessionStorage.setItem(key, JSON.stringify(entry));
      } else {
        sessionStorage.removeItem(key);
      }
    } catch {
      // No storage: a change closed mid-save is not brought back.
    }
  },
};

function createMeasurer(): Measurer {
  try {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) {
      return null;
    }
    const cache = new Map<string, number>();
    return (text, font) => {
      const key = `${font}\n${text}`;
      let width = cache.get(key);
      if (width === undefined) {
        context.font = font;
        width = context.measureText(text).width;
        if (cache.size > 2000) {
          cache.clear();
        }
        cache.set(key, width);
      }
      return width;
    };
  } catch {
    return null;
  }
}

const keyOf = (ctx: HostContext) =>
  ctx.kind === 'page'
    ? `page:${ctx.id}`
    : ctx.kind === 'template'
      ? `template:${ctx.id}:${ctx.previewId}`
      : `none:${ctx.template}`;

const CHANGES = ['edit', 'reset', 'apply', 'undo', 'discard'];

export default function App() {
  const [host] = useState(() => createHost());
  const [api] = useState(() => createApi(host.basePath()));
  const [measurer] = useState(createMeasurer);
  const [state, rawDispatch] = useReducer(reducer, undefined, () =>
    initialState(host.context()),
  );
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [jump, setJump] = useState<AppContext['jump']>(null);
  const [trial, setTrial] = useState<AppContext['trial']>(null);
  const [focusField, setFocusField] = useState<string | null>(null);
  const [stageVisible, setStageVisible] = useState(true);

  // The same reducer runs here first, so async code always reads the state
  // its own dispatches produced, and the session-storage mirror is written
  // in the same task as the keystroke.
  const now = useRef(state);
  const dispatch = useCallback(
    (action: Action) => {
      const before = now.current;
      const after = (now.current = reducer(before, action));
      if (CHANGES.includes(action.type) && after.server) {
        for (const scope of ['target', 'site'] as const) {
          const target = after.server.target;
          if (
            after.edits[scope] === before.edits[scope] ||
            (scope === 'target' && !target)
          ) {
            continue;
          }
          const key = pendingKey(
            scope === 'site' ? 'site' : target!.auto_save_key,
          );
          storage.set(
            key,
            pendingFor(
              // An entry that is on offer is not continued.
              after.offer?.scope === scope ? null : storage.get(key),
              host.uid(),
              scope === 'site' ? after.server.site : target!.values,
              after.edits[scope],
            ),
          );
        }
      }
      rawDispatch(action);
    },
    [host],
  );

  // Effects' own bookkeeping.
  const loaded = useRef<string | null>(null);
  const shown = useRef<string | null>(null);
  const first = useRef(true);
  const saving = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const held = useRef<string | null>(null);

  /** Why the target may not be written, as far as the editor and the server tell. */
  const access = useCallback(
    (ctx: HostContext, payload: StatePayload): State['readonly'] => {
      if (!payload.target || ctx.kind === 'none') {
        return 'no';
      }
      if (!payload.can.target) {
        return 'access';
      }
      if (host.conflict()) {
        return 'conflict';
      }
      const token = host.editorToken(ctx);
      return token &&
        Object.hasOwn(token.autoSaves, payload.target.auto_save_key) &&
        (ctx.kind !== 'page' || token.langcode === payload.langcode)
        ? 'no'
        : 'store';
    },
    [host],
  );

  /** The rule for a change found in session storage on open. */
  const reopen = useCallback(
    (scope: Scope, payload: StatePayload) => {
      if (scope === 'target' && !payload.target) {
        return;
      }
      const key = pendingKey(
        scope === 'site' ? 'site' : payload.target!.auto_save_key,
      );
      const entry = storage.get(key);
      if (!entry) {
        return;
      }
      const server = scope === 'site' ? payload.site : payload.target!.values;
      const rule = openPending(entry, host.uid(), server);
      const writable =
        scope === 'site' ? payload.can.site : now.current.readonly === 'no';
      if (rule === 'drop') {
        storage.set(key, null);
      } else if (rule === 'restore' && writable) {
        dispatch({
          type: 'apply',
          scope,
          values: applyChanges(server, entry.changes),
          undo: MESSAGES.restored,
        });
      } else if (rule === 'offer' && writable && !now.current.offer) {
        // ponytail: one offer at a time. A second one (target and site both
        // left behind) stays in storage and is looked at on the next open.
        dispatch({ type: 'offer', offer: { scope, pending: entry } });
      }
    },
    [dispatch, host],
  );

  const load = useCallback(
    async (ctx: HostContext) => {
      const key = keyOf(ctx);
      try {
        const payload = await api.getState(
          ctx,
          host.editorToken(ctx)?.langcode,
        );
        if (loaded.current !== key) {
          return;
        }
        const label = payload.target
          ? payload.target.scope === 'page'
            ? payload.target.label
            : `Every ${payload.target.label}`
          : null;
        dispatch({
          type: 'loaded',
          ctx,
          payload,
          readonly: access(ctx, payload),
          flash: !first.current && label ? `Now editing ${label}` : undefined,
        });
        dispatch({ type: 'live', live: host.inputs() ?? {} });
        dispatch({ type: 'facts', facts: host.readFacts() });
        if (payload.can.target || payload.can.site) {
          // A write sent while the iframe is being removed cannot wait for a token.
          api.prime();
        }
        reopen('target', payload);
        if (first.current) {
          reopen('site', payload);
        }
        first.current = false;
      } catch (error) {
        if (loaded.current === key) {
          dispatch({
            type: 'failed',
            phase:
              error instanceof ApiError && error.code === 'forbidden'
                ? 'forbidden'
                : 'error',
          });
        }
      }
    },
    [access, api, dispatch, host, reopen],
  );

  /** One write for the target being left, without verification. */
  const flush = useCallback(() => {
    clearTimeout(saveTimer.current);
    const { ctx, server, edits, errors, readonly, phase } = now.current;
    if (
      phase !== 'ready' ||
      ctx.kind === 'none' ||
      !server?.target ||
      readonly !== 'no' ||
      !unsent(now.current)
    ) {
      return;
    }
    const token = host.editorToken(ctx);
    if (token) {
      api
        .putDraft(
          ctx,
          draftPayload(
            prune(edits.target),
            server.target.values,
            Object.keys(errors.target),
          ),
          server.langcode,
          token,
          // The iframe may be gone before the answer.
          true,
        )
        // The change is still in session storage.
        .catch(() => {});
    }
  }, [api, host]);

  /** Follows the editor: a new route is a new context, once its owner is set. */
  const follow = useCallback(() => {
    const ctx = host.context();
    const key = keyOf(ctx);
    if (key === loaded.current) {
      return;
    }
    if (key !== shown.current) {
      flush();
      shown.current = key;
      loaded.current = null;
      setSheet(null);
      dispatch({ type: 'loading', ctx });
    }
    // An entity route without an owner yet is loading, never "no page".
    if (!host.loading()) {
      loaded.current = key;
      void load(ctx);
    }
  }, [dispatch, flush, host, load]);

  const save = useCallback(async () => {
    clearTimeout(saveTimer.current);
    const { ctx, server, phase, readonly } = now.current;
    const waiting = now.current.save.target.phase;
    if (
      saving.current ||
      phase !== 'ready' ||
      ctx.kind === 'none' ||
      !server?.target ||
      (waiting !== 'pending' && waiting !== 'error')
    ) {
      return;
    }
    const status = (save: State['save']['target']) =>
      dispatch({ type: 'save', scope: 'target', save });
    if (readonly !== 'no') {
      status({ phase: 'idle' });
      return;
    }
    const key = keyOf(ctx);
    const { langcode } = server;
    const current = () =>
      loaded.current === key && now.current.phase === 'ready';
    const io: DraftIO = {
      edits: () => now.current.edits.target,
      server: () => now.current.server?.target?.values ?? {},
      refused: () => Object.keys(now.current.errors.target),
      whenIdle: host.whenIdle,
      // The editor moving on, or a conflict, ends the write.
      token: () =>
        current() && now.current.readonly === 'no'
          ? host.editorToken(ctx)
          : null,
      put: (values, token) => api.putDraft(ctx, values, langcode, token),
      quiet: host.quiet,
      getState: () => api.getState(ctx, langcode),
      refuse: (fields) =>
        current() && dispatch({ type: 'errors', scope: 'target', fields }),
      confirmed(payload, sent) {
        if (!current() || !payload.target) {
          return;
        }
        dispatch({ type: 'confirmed', payload, sent });
        host.refreshPending();
        const { edits, errors } = now.current;
        storage.set(
          pendingKey(payload.target.auto_save_key),
          pendingFor(
            null,
            host.uid(),
            payload.target.values,
            edits.target,
            // Nothing newer: only refused text exists nowhere else.
            canon(edits.target) === sent
              ? Object.keys(errors.target)
              : undefined,
          ),
        );
      },
    };
    saving.current = true;
    status({ phase: 'saving' });
    const started = now.current.edits.target;
    const result = await saveDraft(io);
    saving.current = false;
    if (!current()) {
      // The editor moved on meanwhile; a change made there may be waiting.
      void save();
      return;
    }
    if (
      result !== 'done' &&
      result !== 'readonly' &&
      (typeof result === 'string' || result.code !== 'conflict') &&
      now.current.edits.target !== started &&
      unsent(now.current)
    ) {
      // An edit made during the call started no timer of its own: send it.
      status({ phase: 'pending' });
    } else if (result === 'done') {
      status({ phase: 'saved' });
    } else if (result === 'readonly') {
      status({ phase: 'idle' });
      if (now.current.readonly === 'no') {
        dispatch({ type: 'readonly', readonly: 'store' });
      }
    } else if (result === 'failed') {
      status({ phase: 'error', message: MESSAGES.unstored });
    } else if (result.code === 'conflict') {
      status({ phase: 'idle' });
      dispatch({ type: 'readonly', readonly: 'conflict' });
    } else if (result.code === 'invalid') {
      // Refused again for the same fields: nothing of this write was
      // stored. The fields carry the sentences; the footer says so.
      status({ phase: 'error', message: MESSAGES.unstored });
    } else {
      status({
        phase: 'error',
        message:
          result.code === 'forbidden' ? MESSAGES.signedOut : MESSAGES.failed,
      });
    }
  }, [api, dispatch, host]);

  const saveSite = useCallback(async () => {
    const { server, edits, siteDirty, ctx } = now.current;
    if (
      !server?.can.site ||
      !siteDirty ||
      now.current.save.site.phase === 'saving'
    ) {
      return;
    }
    const status = (save: State['save']['site']) =>
      dispatch({ type: 'save', scope: 'site', save });
    status({ phase: 'saving' });
    try {
      await api.putSite({
        identity: edits.site.identity,
        values: prune(edits.site.values),
      });
      const payload = await api.getState(ctx, server.langcode);
      storage.set(pendingKey('site'), null);
      dispatch({ type: 'siteSaved', payload, sent: canon(edits.site) });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'invalid') {
        dispatch({
          type: 'errors',
          scope: 'site',
          fields: sitePaths(error.fields),
        });
        status({ phase: 'idle' });
      } else {
        status({
          phase: 'error',
          message:
            error instanceof ApiError && error.code === 'forbidden'
              ? MESSAGES.signedOut
              : MESSAGES.failed,
        });
      }
    }
  }, [api, dispatch]);

  // The editor's signals.
  useEffect(() => {
    let refetchTimer: ReturnType<typeof setTimeout>;
    let factsTimer: ReturnType<typeof setTimeout>;
    const refetch = () => {
      clearTimeout(refetchTimer);
      refetchTimer = setTimeout(async () => {
        const { ctx, phase } = now.current;
        const key = loaded.current;
        if (phase !== 'ready' || key !== keyOf(ctx)) {
          return;
        }
        // Not while a write is in progress: its own read-back is newer.
        if (saving.current) {
          refetch();
          return;
        }
        try {
          const payload = await api.getState(
            ctx,
            host.editorToken(ctx)?.langcode ?? now.current.server?.langcode,
          );
          if (loaded.current === key && !saving.current) {
            dispatch({
              type: 'refreshed',
              payload,
              readonly: access(ctx, payload),
            });
          }
        } catch {
          // The next round trip tries again.
        }
      }, 300);
    };
    const stopStore = host.subscribe((change) => {
      if (change.context) {
        follow();
      }
      if (change.inputs) {
        dispatch({
          type: 'live',
          live: {
            ...host.inputs(),
            // While the Description has focus its text is the field's own.
            ...(held.current === null ? {} : { description: held.current }),
          },
        });
      }
      if (change.roundTrip) {
        refetch();
      }
      if (change.conflict && host.conflict()) {
        dispatch({ type: 'readonly', readonly: 'conflict' });
      }
    });
    const stopPreview = host.onPreviewChange(() => {
      clearTimeout(factsTimer);
      factsTimer = setTimeout(
        () => dispatch({ type: 'facts', facts: host.readFacts() }),
        500,
      );
    });
    follow();
    return () => {
      stopStore();
      stopPreview();
      clearTimeout(refetchTimer);
      clearTimeout(factsTimer);
    };
  }, [access, api, dispatch, follow, host]);

  // An edit starts the timer. A difference alone never does.
  useEffect(() => {
    if (state.save.target.phase !== 'pending') {
      return;
    }
    saveTimer.current = setTimeout(save, 400);
    return () => clearTimeout(saveTimer.current);
  }, [save, state.edits.target, state.save.target.phase]);

  // Losing focus, or the iframe, sends a waiting change at once.
  useEffect(() => {
    const leave = () => void save();
    const hide = () => {
      const { ctx } = now.current;
      if (held.current !== null && ctx.kind === 'page') {
        host.setDescription(ctx.id, held.current);
        held.current = null;
      }
      // A write in progress makes save() wait; the frame cannot. What was
      // typed meanwhile goes out once, as it is.
      if (saving.current) {
        flush();
      } else {
        void save();
      }
    };
    window.addEventListener('blur', leave);
    window.addEventListener('pagehide', hide);
    return () => {
      window.removeEventListener('blur', leave);
      window.removeEventListener('pagehide', hide);
    };
  }, [flush, host, save]);

  // The only timed text is informational.
  const { flash } = state;
  const saved = (['target', 'site'] as const).filter(
    (scope) => state.save[scope].phase === 'saved',
  );
  const savedKey = saved.join();
  useEffect(() => {
    if (!savedKey) {
      return;
    }
    const timer = setTimeout(() => {
      for (const scope of savedKey.split(',') as Scope[]) {
        if (now.current.save[scope].phase === 'saved') {
          dispatch({ type: 'save', scope, save: { phase: 'idle' } });
        }
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [dispatch, savedKey]);
  useEffect(() => {
    if (!flash) {
      return;
    }
    const timer = setTimeout(
      () => dispatch({ type: 'flash', flash: null }),
      4000,
    );
    return () => clearTimeout(timer);
  }, [dispatch, flash]);

  // Derived, never stored.
  const shownView = useMemo(
    () => view(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.server, state.edits.target, state.live, state.sent],
  );
  const issues = useMemo(() => {
    const server = state.server;
    if (!server?.target || !shownView) {
      return [];
    }
    return checks({
      effective: shownView.effective,
      sources: shownView.source,
      texts: shownView.texts,
      tokens: shownView.tokens,
      resolved: server.resolved,
      site: server.site,
      registry: REGISTRY,
      facts: state.facts,
      scope: server.target.scope,
      can: server.can,
      langcode: server.langcode,
      ai: server.capabilities.ai?.available === true,
      published: server.target.published,
      typeLabel: server.target.label,
      previewLabel: server.preview?.label ?? server.target.label,
      defaultLanguage:
        server.languages[server.target.default_langcode ?? ''] ??
        'default-language',
      measurer,
    });
  }, [measurer, shownView, state.facts, state.server]);

  const app = useMemo<AppContext>(
    () => ({
      state,
      dispatch,
      host,
      api,
      view: shownView,
      issues,
      measurer,
      locked: {
        target: state.readonly !== 'no',
        site: !state.server?.can.site,
      },
      jump,
      goTo(to, how = {}) {
        setSheet(null);
        dispatch({ type: 'scope', scope: to.scope });
        if (to.tab === 'checks') {
          setSheet({ kind: 'checks' });
          return;
        }
        dispatch({ type: 'tab', tab: to.tab });
        if (to.field === 'schema.custom') {
          setSheet({ kind: 'custom' });
          return;
        }
        setJump((last) => ({
          ...to,
          suggest: how.suggest ?? false,
          seq: (last?.seq ?? 0) + 1,
        }));
      },
      trial,
      setTrial,
      holdDescription(text) {
        held.current = text;
        dispatch({
          type: 'live',
          live: { ...now.current.live, description: text },
        });
      },
      commitDescription(text) {
        held.current = null;
        const { ctx, readonly } = now.current;
        const taken =
          ctx.kind === 'page' &&
          readonly === 'no' &&
          (text === (host.inputs()?.description ?? '') ||
            host.setDescription(ctx.id, text));
        dispatch({
          type: 'live',
          live: taken
            ? { ...now.current.live, description: text }
            : (host.inputs() ?? {}),
        });
        return taken;
      },
      sheet,
      openSheet(next) {
        opener.current = document.activeElement as HTMLElement | null;
        setSheet(next);
      },
      closeSheet(restore = true) {
        // Committed now, so the view is no longer inert and focus never
        // rests on the document between frames.
        flushSync(() => setSheet(null));
        if (restore) {
          // Back to what opened it, else to the scope.
          (opener.current?.isConnected
            ? opener.current
            : document.querySelector<HTMLElement>('.seo-scope')
          )?.focus();
        }
      },
      focusField,
      setFocusField,
      stageVisible,
      setStageVisible,
    }),
    [
      api,
      dispatch,
      focusField,
      host,
      issues,
      jump,
      measurer,
      sheet,
      shownView,
      stageVisible,
      state,
      trial,
    ],
  );

  const act: Act = (action) => {
    const { scope, errors, offer, edits, server } = now.current;
    if (action === 'undo') {
      dispatch({ type: 'undo' });
    } else if (action === 'goto') {
      const field = Object.keys(errors[scope])[0];
      if (field) {
        app.goTo({ scope, tab: tabOf(scope, field), field });
      }
    } else if (action === 'retry') {
      void (scope === 'site' ? saveSite() : save());
    } else if (action === 'discard') {
      dispatch({ type: 'discard' });
    } else if (action === 'save' || action === 'hide') {
      void saveSite();
    } else if (action === 'reload') {
      host.reloadEditor();
    } else if (action === 'show') {
      // Equal to what the page inherits again, so nothing is stored.
      dispatch({
        type: 'edit',
        scope: 'target',
        path: 'robots.noindex',
        value: false,
      });
    } else if (offer) {
      // "Discard" forgets the offered change. "Use it" applies its paths on
      // top of today's values, as an ordinary edit with an entry of its own.
      storage.set(
        pendingKey(
          offer.scope === 'site'
            ? 'site'
            : (server?.target?.auto_save_key ?? ''),
        ),
        null,
      );
      dispatch({ type: 'offer', offer: null });
      if (action === 'use') {
        dispatch({
          type: 'apply',
          scope: offer.scope,
          values: applyChanges(edits[offer.scope], offer.pending.changes),
        });
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const { scope, siteDirty } = now.current;
    if (
      event.key === 'Enter' &&
      (event.ctrlKey || event.metaKey) &&
      scope === 'site' &&
      siteDirty &&
      // Hiding the whole site takes the named button.
      !footer(now.current).actions.includes('hide')
    ) {
      void saveSite();
    }
  };

  return (
    <Context.Provider value={app}>
      <main className="seo-app" onKeyDown={onKeyDown}>
        <h1 className="seo-visually-hidden">SEO</h1>
        {state.phase === 'loading' && !state.server && (
          <div className="seo-frame seo-loading">
            <header className="seo-header">
              <span className="seo-scope" data-static="">
                {state.ctx.kind === 'page'
                  ? 'This page'
                  : state.ctx.kind === 'none'
                    ? 'Site settings'
                    : 'Template'}
              </span>
            </header>
            <div className="seo-body">
              <Loading
                inputs={state.ctx.kind === 'page' ? host.inputs() : null}
              />
            </div>
          </div>
        )}
        {state.phase === 'forbidden' && (
          <div className="seo-center">
            <LockClosedIcon aria-hidden />
            <h2>SEO is not available</h2>
            <p>You don't have permission to edit SEO settings.</p>
          </div>
        )}
        {state.phase === 'error' && (
          <div className="seo-center">
            <ExclamationTriangleIcon aria-hidden />
            <h2>SEO settings couldn't load</h2>
            <Btn
              onClick={() => {
                shown.current = null;
                loaded.current = null;
                follow();
              }}
            >
              Try again
            </Btn>
          </div>
        )}
        {(state.phase === 'ready' || state.phase === 'loading') &&
          state.server && (
            // One element in both phases: when the editor moves on, the
            // frame stays, and so do focus and the live region. Only the
            // body waits.
            <Ready
              strips={
                state.phase === 'ready'
                  ? strips(
                      state,
                      shownView,
                      state.ctx.kind === 'page' &&
                        (host.editorToken(state.ctx)?.langcode ??
                          state.server.langcode) !== state.server.langcode,
                    )
                  : []
              }
              act={act}
              loading={
                state.phase === 'loading' ? (
                  <Loading
                    origin={state.server.origin.url}
                    inputs={state.ctx.kind === 'page' ? host.inputs() : null}
                  />
                ) : null
              }
            />
          )}
      </main>
    </Context.Provider>
  );
}

// Whole-app states.

function Loading(props: {
  origin?: string;
  inputs: { description?: string; alias?: string } | null;
}) {
  let host = '';
  try {
    // Before the first answer, the address the editor itself is open at.
    host = new URL(props.origin ?? location.href).host;
  } catch {
    // No address: the line stays empty.
  }
  return (
    <div className="seo-loading">
      <SearchSkeleton
        host={host}
        alias={props.inputs?.alias}
        description={props.inputs?.description}
      />
    </div>
  );
}

// The frame: header, one body, the bar when a button is needed, sheets over it.

const BUTTONS: Record<
  Exclude<FooterAction, 'output'> | Strip['actions'][number],
  {
    label: string;
    variant: 'ghost' | 'soft' | 'solid' | 'danger' | 'outline';
    accent?: boolean;
  }
> = {
  undo: { label: 'Undo', variant: 'ghost', accent: true },
  goto: { label: 'Show', variant: 'ghost', accent: true },
  retry: { label: 'Try again', variant: 'ghost', accent: true },
  discard: { label: 'Discard', variant: 'soft' },
  save: { label: 'Save', variant: 'solid' },
  hide: { label: 'Hide site', variant: 'danger' },
  reload: { label: 'Reload editor', variant: 'outline' },
  show: { label: 'Show in search', variant: 'outline' },
  drop: { label: 'Discard', variant: 'outline' },
  use: { label: 'Use it', variant: 'outline' },
};

type Act = (action: keyof typeof BUTTONS) => void;

const BAR: FooterAction[] = ['undo', 'goto', 'retry', 'discard', 'save', 'hide'];

/** The bar shows only when a button is needed, or for a passing message. */
const barOf = (state: State, shown: Footer) =>
  shown.actions.some((action) => BAR.includes(action)) ||
  // A jump is answered by the focused field itself.
  (shown.dot === 'info' && !state.flash?.startsWith('Moved to '));

function Buttons(props: {
  actions: (keyof typeof BUTTONS)[];
  act: Act;
  /** Where focus goes when the pressed button is gone. */
  fallback(): HTMLElement | null | undefined;
}) {
  return props.actions.map((action) => (
    <Btn
      key={action}
      variant={BUTTONS[action].variant}
      accent={BUTTONS[action].accent}
      aria-keyshortcuts={
        action === 'save' ? 'Control+Enter Meta+Enter' : undefined
      }
      onClick={(event) => {
        const pressed = event.currentTarget;
        const group = pressed.parentElement;
        const after = [...(group?.children ?? [])].indexOf(pressed);
        flushSync(() => props.act(action));
        // Most actions remove the button that was pressed. Focus must not
        // fall to the document: the button now in its place (or the last
        // one) of the same group takes it, else the fallback.
        const active = document.activeElement;
        if (pressed.isConnected || (active && active !== document.body)) {
          return;
        }
        const left = group?.isConnected
          ? group.querySelectorAll<HTMLElement>(':scope > button')
          : [];
        (left[Math.min(after, left.length - 1)] ?? props.fallback())?.focus();
      }}
    >
      {BUTTONS[action].label}
    </Btn>
  ));
}

/** Notes that explain a scope the user can read and not change, or why there is no page. */
function useNotes(): string[] {
  const { state } = useApp();
  const server = state.server!;
  return [
    state.scope === 'site' && !server.target
      ? state.ctx.kind === 'none' && state.ctx.template
        ? 'SEO for a content type is set in its Full content template, with a page to preview.'
        : 'Open a page or a content template to edit its SEO.'
      : null,
    state.scope === 'site' && !server.can.site
      ? 'Only people who administer SEO site settings can change these. You are viewing them.'
      : null,
    state.scope === 'target' && state.readonly === 'access'
      ? 'You can view these settings but not change them.'
      : null,
  ].filter((line) => line !== null);
}

function Ready(props: {
  strips: Strip[];
  act: Act;
  /** While the editor's next context loads: what replaces the views. */
  loading?: ReactNode;
}) {
  const { state, dispatch, sheet, closeSheet } = useApp();
  const server = state.server!;
  const shown = footer(state);
  const bar = barOf(state, shown);
  const notes = useNotes();
  const frame = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const tab = TARGET_TABS.includes(state.tabs.target)
    ? state.tabs.target
    : 'search';
  // The view behind a sheet is out of reach.
  useLayoutEffect(() => {
    frame.current?.toggleAttribute('inert', sheet !== null);
  }, [sheet]);
  // Every view opens at its preview. A jump scrolls after this, to its field.
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    body.current?.scrollTo(0, 0);
  }, [tab, state.scope]);
  // The bar floats over the body's end: the body makes room for its real
  // height, and what was in view (the end, or the control just used) stays.
  const barRef = useRef<HTMLDivElement>(null);
  const atEnd = useRef(false);
  const barHeight = useRef(0);
  // Every render: the bar's words (and its height) change with the state.
  useLayoutEffect(() => {
    const element = barRef.current;
    const scroller = body.current;
    const height = element?.offsetHeight ?? 0;
    if (!element || !scroller || height === barHeight.current) {
      barHeight.current = height;
      return;
    }
    barHeight.current = height;
    element.parentElement?.style.setProperty('--seo-bar-h', `${height}px`);
    if (atEnd.current) {
      scroller.scrollTop = scroller.scrollHeight;
    } else if (scroller.contains(document.activeElement)) {
      reveal(document.activeElement);
    }
  });
  const firstField = () =>
    document.querySelector<HTMLElement>(
      '.seo-body [data-path] :is(textarea, input, button[role], button)',
    );
  const trigger = () => document.querySelector<HTMLElement>('.seo-scope');
  const actions = shown.actions.filter((action) => BAR.includes(action));

  return (
    <>
      <Tabs.Root
        ref={frame}
        className="seo-frame"
        data-bar={bar || undefined}
        data-scope={state.scope}
        value={tab}
        onValueChange={(value) => dispatch({ type: 'tab', tab: value as typeof state.tab })}
      >
        <Header
          footer={shown}
          bar={bar}
          loading={!!props.loading}
          scrolled={scrolled}
          tab={tab}
        />
        <div
          className="seo-body"
          ref={body}
          onScroll={(event) => {
            const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
            setScrolled(scrollTop > 0);
            atEnd.current = scrollHeight - scrollTop - clientHeight < 2;
          }}
        >
          {(props.strips.length > 0 || notes.length > 0) && !props.loading && (
            <div className="seo-notices">
              {props.strips.map((strip) => (
                <Notice
                  key={strip.id}
                  tone={
                    strip.tone === 'amber' && strip.id !== 'hidden'
                      ? 'amber'
                      : 'neutral'
                  }
                  icon={strip.id === 'hidden' ? 'hidden' : undefined}
                  role={strip.role}
                  actions={
                    strip.actions.length > 0 && (
                      <Buttons
                        actions={strip.actions}
                        act={props.act}
                        fallback={firstField}
                      />
                    )
                  }
                >
                  {strip.text}
                </Notice>
              ))}
              {notes.map((note) => (
                <Notice key={note}>{note}</Notice>
              ))}
            </div>
          )}
          {props.loading}
          {!props.loading && server.target && (
            <>
              <Tabs.Content
                value="search"
                forceMount
                tabIndex={-1}
                className="seo-panel"
              >
                <SearchTab />
              </Tabs.Content>
              <Tabs.Content
                value="social"
                forceMount
                tabIndex={-1}
                className="seo-panel"
              >
                <SocialTab />
              </Tabs.Content>
              <Tabs.Content
                value="schema"
                forceMount
                tabIndex={-1}
                className="seo-panel"
              >
                <SchemaTab />
              </Tabs.Content>
            </>
          )}
          {!props.loading && (
            <div
              className="seo-panel seo-site"
              role="region"
              aria-label="Site"
            >
              <SiteView />
            </div>
          )}
        </div>
      </Tabs.Root>
      {sheet && <SheetHost sheet={sheet} onClose={() => closeSheet()} />}
      {/* Over a sheet too: a fix made there is undone here. */}
      {bar && (
          <div className="seo-bar" ref={barRef}>
            {shown.actions.includes('hide') ? (
              <ExclamationTriangleIcon aria-hidden />
            ) : (
              <span className="seo-dot" data-tone={shown.dot} />
            )}
            {/* The live region already says it. */}
            <span className="seo-bar-text" aria-hidden>
              {shown.text}
            </span>
            {actions.length > 0 && (
              <span className="seo-bar-actions">
                <Buttons
                  actions={actions as (keyof typeof BUTTONS)[]}
                  act={props.act}
                  fallback={trigger}
                />
              </span>
            )}
          </div>
        )}
    </>
  );
}

function SheetHost(props: { sheet: SheetState; onClose(): void }) {
  const { sheet, onClose } = props;
  const { state, dispatch, closeSheet } = useApp();
  const server = state.server!;
  if (sheet.kind === 'checks') {
    return (
      <Sheet
        title="Checks"
        end={<InfoTip label="About checks" text={CHECKS_NOTE} size={28} />}
        onClose={onClose}
      >
        <ChecksSheet />
      </Sheet>
    );
  }
  if (sheet.kind === 'output') {
    return (
      <Sheet
        title="Output"
        focusBack
        end={
          <InfoTip
            label="About addresses"
            text={originNote(server)}
            size={28}
          />
        }
        onClose={onClose}
      >
        <OutputSheet section={sheet.section} />
      </Sheet>
    );
  }
  if (sheet.kind === 'custom') {
    const set = !!state.edits.target.schema?.custom;
    return (
      <Sheet
        title="Custom JSON-LD"
        end={
          set &&
          state.readonly === 'no' && (
            <Btn
              variant="ghost"
              onClick={() =>
                dispatch({
                  type: 'apply',
                  scope: 'target',
                  values: {
                    ...state.edits.target,
                    schema: { ...state.edits.target.schema, custom: undefined },
                  },
                  undo: 'Removed custom JSON-LD',
                })
              }
            >
              Remove
            </Btn>
          )
        }
        onClose={onClose}
      >
        <CustomJson key={set ? 'set' : 'empty'} />
      </Sheet>
    );
  }
  return (
    <Sheet title="Choose image" onClose={onClose}>
      <ImageSheet request={sheet.request} onDone={() => closeSheet()} />
    </Sheet>
  );
}
