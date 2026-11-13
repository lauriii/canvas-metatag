import { CheckIcon, CopyIcon } from '@radix-ui/react-icons';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { useApp } from '../App';
import { catchingUp } from '../model';
import type { Head, StatePayload } from '../types';
import { Btn, reveal } from './ui';

/** Text to the clipboard; the frame may not hold the clipboard permission. */
async function copy(text: string): Promise<boolean> {
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

function CopyButton(props: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Btn
      variant="ghost"
      aria-label={props.label}
      onClick={async () => setCopied(await copy(props.text))}
    >
      {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </Btn>
  );
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

/** The exact tags for the page: what the server resolved, drafts included. */
export function OutputSheet(props: { section?: 'schema' }) {
  const { state } = useApp();
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
  }, [props.section]);
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
                <h3>Structured data</h3>
                <CopyButton text={graph} label="Copy structured data" />
              </div>
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
            </div>
          )}
        </>
      )}
    </>
  );
}
