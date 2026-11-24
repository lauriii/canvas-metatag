import { CheckIcon, CopyIcon } from '@radix-ui/react-icons';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Tooltip } from '@radix-ui/themes';

import { useApp } from '../App';
import { retiredText } from '../checks';
import { andList, catchingUp, unsent } from '../model';
import type { GraphNode, Head, StatePayload } from '../types';
import type { CustomNode } from '../custom/CustomSheet';
import { Btn, reveal } from './ui';

/** The structured data test: it reads a published address, or pasted code. */
const TEST = 'https://validator.schema.org/';

/** Text to the clipboard; the frame may not hold the clipboard permission. */
export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let done = false;
    try {
      done = document.execCommand('copy');
    } catch {
      // Nothing was copied; the button says nothing.
    }
    area.remove();
    return done;
  }
}

export function CopyButton(props: { text: string; label: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const button = (
    <Btn
      variant="ghost"
      aria-label={props.label}
      aria-description={props.hint}
      onClick={async () => setCopied(await copy(props.text))}
    >
      {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </Btn>
  );
  return props.hint ? <Tooltip content={props.hint}>{button}</Tooltip> : button;
}

/** The JSON-LD of a head as text, or '' when there is none. */
const jsonLd = (head: Head | undefined): string => {
  const data = head?.script.find(
    (script) => script.type === 'application/ld+json',
  )?.textContent;
  return data === undefined
    ? ''
    : typeof data === 'string'
      ? data
      : JSON.stringify(data, null, 2);
};

/** One line of JSON with its keys and strings tinted. */
function tint(line: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const match of line.matchAll(/("(?:[^"\\]|\\.)*")(\s*:)?/g)) {
    parts.push(
      line.slice(at, match.index),
      <span key={match.index} data-tint={match[2] ? 'key' : 'string'}>
        {match[1]}
      </span>,
      match[2],
    );
    at = match.index + match[0].length;
  }
  parts.push(line.slice(at));
  return parts;
}

const escape = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!,
  );

/** The head as rows (name, value) and as the tags themselves. */
function rows(head: Head): { name: string; value: string; tag: string }[] {
  const attributes = (row: Record<string, string>) =>
    Object.entries(row)
      .map(([key, value]) => `${key}="${escape(String(value))}"`)
      .join(' ');
  const meta = head.meta.map((row) => ({
    name: row.name ?? row.property ?? row['http-equiv'] ?? 'meta',
    value: row.content ?? '',
    tag: `<meta ${attributes(row)}>`,
  }));
  const link = head.link.map((row) => ({
    name: row.hreflang ? `${row.rel} (${row.hreflang})` : (row.rel ?? 'link'),
    value: row.href ?? '',
    tag: `<link ${attributes(row)}>`,
  }));
  // Search first (title, description, robots, canonical), then the rest as emitted.
  const search = (row: { name: string }) =>
    ['description', 'robots', 'canonical'].includes(row.name);
  return [
    {
      name: 'title',
      value: head.title,
      tag: `<title>${escape(head.title)}</title>`,
    },
    ...meta.filter(search),
    ...link.filter(search),
    ...meta.filter((row) => !search(row)),
    ...link.filter((row) => !search(row)),
  ];
}

/** Where addresses come from: the Output sheet's ⓘ. */
export function originNote(server: StatePayload): string {
  return server.origin.source === 'settings'
    ? `Addresses use the public address set for this site: ${server.origin.url}`
    : server.origin.source === 'frontend'
      ? `Addresses use your frontend: ${server.origin.url}`
      : `Addresses use ${server.origin.url.replace(/^https?:\/\//, '')}, the address you are signed in at.`;
}

/** Why a node is not in the graph, in words. */
function leftOut(server: StatePayload, node: GraphNode): string | null {
  const schema = server.resolved!.schema;
  switch (node.left_out) {
    case 'withheld': {
      const props = server.registry[schema.type]?.props ?? [];
      const names = (keys: string[]) =>
        andList(keys.map((key) => props.find((prop) => prop.key === key)?.label ?? key));
      // Missing, or set and not valid: Checks says why.
      return schema.withheld?.missing.length
        ? `Left out: it needs ${names(schema.withheld.missing).toLowerCase()}`
        : `Left out: ${names(schema.withheld?.dropped ?? [])} ${(schema.withheld?.dropped.length ?? 0) > 1 ? 'are' : 'is'} not valid`;
    }
    case 'skip':
      return "Left out until it's on the page";
    case 'reserved':
      return 'Left out: it uses an id of the site’s own';
    case 'duplicate':
      return 'Left out: another item has the same id';
    case 'empty':
      return 'Left out: its links give nothing for this page';
    case 'over':
      return 'Left out: the structured data would be over 256 KB';
    default: {
      const retired = schema.features.find((verdict) => verdict.verdict === 'retired' && verdict.node === node.id);
      return retired ? retiredText(server.search_features.features[retired.feature!]?.since, server.ui) : null;
    }
  }
}

const ORIGIN: Record<GraphNode['origin'], string> = {
  main: 'Main',
  site: 'Site',
  page: 'This page',
  hand: 'Added by hand',
};

/** The graph as an outline: the main node first, each with where it comes from. */
function Outline() {
  const { state, dispatch, openSheet } = useApp();
  const server = state.server!;
  const schema = server.resolved!.schema;
  const list = (server.resolved!.head.script.find((script) => script.type === 'application/ld+json')?.textContent as { '@graph'?: Record<string, unknown>[] } | undefined)?.['@graph'] ?? [];
  const rank = (node: GraphNode) => (node.origin === 'main' ? 0 : node.left_out ? 2 : 1);
  const nodes = [...schema.nodes].sort((a, b) => rank(a) - rank(b));
  return (
    <ul className="seo-outline" aria-labelledby="seo-out-schema">
      {nodes.map((node, index) => {
        const data = node.at === undefined ? undefined : list[node.at];
        // A trail by its crumbs: "Home › About".
        const crumbs = Array.isArray(data?.itemListElement) ? (data.itemListElement as { name?: unknown }[]).map((one) => one?.name).filter((one): one is string => typeof one === 'string') : [];
        const name = typeof data?.name === 'string' ? data.name : typeof data?.headline === 'string' ? data.headline : data?.['@type'] === 'BreadcrumbList' ? crumbs.join(' › ') : '';
        const reason = leftOut(server, node);
        return (
          <li key={index} className="seo-outline-row" data-left-out={node.left_out ? '' : undefined}>
            <span className="seo-outline-type">
              {node.type}
              {name && <span className="seo-outline-name" dir="auto"> · {name}</span>}
            </span>
            <span className="seo-chip">{ORIGIN[node.origin]}</span>
            {node.origin === 'hand' && !!node.id && schema.main?.id === node.id && !schema.main.ignored && <span className="seo-chip">Main</span>}
            {node.extended && <span className="seo-chip">Added details</span>}
            {node.id && <code className="seo-outline-id">{node.id}</code>}
            {reason && <span className="seo-outline-reason">{reason}</span>}
            {extendable(state, node) && (() => {
              // On a template the details are every item's: named as the sheet is.
              const each = server.target?.scope === 'template' && node.origin === 'main' ? `each ${(server.target.label || 'item').toLowerCase()}` : null;
              const label = node.origin === 'page' ? 'Add details to this page' : `Add details to ${each ?? (name || node.type)}`;
              return (
                <Btn
                  variant="ghost"
                  size={24}
                  aria-label={label}
                  onClick={() => {
                    const short = `#${node.id!.split('#').pop()}` as CustomNode;
                    // The site's identity is a site setting: saved with Site.
                    if (short === '#identity') dispatch({ type: 'scope', scope: 'site' });
                    openSheet({ kind: 'custom', node: short, from: label });
                  }}
                >
                  Add details
                </Btn>
              );
            })()}
          </li>
        );
      })}
    </ul>
  );
}

/** Whether details can be added to a node: the main thing, the page, the site's identity. */
function extendable(state: ReturnType<typeof useApp>['state'], node: GraphNode): boolean {
  if (node.left_out || !node.id) return false;
  const name = node.id.split('#').pop();
  if (name === 'identity') return !!state.server?.can.site;
  return (name === 'primary' || name === 'webpage') && state.readonly === 'no' && (node.origin === 'main' || node.origin === 'page');
}

/** Hands the page to a structured data test: by address, or as copied code. */
function TestButton(props: { graph: string }) {
  const { state, host } = useApp();
  const server = state.server!;
  const [said, setSaid] = useState('');
  // A draft of the page, or of what is around it, is not at its address yet.
  const live = !!server.target?.published && !server.target.has_draft && !server.resolved?.schema.chrome_drafts?.length && !unsent(state) && !!server.preview?.published;
  return (
    <>
      <Btn
        variant="ghost"
        onClick={async () => {
          if (live) {
            host.openExternal(`${TEST}#url=${encodeURIComponent(server.preview!.url)}`);
            return;
          }
          // A draft is not at its address yet: the code is.
          const copied = await copy(props.graph);
          setSaid(copied ? 'Copied. Paste the code into the test.' : 'Copy the structured data, then paste it into the test.');
          host.openExternal(TEST);
        }}
      >
        Test this page
      </Btn>
      <span className="seo-meta" role="status">
        {said}
      </span>
    </>
  );
}

/** The exact tags for the page: what the server resolved, drafts included. */
export function OutputSheet(props: { section?: 'schema'; focus?: string }) {
  const { state, openSheet } = useApp();
  const [json, setJson] = useState(false);
  const server = state.server!;
  const head = server.resolved?.head;
  const list = head ? rows(head) : [];
  const graph = jsonLd(head);
  // Rows that are about to change are not current.
  const busy = catchingUp(state) || undefined;
  const schema = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (props.section === 'schema') {
      reveal(schema.current, 'start');
    }
    // Back from a sheet it opened: the button that opened it.
    const button = props.focus ? [...(schema.current?.querySelectorAll<HTMLElement>('button[aria-label]') ?? [])].find((one) => one.getAttribute('aria-label') === props.focus) : undefined;
    if (button) {
      button.focus();
      button.scrollIntoView({ block: 'nearest' });
    }
  }, [props.section, props.focus]);
  const what =
    server.target?.scope === 'page'
      ? server.target.label
      : (server.preview?.label ?? 'this page');
  return (
    <>
      <p className="seo-sheet-intro">
        {server.origin.source === 'frontend'
          ? 'What SEO sends to your frontend. Your frontend decides what reaches visitors. Includes changes that are still drafts.'
          : `What search engines and visitors get for ${what}, including this draft.`}
      </p>
      {!head ? (
        <p className="seo-sheet-intro">There is no page to show output for.</p>
      ) : (
        <>
          <div className="seo-out-head">
            <h3>Tags</h3>
            <CopyButton
              text={list.map((row) => row.tag).join('\n')}
              label="Copy tags"
            />
          </div>
          <dl className="seo-kv" data-testid="seo-output" aria-busy={busy}>
            {list.map((row, index) => (
              <div key={index} style={{ display: 'contents' }}>
                <dt>{row.name}</dt>
                {/* Whole, wrapped: a cut value could not be read by keyboard or touch. */}
                <dd lang={server.langcode}>{row.value}</dd>
              </div>
            ))}
          </dl>
          {graph && (
            <div ref={schema}>
              <div className="seo-out-head">
                <h3 id="seo-out-schema">Structured data</h3>
                <CopyButton text={graph} label="Copy structured data" />
              </div>
              <Outline />
              <div className="seo-out-actions">
                <Btn variant="ghost" aria-expanded={json} onClick={() => setJson(!json)}>
                  {json ? 'Hide JSON-LD' : 'Show JSON-LD'}
                </Btn>
                <TestButton graph={graph} />
                {state.readonly === 'no' && (
                  <Btn variant="ghost" aria-label="Add your own JSON-LD" onClick={() => openSheet({ kind: 'custom', from: 'Add your own JSON-LD' })}>
                    Add your own JSON-LD
                  </Btn>
                )}
              </div>
              {json && (
              <pre
                className="seo-code"
                tabIndex={0}
                aria-busy={busy}
                role="group"
                aria-label="Structured data JSON"
              >
                {graph.split('\n').map((line, index) => {
                  const indent = line.length - line.trimStart().length;
                  return (
                    // A wrapped line hangs under its own indent.
                    <span
                      key={index}
                      style={{ paddingLeft: `${indent + 2}ch` }}
                    >
                      {tint(line.trimStart())}
                    </span>
                  );
                })}
              </pre>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
