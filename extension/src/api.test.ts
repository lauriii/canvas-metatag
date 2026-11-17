import { describe, expect, it } from 'vitest';

import { ApiError, createApi } from './api';
import type { EditorToken } from './host';

type Reply = Response | Error;

/** A fetch that answers from a queue per URL suffix and records every call. */
function fakeFetch(replies: Record<string, Reply[]>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const key = Object.keys(replies).find((suffix) => url.includes(suffix));
    const reply = key ? replies[key].shift() : undefined;
    if (!reply) {
      throw new Error(`Unexpected request: ${url}`);
    }
    if (reply instanceof Error) {
      throw reply;
    }
    return reply;
  }) as typeof fetch;
  return { fetchFn, calls, urls: () => calls.map((call) => call.url) };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const html = (status: number) =>
  new Response('<!DOCTYPE html><html><body>Access denied</body></html>', {
    status,
    headers: { 'Content-Type': 'text/html' },
  });
const token = (value: string) => new Response(value);

const EDITOR: EditorToken = {
  clientInstanceId: 'client-1',
  autoSaves: {
    'canvas_page:8:en': { autoSaveStartingPoint: '8-1', hash: null },
  },
  langcode: 'en',
};
const PAGE = { kind: 'page', id: '8' } as const;

const failure = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('Expected a rejection.');
};

describe('requests', () => {
  it('builds the state query for each context, on the base path', async () => {
    const fake = fakeFetch({
      'api/state': [json({}), json({}), json({}), json({}), json({})],
    });
    const api = createApi('/sub/', fake.fetchFn);
    await api.getState(PAGE, 'en');
    await api.getState(PAGE);
    await api.getState({
      kind: 'template',
      id: 'node.article.full',
      bundle: 'article',
      previewId: '11',
    });
    await api.getState({
      kind: 'template',
      id: 'node.article.full',
      bundle: 'article',
      previewId: null,
    });
    await api.getState({ kind: 'none', template: true });
    expect(fake.urls()).toEqual([
      '/sub/canvas-metatag/api/state?entity_type=canvas_page&id=8&langcode=en',
      '/sub/canvas-metatag/api/state?entity_type=canvas_page&id=8',
      '/sub/canvas-metatag/api/state?entity_type=content_template&id=node.article.full&preview=11',
      '/sub/canvas-metatag/api/state?entity_type=content_template&id=node.article.full',
      '/sub/canvas-metatag/api/state',
    ]);
    // A read needs no token.
    expect(fake.calls[0].init).toMatchObject({ credentials: 'same-origin' });
    expect(fake.calls[0].init.method).toBeUndefined();
  });

  it("a draft write carries the editor's id and its auto-save entry", async () => {
    const fake = fakeFetch({
      'session/token': [token('csrf-1')],
      'api/draft': [
        json({ values: { title: { text: 'T' } } }),
        json({ values: {} }),
        json({ values: {} }),
      ],
    });
    const api = createApi('/', fake.fetchFn);
    expect(await api.putDraft(PAGE, { title: { text: 'T' } }, 'en', EDITOR)).toEqual({
      values: { title: { text: 'T' } },
    });
    const call = fake.calls[1];
    expect(call.url).toBe('/canvas-metatag/api/draft/canvas_page/8');
    expect(call.init).toMatchObject({
      method: 'PUT',
      // A live frame's write is not capped at 64 KiB: no keepalive.
      keepalive: false,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-1' },
    });
    expect(JSON.parse(call.init.body as string)).toEqual({
      values: { title: { text: 'T' } },
      langcode: 'en',
      client_instance_id: 'client-1',
      auto_saves: EDITOR.autoSaves,
    });

    await api.putDraft(
      {
        kind: 'template',
        id: 'node.article.full',
        bundle: 'article',
        previewId: '11',
      },
      {},
      'en',
      { ...EDITOR, langcode: null },
    );
    expect(fake.calls[2].url).toBe(
      '/canvas-metatag/api/draft/content_template/node.article.full',
    );
    // A template write names no language.
    expect(JSON.parse(fake.calls[2].init.body as string)).not.toHaveProperty(
      'langcode',
    );

    // The write sent while the frame is being removed outlives it.
    await api.putDraft(PAGE, {}, 'en', EDITOR, true);
    expect(fake.calls[3].init).toMatchObject({ keepalive: true });
  });

  it('site, media and suggest', async () => {
    const fake = fakeFetch({
      'session/token': [token('csrf-1')],
      'api/site': [json({ site: {} })],
      'api/media': [json({ items: [], more: false })],
      'api/ai/suggest': [json({ suggestions: { title: ['A'] } })],
    });
    const api = createApi('/', fake.fetchFn);
    const site = {
      identity: {
        kind: 'person' as const,
        name: 'Ada',
        separator: '|',
        logo: '',
        default_image: '',
        same_as: [],
      },
      values: { title_end: { text: 'Example Co' } },
      currency: 'EUR',
    };
    await api.putSite(site);
    expect(JSON.parse(fake.calls[1].init.body as string)).toEqual(site);
    expect(fake.calls[1].init.method).toBe('PUT');
    await api.getMedia('hero & co', 2);
    expect(fake.calls[2].url).toBe(
      '/canvas-metatag/api/media?q=hero+%26+co&page=2',
    );
    const answer = await api.suggest({
      task: 'text',
      fields: ['title'],
      count: 3,
      langcode: 'en',
      current: { title: 'Pricing' },
      hint: '',
      page: { title: 'Pricing', site: 'Example', text: 'Plans' },
    });
    expect(answer.suggestions.title).toEqual(['A']);
    expect(fake.calls[3].init.method).toBe('POST');
  });
});

describe('CSRF token', () => {
  it('is fetched once and reused', async () => {
    const fake = fakeFetch({
      'session/token': [token('csrf-1')],
      'api/site': [json({ site: {} }), json({ site: {} })],
      'api/draft': [json({ values: {} })],
    });
    const api = createApi('/', fake.fetchFn);
    await Promise.all([api.putSite({} as never), api.putSite({} as never)]);
    await api.putDraft(PAGE, {}, 'en', EDITOR);
    expect(
      fake.urls().filter((url) => url.endsWith('session/token')),
    ).toHaveLength(1);
    expect(
      fake.calls
        .filter((call) => call.init.method)
        .map(
          (call) =>
            (call.init.headers as Record<string, string>)['X-CSRF-Token'],
        ),
    ).toEqual(['csrf-1', 'csrf-1', 'csrf-1']);
  });

  it('is fetched again once, and the write retried, after a 403 without a JSON body', async () => {
    const fake = fakeFetch({
      'session/token': [token('stale'), token('fresh')],
      'api/draft': [html(403), json({ values: { title: { text: 'T' } } })],
    });
    const api = createApi('/', fake.fetchFn);
    expect(await api.putDraft(PAGE, { title: { text: 'T' } }, 'en', EDITOR)).toEqual({
      values: { title: { text: 'T' } },
    });
    expect(fake.urls()).toEqual([
      '/session/token',
      '/canvas-metatag/api/draft/canvas_page/8',
      '/session/token',
      '/canvas-metatag/api/draft/canvas_page/8',
    ]);
    expect(
      (fake.calls[3].init.headers as Record<string, string>)['X-CSRF-Token'],
    ).toBe('fresh');
  });

  it('a second 403 is final: signed out', async () => {
    const fake = fakeFetch({
      'session/token': [token('stale'), token('fresh')],
      'api/site': [html(403), html(403)],
    });
    const error = await failure(
      createApi('/', fake.fetchFn).putSite({} as never),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('forbidden');
    expect(fake.calls).toHaveLength(4);
  });

  it('a 403 with a JSON error, or on a read, is not retried', async () => {
    const fake = fakeFetch({
      'session/token': [token('csrf-1')],
      'api/draft': [
        json({ error: { code: 'forbidden', message: 'Access denied.' } }, 403),
      ],
      'api/state': [html(403)],
    });
    const api = createApi('/', fake.fetchFn);
    expect((await failure(api.putDraft(PAGE, {}, 'en', EDITOR))).code).toBe(
      'forbidden',
    );
    expect((await failure(api.getState(PAGE))).code).toBe('forbidden');
    expect(fake.calls).toHaveLength(3);
  });

  it('a token that cannot be fetched is a network error and is asked for again', async () => {
    const fake = fakeFetch({
      'session/token': [new TypeError('Failed to fetch'), token('csrf-1')],
      'api/site': [json({ site: {} })],
    });
    const api = createApi('/', fake.fetchFn);
    expect((await failure(api.putSite({} as never))).code).toBe('network');
    await api.putSite({} as never);
    expect(fake.urls()).toEqual([
      '/session/token',
      '/session/token',
      '/canvas-metatag/api/site',
    ]);
  });
});

describe('errors', () => {
  it('a JSON error body becomes an ApiError with its code and fields', async () => {
    const fake = fakeFetch({
      'session/token': [token('csrf-1')],
      'api/draft': [
        json(
          {
            error: {
              code: 'invalid',
              message: 'Some values need attention.',
              fields: {
                canonical:
                  'Enter a full address that starts with https://, or a path that starts with /.',
              },
            },
          },
          422,
        ),
        json(
          {
            error: {
              code: 'conflict',
              message: 'The editor does not hold the latest draft.',
            },
          },
          409,
        ),
      ],
      'api/ai/suggest': [
        json(
          { error: { code: 'rate_limited', message: 'Too many requests.' } },
          429,
        ),
      ],
    });
    const api = createApi('/', fake.fetchFn);
    const invalid = await failure(
      api.putDraft(PAGE, { canonical: 'x' }, 'en', EDITOR),
    );
    expect(invalid).toBeInstanceOf(ApiError);
    expect(invalid).toMatchObject({
      code: 'invalid',
      message: 'Some values need attention.',
      fields: {
        canonical:
          'Enter a full address that starts with https://, or a path that starts with /.',
      },
    });
    const conflict = await failure(api.putDraft(PAGE, {}, 'en', EDITOR));
    expect(conflict).toMatchObject({ code: 'conflict', fields: {} });
    expect(
      await failure(
        api.suggest({
          task: 'schema',
          langcode: 'en',
          page: { title: '', site: '', text: '' },
        }),
      ),
    ).toMatchObject({
      code: 'rate_limited',
    });
  });

  it('a type without a Full template reads as Site settings', async () => {
    const missing = json(
      { error: { code: 'not_found', message: 'No such template.' } },
      404,
    );
    const site = { target: null, site: {} };
    const fake = fakeFetch({
      'api/state': [missing, json(site), missing.clone()],
    });
    const api = createApi('/', fake.fetchFn);
    const template = {
      kind: 'template',
      id: 'node.page.full',
      bundle: 'page',
      previewId: null,
    } as const;
    expect(await api.getState(template)).toEqual(site);
    expect(fake.urls()).toEqual([
      '/canvas-metatag/api/state?entity_type=content_template&id=node.page.full',
      '/canvas-metatag/api/state',
    ]);
    // With a node to preview, a missing template stays an error.
    const error = await failure(api.getState({ ...template, previewId: '4' }));
    expect(error.code).toBe('not_found');
  });

  it('an HTML 403 becomes forbidden', async () => {
    const fake = fakeFetch({ 'api/state': [html(403)] });
    const error = await failure(createApi('/', fake.fetchFn).getState(PAGE));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('forbidden');
  });

  it('any other response without a JSON error becomes network', async () => {
    const fake = fakeFetch({
      'api/state': [
        html(500),
        html(404),
        new Response('not json', { status: 200 }),
        json({ message: 'no error member' }, 502),
      ],
    });
    const api = createApi('/', fake.fetchFn);
    for (let index = 0; index < 4; index++) {
      expect((await failure(api.getState(PAGE))).code).toBe('network');
    }
  });

  it('a network failure becomes network', async () => {
    const fake = fakeFetch({ 'api/state': [new TypeError('Failed to fetch')] });
    const error = await failure(createApi('/', fake.fetchFn).getState(PAGE));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('network');
  });
});
