/**
 * "Add from your paste": a paste that copies what the page already makes is
 * reviewed item by item before anything is added.
 *
 * Shared later with add-advanced-meta-tags' "Paste a snippet". Items the page
 * makes are unticked, and links to them point at the page's own items.
 */
import { Checkbox } from '@radix-ui/themes';
import { useState } from 'react';
import type { SearchFeatures, StatePayload } from '../types';
import { Btn } from '../components/ui';
import type { Cleaned } from './clean';
import { featuresOf, sentence, typesOf, type Item } from './project';
import { CUSTOM_MAX, MODULE_IDS } from './validate';

export interface ReviewRow {
  item: Item;
  tick: boolean;
  reason: string;
  /** Links to it point here instead when it is not added. */
  repoint?: string;
}

export interface Reviewed {
  rows: ReviewRow[];
  scripts: number;
  report: string | null;
}

const isObject = (value: unknown): value is Item => typeof value === 'object' && value !== null && !Array.isArray(value);
const bare = (url: unknown) => (typeof url === 'string' ? url.replace(/\/+$/, '') : '');

/**
 * Whether a paste needs a decision, and the decision offered.
 *
 * Null when every item can simply be added.
 */
export function reviewOf(done: Cleaned, ctx: { server: StatePayload; modules: Map<string, Item>; existing: number; size: number }): Reviewed | null {
  const { server, modules } = ctx;
  const rules = server.search_features as SearchFeatures;
  const identity = modules.get('#identity');
  const main = modules.get('#primary');
  const ours = [bare(identity?.url), ...(Array.isArray(identity?.sameAs) ? identity!.sameAs : [identity?.sameAs]).map(bare)].filter(Boolean);
  let room = 10 - ctx.existing;
  const rows = done.items.map((item): ReviewRow => {
    const types = typesOf(item);
    const id = typeof item['@id'] === 'string' ? item['@id'] : '';
    if (id && server.module_ids?.[id.slice(1)] && id.startsWith('#')) {
      const reason =
        id === '#identity'
          ? "This is your site's organization. Links to it will point to yours."
          : id === '#webpage'
            ? 'The page itself: add to it with Add details in Output'
            : 'Already made by this page.';
      return { item, tick: false, reason, repoint: id };
    }
    if (types.some((type) => type === 'WebSite' || /Page$/.test(type))) {
      // Only this page's own copy is added to with Add details; another page's is just made already.
      const page = bare(modules.get('#webpage')?.url ?? server.preview?.url);
      const own = !!page && [bare(item.url), bare(id.replace(/#.*$/, ''))].includes(page);
      return { item, tick: false, reason: own && !types.includes('WebSite') ? 'The page itself: add to it with Add details in Output' : 'Already made by this page.', repoint: types.includes('WebSite') ? '#website' : '#webpage' };
    }
    const urls = [bare(item.url), ...(Array.isArray(item.sameAs) ? item.sameAs : [item.sameAs]).map(bare)].filter(Boolean);
    const organization = types.some((type) => ['Organization', 'Corporation', 'LocalBusiness', 'NGO', 'Person'].includes(type));
    if (identity && organization && (urls.some((url) => ours.includes(url)) || (typeof item.name === 'string' && item.name === identity.name))) {
      return { item, tick: false, reason: "This is your site's organization. Links to it will point to yours.", repoint: '#identity' };
    }
    if (main && types.some((type) => typesOf(main).includes(type)) && ['url', 'name', 'sku'].some((key) => item[key] !== undefined && item[key] === main[key])) {
      return { item, tick: false, reason: 'Already made by this page.', repoint: '#primary' };
    }
    if (room <= 0) {
      return { item, tick: false, reason: 'Only 10 items fit. Untick some to choose.' };
    }
    room--;
    return { item, tick: true, reason: featuresOf(types, rules).length ? 'Will be added · can show in search results' : 'Will be added' };
  });
  const decide = rows.some((row) => !row.tick) || done.items.length + ctx.existing > 10 || ctx.size > CUSTOM_MAX;
  return decide ? { rows, scripts: done.scripts, report: done.report } : null;
}

/** The line before Add when links lose what they point at. */
export const danglingWords = (count: number) => `${count} ${count === 1 ? 'link will point at nothing' : 'links will point at nothing'}. Tick what ${count === 1 ? 'it points' : 'they point'} at to keep ${count === 1 ? 'it' : 'them'}.`;

/** A row's reason as its tick now stands. */
export function reasonOf(row: ReviewRow, ticked: boolean): string {
  if (ticked === row.tick) return row.reason;
  return ticked ? 'Will be added' : "Won't be added";
}

/** The clean-up report for what is added: the links counted in the chosen items only. */
export function reportFor(report: string | null, pointed: number): string | null {
  if (report === null) return null;
  const clause = pointed === 0 ? '' : pointed === 1 ? "pointed 1 link at your site's own items" : `pointed ${pointed} links at your site's own items`;
  const next = report.replace(/(, | and )?pointed \d+ links? at your site's own items/, (_match, joint: string | undefined) => (clause ? `${joint ?? ''}${clause}` : ''));
  const tidy = next.replace(/: (, | and )/, ': ');
  return /: ?\.$/.test(tidy) ? null : tidy;
}

/** Points links to items that are not added at the page's own, and counts the rest. */
export function chosen(rows: ReviewRow[], ticks: boolean[]): { items: Item[]; dangling: number; pointed: number } {
  const repoint = new Map<string, string>();
  const gone = new Set<string>();
  rows.forEach((row, index) => {
    const id = typeof row.item['@id'] === 'string' ? row.item['@id'] : null;
    if (!ticks[index] && id) {
      if (row.repoint) repoint.set(id, row.repoint);
      else gone.add(id);
    }
  });
  let dangling = 0;
  let pointed = 0;
  const ours = new RegExp(`^#(${MODULE_IDS.join('|')})$`);
  const walk = (value: unknown, top: boolean): unknown => {
    if (Array.isArray(value)) return value.map((one) => walk(one, false));
    if (!isObject(value)) return value;
    if (!top && Object.keys(value).length === 1 && typeof value['@id'] === 'string') {
      const to = repoint.get(value['@id']) ?? value['@id'];
      if (ours.test(to)) pointed++;
      if (repoint.has(value['@id'])) return { '@id': to };
      if (gone.has(value['@id'])) dangling++;
      return value;
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key.startsWith('@') ? item : walk(item, false)]));
  };
  const items = rows.filter((_, index) => ticks[index]).map((row) => walk(row.item, true) as Item);
  return { items, dangling, pointed };
}

export function PasteReview(props: { review: Reviewed; rules: SearchFeatures; onCancel(): void; onAdd(items: Item[], report: string | null): void }) {
  const [ticks, setTicks] = useState(props.review.rows.map((row) => row.tick));
  const { items, dangling, pointed } = chosen(props.review.rows, ticks);
  const count = items.length;
  return (
    <div className="seo-creview">
      <h3 tabIndex={-1} data-focus="level">
        Add from your paste
      </h3>
      <p className="seo-meta">
        Found {props.review.rows.length} {props.review.rows.length === 1 ? 'item' : 'items'}
        {props.review.scripts > 1 ? ` in ${props.review.scripts} script tags` : ''}.
      </p>
      <ul>
        {props.review.rows.map((row, index) => (
          <li key={index}>
            <label className="seo-creview-row">
              <Checkbox checked={ticks[index]} onCheckedChange={(checked) => setTicks(ticks.map((tick, at) => (at === index ? checked === true : tick)))} />
              <span>
                <span dir="auto">{sentence(row.item, props.rules)}</span>
                <span className="seo-meta">{reasonOf(row, ticks[index])}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {dangling > 0 && (
        <p className="seo-meta" data-tone="improve">
          {danglingWords(dangling)}
        </p>
      )}
      <p className="seo-meta">The pasted text isn't kept. Only the items you add are saved.</p>
      <div className="seo-creview-foot">
        <Btn variant="ghost" onClick={props.onCancel}>
          Cancel
        </Btn>
        <Btn variant="solid" disabled={count === 0 || count > 10} onClick={() => props.onAdd(items, reportFor(props.review.report, pointed))}>
          Add {count} {count === 1 ? 'item' : 'items'}
        </Btn>
      </div>
    </div>
  );
}
