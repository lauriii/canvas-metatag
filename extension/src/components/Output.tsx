import { CheckIcon, ChevronLeftIcon, CopyIcon } from '@radix-ui/react-icons';
import {
  Button,
  Code,
  DataList,
  Flex,
  Heading,
  ScrollArea,
  Text,
} from '@radix-ui/themes';
import { useEffect, useRef, useState } from 'react';

import { useApp } from '../App';
import type { Head } from '../types';

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

export function CopyButton(props: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      size="1"
      variant="ghost"
      aria-label={props.label}
      onClick={async () => setCopied(await copy(props.text))}
    >
      {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </Button>
  );
}

/** Pretty-printed, read-only JSON-LD. */
export function CodeView(props: { text: string }) {
  return (
    <ScrollArea
      type="auto"
      scrollbars="vertical"
      className="seo-code-view"
      tabIndex={0}
      role="group"
      aria-label="Structured data"
    >
      <pre>
        <Code variant="ghost" size="1">
          {props.text}
        </Code>
      </pre>
    </ScrollArea>
  );
}

/** The JSON-LD of a head as text, or '' when there is none. */
export const jsonLd = (head: Head | undefined): string => {
  const data = head?.script.find(
    (script) => script.type === 'application/ld+json',
  )?.textContent;
  return data === undefined
    ? ''
    : typeof data === 'string'
      ? data
      : JSON.stringify(data, null, 2);
};

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

/** The exact tags for the page: what the server resolved, drafts included. */
export function Output() {
  const { state, setOutput } = useApp();
  const server = state.server!;
  const head = server.resolved?.head;
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus(), []);
  const close = () => {
    setOutput(false);
    // Back to the control that opened it.
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>('.seo-footer button')
        ?.focus({ preventScroll: true }),
    );
  };
  const list = head ? rows(head) : [];
  const graph = jsonLd(head);
  const headless = server.origin.source === 'frontend';
  const what =
    server.target?.scope === 'page'
      ? 'this page'
      : (server.preview?.label ?? 'this page');
  return (
    <div
      className="seo-output"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          close();
        }
      }}
    >
      <Flex align="center" gap="3" mb="3">
        <Button ref={back} size="1" variant="ghost" onClick={close}>
          <ChevronLeftIcon aria-hidden />
          Back
        </Button>
        <Heading as="h2" size="2" weight="medium">
          Output for {what}
        </Heading>
      </Flex>
      <Text as="p" size="1" color="gray" mb="3">
        {headless
          ? 'What SEO sends to your frontend. Your frontend decides what reaches visitors. Includes changes that are still drafts.'
          : `What browsers and search engines receive for ${what}, once published. Includes changes that are still drafts.`}
      </Text>
      {!head ? (
        <Text as="p" size="2">
          There is no page to show output for.
        </Text>
      ) : (
        <>
          <DataList.Root size="1" data-testid="seo-output" className="seo-rows">
            {list.map((row, index) => (
              <DataList.Item key={index}>
                <DataList.Label minWidth="104px">{row.name}</DataList.Label>
                <DataList.Value>
                  {/* Whole, wrapped: a cut value could not be read by keyboard or touch. */}
                  <span className="seo-wrap" lang={server.langcode}>
                    {row.value}
                  </span>
                </DataList.Value>
              </DataList.Item>
            ))}
          </DataList.Root>
          <Flex justify="end" mt="2">
            <CopyButton
              text={list.map((row) => row.tag).join('\n')}
              label="Copy tags"
            />
          </Flex>
          {graph && (
            <>
              <Flex justify="between" align="center" mt="3" mb="2">
                <Text as="div" size="2" weight="medium">
                  Structured data
                </Text>
                <CopyButton text={graph} label="Copy structured data" />
              </Flex>
              <CodeView text={graph} />
            </>
          )}
        </>
      )}
      <Text as="p" size="1" color="gray" mt="3" className="seo-wrap">
        {server.origin.source === 'settings'
          ? `Addresses use the public address set for this site: ${server.origin.url}`
          : headless
          ? `Addresses use your frontend: ${server.origin.url}`
          : `Addresses use ${server.origin.url.replace(/^https?:\/\//, '')}, the address you are signed in at.`}
      </Text>
    </div>
  );
}
