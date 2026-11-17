import type { Vocabulary } from './custom/vocab';
import type { EditorToken, HostContext } from './host';
import type {
  MediaPage,
  SchemaSuggestion,
  SeoValues,
  SiteEffect,
  SiteSettings,
  StatePayload,
  SuggestRequest,
  TextSuggestions,
} from './types';

/** The stable codes of the server, plus `network` for anything without one. */
export type ApiErrorCode =
  | 'bad_request'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'invalid'
  | 'network'
  | 'ai_not_configured'
  | 'blocked'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'invalid_response'
  | 'provider_error';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    /** Dotted path => sentence. Only for `invalid`. */
    public readonly fields: Record<string, string> = {},
    /** Dotted path => where in a hand-added text (`error_paths`). */
    public readonly places: Record<string, { item: number; path: string }> = {},
  ) {
    super(message);
  }
}

export type Api = ReturnType<typeof createApi>;

const json = (
  method: string,
  body: unknown,
  keepalive = false,
): RequestInit => ({
  method,
  body: JSON.stringify(body),
  keepalive,
});

/** @param base Drupal's base path, with its trailing slash. */
export function createApi(base: string, fetchFn: typeof fetch = fetch) {
  let token: Promise<string> | null = null;
  const csrf = () =>
    (token ??= fetchFn(`${base}session/token`, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.text();
      })
      .catch((error) => {
        // A token that could not be fetched is not kept.
        token = null;
        throw error;
      }));

  /** Unsafe methods (every request with a method here) carry the CSRF token. */
  async function send(path: string, init: RequestInit): Promise<Response> {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (init.method) {
        headers['Content-Type'] = 'application/json';
        headers['X-CSRF-Token'] = await csrf();
      }
      return await fetchFn(`${base}canvas-metatag/api/${path}`, {
        credentials: 'same-origin',
        ...init,
        headers,
      });
    } catch {
      throw new ApiError('network', 'The server did not answer.');
    }
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response = await send(path, init);
    let body = await response.json().catch(() => null);
    // A route-level 403 has an HTML body. On an unsafe method it may be a
    // stale token: fetch a new one and try once more.
    if (response.status === 403 && init.method && !body?.error) {
      token = null;
      response = await send(path, init);
      body = await response.json().catch(() => null);
    }
    if (response.ok && body !== null) {
      return body as T;
    }
    // Never assume a JSON body: without one the status decides.
    const error = body?.error;
    throw typeof error?.code === 'string'
      ? new ApiError(
          error.code,
          String(error.message ?? ''),
          error.fields ?? {},
          error.error_paths ?? {},
        )
      : new ApiError(
          response.status === 403 ? 'forbidden' : 'network',
          `Request failed (${response.status}).`,
        );
  }

  return {
    /** Fetches the CSRF token ahead of the first write. */
    prime(): void {
      csrf().catch(() => {});
    },

    /**
     * GET /state. `langcode` is what the editor's own auto-save key says.
     * Canvas serves a type's Full template route also when the type has no
     * Full template: without a preview node, that is the state without a
     * page or template (Site settings).
     */
    async getState(
      ctx: HostContext,
      langcode?: string | null,
    ): Promise<StatePayload> {
      const query = new URLSearchParams(
        ctx.kind === 'page'
          ? {
              entity_type: 'canvas_page',
              id: ctx.id,
              ...(langcode ? { langcode } : {}),
            }
          : ctx.kind === 'template'
            ? {
                entity_type: 'content_template',
                id: ctx.id,
                ...(ctx.previewId ? { preview: ctx.previewId } : {}),
              }
            : {},
      ).toString();
      try {
        return await request<StatePayload>(`state${query && `?${query}`}`);
      } catch (error) {
        if (
          ctx.kind === 'template' &&
          !ctx.previewId &&
          error instanceof ApiError &&
          error.code === 'not_found'
        ) {
          return request<StatePayload>('state');
        }
        throw error;
      }
    },

    /**
     * PUT /draft/…: the whole sparse object for the target. Always carries the
     * editor's id. `keepalive` lets the write outlive the iframe, but caps the
     * body at 64 KiB: only the write sent while leaving asks for it.
     */
    putDraft(
      ctx: Exclude<HostContext, { kind: 'none' }>,
      values: SeoValues,
      langcode: string,
      editor: EditorToken,
      keepalive = false,
    ): Promise<{ values: SeoValues }> {
      return request(
        ctx.kind === 'page'
          ? `draft/canvas_page/${ctx.id}`
          : `draft/content_template/${ctx.id}`,
        json(
          'PUT',
          {
            values,
            ...(ctx.kind === 'page' ? { langcode } : {}),
            client_instance_id: editor.clientInstanceId,
            auto_saves: editor.autoSaves,
          },
          keepalive,
        ),
      );
    },

    /** PUT /site: the whole settings. Last save wins. */
    putSite(site: SiteSettings): Promise<{ site: SiteSettings }> {
      return request('site', json('PUT', site));
    },

    /** PUT /site as a dry run: where the save would change structured data. */
    siteEffect(site: SiteSettings): Promise<{ effect: SiteEffect | null }> {
      return request('site', json('PUT', { ...site, dry_run: true }));
    },

    /** GET /vocabulary: the schema.org vocabulary the site downloaded. */
    getVocabulary(release: string): Promise<Vocabulary> {
      return request(`vocabulary?r=${encodeURIComponent(release)}`);
    },

    /** GET /media: image media the user may view, newest first. */
    getMedia(q: string, page: number): Promise<MediaPage> {
      return request(`media?${new URLSearchParams({ q, page: String(page) })}`);
    },

    /** POST /ai/suggest (the AI submodule). */
    suggest<R extends SuggestRequest>(
      body: R,
    ): Promise<
      R extends { task: 'text' } ? TextSuggestions : SchemaSuggestion
    > {
      return request('ai/suggest', json('POST', body));
    },
  };
}
