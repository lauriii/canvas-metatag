import {
  CheckIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon,
} from '@radix-ui/react-icons';
import {
  Badge,
  Box,
  Button,
  Callout,
  Flex,
  Heading,
  Popover,
  ScrollArea,
  SegmentedControl,
  Skeleton,
  Spinner,
  Tabs,
  Text,
} from '@radix-ui/themes';
import {
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { type Api, ApiError, createApi } from './api';
import { checks, countIssues } from './checks';
import { ChecksTab } from './components/ChecksTab';
import { Output } from './components/Output';
import { SearchSkeleton } from './components/Previews';
import { SchemaTab } from './components/SchemaTab';
import { SearchTab } from './components/SearchTab';
import { DefaultsTab, IdentityTab } from './components/SiteTab';
import { SocialTab } from './components/SocialTab';
import { type Host, type HostContext, createHost } from './host';
import {
  type DraftIO,
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
  Tab,
  Texts,
} from './types';

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
  /** The last "Go to": fields compare `field` and `seq` to take focus. */
  jump: (Jump & { seq: number; toLabel: boolean; suggest: boolean }) | null;
  /**
   * Switches scope and tab, then names the field. `toLabel`: focus its label,
   * not its input. `suggest`: open its suggestion panel.
   */
  goTo(jump: Jump, how?: { toLabel?: boolean; suggest?: boolean }): void;
  /** The texts a suggestion panel is trying out: the previews show them. */
  trial: Texts | null;
  setTrial(trial: Texts | null): void;
  /** Canvas's own Description is the field's while it has focus: previews follow `text`. */
  holdDescription(text: string): void;
  /** Hands the Description to Canvas, once. False when the editor did not take it. */
  commitDescription(text: string): boolean;
  /** The Output view replaces the scroll area. */
  output: boolean;
  setOutput(open: boolean): void;
}

const Context = createContext<AppContext | null>(null);

export function useApp(): AppContext {
  const app = useContext(Context);
  if (!app) {
    throw new Error('useApp() needs <App>.');
  }
  return app;
}

// Tabs. Panels of both scopes stay mounted; inactive ones are hidden.

const PANELS: Record<
  Tab,
  { scope: Scope; label: string; body: ComponentType }
> = {
  search: { scope: 'target', label: 'Search', body: SearchTab },
  social: { scope: 'target', label: 'Social', body: SocialTab },
  schema: { scope: 'target', label: 'Structured data', body: SchemaTab },
  checks: { scope: 'target', label: 'Checks', body: ChecksTab },
  identity: { scope: 'site', label: 'Identity', body: IdentityTab },
  defaults: { scope: 'site', label: 'Defaults', body: DefaultsTab },
};

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
  const [output, setOutput] = useState(false);
  const [jump, setJump] = useState<AppContext['jump']>(null);
  const [trial, setTrial] = useState<Texts | null>(null);

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
          flash: !first.current && label ? `Now editing: ${label}` : undefined,
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
      setOutput(false);
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
        setOutput(false);
        dispatch({ type: 'scope', scope: to.scope });
        dispatch({ type: 'tab', tab: to.tab });
        setJump((last) => ({
          ...to,
          toLabel: how.toLabel ?? false,
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
      output,
      setOutput,
    }),
    [
      api,
      dispatch,
      host,
      issues,
      jump,
      measurer,
      output,
      shownView,
      state,
      trial,
    ],
  );

  const act: Act = (action) => {
    const { scope, errors, offer, edits, server } = now.current;
    if (action === 'output') {
      setOutput(true);
    } else if (action === 'undo') {
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
        {state.phase === 'loading' && !state.server && (
          <Loading
            // The address and the description paint with the first frame.
            origin={undefined}
            inputs={state.ctx.kind === 'page' ? host.inputs() : null}
          />
        )}
        {state.phase === 'forbidden' && (
          <Message title="SEO is not available">
            You don't have permission to edit SEO settings. Ask a site
            administrator for "Edit SEO settings in Canvas".
          </Message>
        )}
        {state.phase === 'error' && (
          <Message
            title="SEO settings couldn't load"
            action="Try again"
            onAction={() => {
              shown.current = null;
              loaded.current = null;
              follow();
            }}
          >
            The server didn't answer. Your page is not affected.
          </Message>
        )}
        {(state.phase === 'ready' || state.phase === 'loading') &&
          state.server && (
            // One element in both phases: when the editor moves on, the
            // frame stays, and so do focus and the footer's live region.
            // Only the scroll area waits.
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
      <Flex direction="column" gap="2" mb="4">
        <Skeleton height="32px" width="45%" />
        <Skeleton height="24px" width="80%" />
      </Flex>
      <SearchSkeleton
        host={host}
        alias={props.inputs?.alias}
        description={props.inputs?.description}
      />
    </div>
  );
}

function Message(props: {
  title: string;
  children: string;
  action?: string;
  onAction?(): void;
}) {
  return (
    <Flex
      className="seo-message"
      direction="column"
      align="center"
      justify="center"
      gap="2"
    >
      <Heading as="h1" size="3">
        {props.title}
      </Heading>
      <Text as="p" size="2">
        {props.children}
      </Text>
      {props.action && (
        <Button size="2" variant="soft" mt="2" onClick={props.onAction}>
          {props.action}
        </Button>
      )}
    </Flex>
  );
}

// The frame: scope bar, tabs, strips, one scroll area, footer.

const BUTTONS: Record<
  FooterAction | Strip['actions'][number],
  { label: string; variant: 'ghost' | 'soft' | 'solid'; color?: 'gray' | 'red' }
> = {
  output: { label: 'Output', variant: 'ghost' },
  undo: { label: 'Undo', variant: 'ghost' },
  goto: { label: 'Go to', variant: 'ghost' },
  retry: { label: 'Try again', variant: 'ghost' },
  discard: { label: 'Discard', variant: 'soft', color: 'gray' },
  save: { label: 'Save for whole site', variant: 'solid' },
  hide: { label: 'Hide site and save', variant: 'solid', color: 'red' },
  reload: { label: 'Reload editor', variant: 'ghost' },
  show: { label: 'Undo', variant: 'ghost' },
  drop: { label: 'Discard', variant: 'ghost' },
  use: { label: 'Use it', variant: 'ghost' },
};

type Act = (action: keyof typeof BUTTONS) => void;

function Actions(props: {
  actions: (keyof typeof BUTTONS)[];
  act: Act;
  /** On a tinted strip: text at full contrast. */
  highContrast?: boolean;
}) {
  const { output } = useApp();
  return props.actions.map((action) => (
    <Button
      key={action}
      size="1"
      variant={BUTTONS[action].variant}
      color={BUTTONS[action].color}
      highContrast={props.highContrast}
      aria-expanded={action === 'output' ? output : undefined}
      onClick={(event) => {
        const pressed = event.currentTarget;
        const strip = pressed.closest('.seo-strips') !== null;
        props.act(action);
        // Most actions remove the button that was pressed. Focus must not
        // fall to the document: a strip hands it to the tab list, the footer
        // to its next button, else to its status.
        requestAnimationFrame(() => {
          const active = document.activeElement;
          if (pressed.isConnected || (active && active !== document.body)) {
            return;
          }
          const footer = document.querySelector('.seo-footer');
          (strip
            ? document.querySelector<HTMLElement>(
                '.seo-tabs [role="tab"][data-state="active"]',
              )
            : (footer?.querySelector<HTMLElement>('button') ??
              footer?.querySelector<HTMLElement>('[role="status"]'))
          )?.focus();
        });
      }}
    >
      {BUTTONS[action].label}
    </Button>
  ));
}

function Ready(props: {
  strips: Strip[];
  act: Act;
  /** While the editor's next context loads: what replaces the panels. */
  loading?: ReactNode;
}) {
  const { state, dispatch, issues, output } = useApp();
  const server = state.server!;
  const count = props.loading ? 0 : countIssues(issues);
  const tabs = (Object.keys(PANELS) as Tab[]).filter(
    (tab) => PANELS[tab].scope === 'site' || server.target,
  );
  return (
    <>
      <ScopeBar />
      <Tabs.Root
        className="seo-tabs"
        // Output replaces the scroll area; the tabs stay mounted behind it.
        data-output={output || undefined}
        value={state.tab}
        onValueChange={(tab) => dispatch({ type: 'tab', tab: tab as Tab })}
      >
        {!output && (
          <Tabs.List size="2">
            {tabs
              .filter((tab) => PANELS[tab].scope === state.scope)
              .map((tab) => (
                <Tabs.Trigger key={tab} value={tab}>
                  {PANELS[tab].label}
                  {tab === 'checks' && count > 0 && (
                    <Badge
                      ml="2"
                      radius="full"
                      highContrast
                      color={
                        issues.some((issue) => issue.severity === 'fix')
                          ? 'red'
                          : 'amber'
                      }
                      aria-label={`${count} ${count === 1 ? 'issue' : 'issues'}`}
                    >
                      {count}
                    </Badge>
                  )}
                </Tabs.Trigger>
              ))}
          </Tabs.List>
        )}
        {state.scope === 'site' && (
          <Text as="p" size="1" className="seo-band">
            Site-wide. Saved changes apply to every page at once.
          </Text>
        )}
        {props.strips.length > 0 && (
          <Flex className="seo-strips" direction="column" gap="1">
            {props.strips.map((strip) => (
              <Callout.Root
                key={strip.id}
                className="seo-strip"
                size="1"
                color={strip.tone}
                role={strip.role}
                highContrast
              >
                <Callout.Icon>
                  {strip.tone === 'blue' ? (
                    <InfoCircledIcon aria-hidden />
                  ) : (
                    <ExclamationTriangleIcon aria-hidden />
                  )}
                </Callout.Icon>
                <Callout.Text>{strip.text}</Callout.Text>
                <Flex gap="3" align="center">
                  <Actions
                    actions={strip.actions}
                    act={props.act}
                    highContrast
                  />
                </Flex>
              </Callout.Root>
            ))}
          </Flex>
        )}
        {props.loading && <Box className="seo-panel">{props.loading}</Box>}
        {output && !props.loading && (
          <Box className="seo-panel">
            <ScrollArea type="auto" scrollbars="vertical">
              <Box className="seo-panel-body">
                <Output />
              </Box>
            </ScrollArea>
          </Box>
        )}
        {!props.loading && tabs.map((tab) => {
          const Body = PANELS[tab].body;
          return (
            // Mounted when hidden, so each tab keeps its state and its scroll area.
            <Tabs.Content
              key={tab}
              value={tab}
              forceMount
              className="seo-panel"
            >
              <ScrollArea type="auto" scrollbars="vertical">
                <Box className="seo-panel-body">
                  <Notes scope={PANELS[tab].scope} />
                  <Body />
                </Box>
              </ScrollArea>
            </Tabs.Content>
          );
        })}
      </Tabs.Root>
      <Footer act={props.act} />
    </>
  );
}

/** The dialog takes focus once per frame: never again when the editor moves on. */
let focusedOnce = false;

function ScopeBar() {
  const { state, dispatch, setOutput } = useApp();
  const server = state.server!;
  const target = server.target;
  const focus = useRef<HTMLDivElement>(null);
  // Once, when the dialog opens. Focus never moves again without a user action.
  useEffect(() => {
    if (focusedOnce) {
      return;
    }
    focusedOnce = true;
    focus.current
      ?.querySelector<HTMLElement>('button[data-state="on"], h1[tabindex]')
      ?.focus();
  }, []);
  const change = (scope: string) => {
    if (scope) {
      // Output belongs to the page or template it was opened for.
      setOutput(false);
      dispatch({ type: 'scope', scope: scope as Scope });
    }
  };

  if (!target) {
    return (
      <Flex className="seo-scope" align="center" ref={focus}>
        <Heading as="h1" size="3" tabIndex={-1}>
          Site settings
        </Heading>
      </Flex>
    );
  }
  return (
    <Flex
      className="seo-scope"
      align="center"
      justify="between"
      gap="3"
      // At 200% zoom the language button moves under the scope switch.
      wrap="wrap"
      ref={focus}
    >
      <h1 className="seo-visually-hidden">SEO</h1>
      <SegmentedControl.Root
        size="2"
        role="radiogroup"
        aria-label="Scope"
        value={state.scope}
        onValueChange={change}
        // A radio group selects as the arrows move, as screen readers announce.
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            change(event.key === 'ArrowLeft' ? 'target' : 'site');
          }
        }}
      >
        <SegmentedControl.Item value="target">
          {target.scope === 'page' ? 'This page' : `Every ${target.label}`}
        </SegmentedControl.Item>
        <SegmentedControl.Item value="site">
          <Flex as="span" align="center" gap="2">
            Site
            {state.siteDirty && (
              <span
                className="seo-dot"
                data-tone="blue"
                role="img"
                aria-label="unsaved changes"
              />
            )}
          </Flex>
        </SegmentedControl.Item>
      </SegmentedControl.Root>
      {state.scope === 'target' &&
        target.scope === 'page' &&
        Object.keys(server.languages).length > 1 && <Language />}
    </Flex>
  );
}

/** Which language is being edited, and what that means for the others. */
function Language() {
  const server = useApp().state.server!;
  const target = server.target!;
  const name = (langcode: string | null) =>
    server.languages[langcode ?? ''] ?? langcode ?? '';
  const language = name(server.langcode);
  const original = name(target.default_langcode);
  return (
    <Popover.Root>
      <Popover.Trigger>
        <Button size="1" variant="ghost" color="gray">
          {language}
          <InfoCircledIcon aria-hidden />
        </Button>
      </Popover.Trigger>
      <Popover.Content size="1" maxWidth="340px">
        <Text as="p" size="2">
          {!target.translatable
            ? 'These settings are shared by every language of this page.'
            : target.default_langcode &&
                target.default_langcode !== server.langcode
              ? `You are editing the ${language} version. Canvas publishes translations together with the ${original} version, so this draft goes live the next time the ${original} version is published. It is not listed in "Review changes".`
              : `You are editing the ${language} version. Titles, descriptions and social text set here apply to ${language} only. Search visibility, the social image and the page type also apply to other languages until they set their own.`}
        </Text>
      </Popover.Content>
    </Popover.Root>
  );
}

/** One line that explains a scope the user can read and not change, or why there is no page. */
function Notes(props: { scope: Scope }) {
  const { state } = useApp();
  const server = state.server!;
  const lines = [
    props.scope === 'site' && !server.target
      ? state.ctx.kind === 'none' && state.ctx.template
        ? 'SEO for a content type is set in its Full content template, with a page to preview.'
        : 'Open a page or a content template to edit its SEO.'
      : null,
    props.scope === 'site' && !server.can.site
      ? 'Only people who administer SEO site settings can change these. You are viewing them.'
      : null,
    props.scope === 'target' && state.readonly === 'access'
      ? 'You can view these settings but not change them.'
      : null,
  ].filter((line) => line !== null);
  return lines.map((line) => (
    <Callout.Root key={line} size="1" color="gray" mb="3">
      <Callout.Icon>
        <InfoCircledIcon aria-hidden />
      </Callout.Icon>
      <Callout.Text>{line}</Callout.Text>
    </Callout.Root>
  ));
}

function Footer(props: { act: Act }) {
  const { state } = useApp();
  const { dot, text, actions } = footer(state);
  return (
    <Flex
      className="seo-footer"
      align="center"
      justify="between"
      gap="2"
      wrap="wrap"
      // Site with unsaved changes: the sentence, then its two buttons.
      data-rows={actions.length > 1 ? 2 : undefined}
    >
      {/* One polite live region: the only place status lives. */}
      <Flex
        align="center"
        gap="2"
        role="status"
        data-testid="seo-footer-status"
        // Where focus goes when the button that was pressed is gone.
        tabIndex={-1}
      >
        {dot === 'spinner' ? (
          <Spinner size="1" />
        ) : dot === 'ok' ? (
          <CheckIcon color="var(--green-11)" aria-hidden />
        ) : dot === 'error' ? (
          <CrossCircledIcon color="var(--red-11)" aria-hidden />
        ) : dot === 'warn' ? (
          <ExclamationTriangleIcon color="var(--amber-11)" aria-hidden />
        ) : dot === 'info' ? (
          <InfoCircledIcon aria-hidden />
        ) : (
          <span className="seo-dot" data-tone={dot} />
        )}
        <Text size="1">{text}</Text>
      </Flex>
      <Flex gap="3" align="center" ml="auto">
        <Actions actions={actions} act={props.act} />
      </Flex>
    </Flex>
  );
}
