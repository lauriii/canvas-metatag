import { InfoCircledIcon } from '@radix-ui/react-icons';
import { useEffect, useRef, useState } from 'react';

import { useApp } from '../App';
import { AI_SENDS, typeOf } from '../model';
import type { Issue, Jump } from '../types';
import { fixedText } from './Field';
import { Btn, SparkleIcon } from './ui';

const GROUPS = [
  { severity: 'fix', label: 'To fix' },
  { severity: 'improve', label: 'To improve' },
  { severity: 'info', label: 'Good to know' },
] as const;

const FIELDS: [RegExp, string][] = [
  [/^title$/, 'title'],
  [/^description$/, 'description'],
  [/^canonical$/, 'canonical address'],
  [/^social\.image$/, 'social image'],
  [/^social\.title$/, 'social title'],
  [/^social\.description$/, 'social description'],
  [/^(values\.)?robots\./, 'visibility'],
  [/^values\./, 'site default'],
  [/^identity\./, 'site identity'],
  [/^schema\.type$/, 'kind of page'],
  [/^schema\.custom$/, 'JSON-LD added by hand'],
  [/^schema\.extend\./, 'added details'],
];

export const CHECKS_NOTE =
  'These checks cover the settings in this dialog and the page preview. They do not check robots.txt, speed or rankings.';

/** "2 to improve", "1 to fix · 2 to improve", "Nothing to fix". */
export function summary(issues: Issue[]): string {
  const count = (severity: Issue['severity']) =>
    issues.filter((issue) => issue.severity === severity).length;
  return (
    [
      count('fix') > 0 && `${count('fix')} to fix`,
      count('improve') > 0 && `${count('improve')} to improve`,
    ]
      .filter(Boolean)
      .join(' · ') || 'Nothing to fix'
  );
}

/**
 * Reads the page again for one issue, and says in the bar what it found:
 * the row only goes when the text is there.
 */
export function useRecheck(): (id: string) => void {
  const { dispatch, host, issues } = useApp();
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    if (pending !== null) {
      dispatch({ type: 'flash', flash: issues.some((one) => one.id === pending) ? 'Still not on the page' : 'Found on the page' });
      setPending(null);
    }
  }, [pending, issues, dispatch]);
  return (id) => {
    setPending(id);
    dispatch({ type: 'facts', facts: host.readFacts() });
  };
}

/** Facts about this dialog's settings and the page preview. Verb first, fixable in place. */
export function ChecksSheet() {
  const { state, dispatch, issues, goTo, locked, openSheet, ...app } = useApp();
  const recheck = useRecheck();
  const server = state.server!;
  const target = server.target!;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const type = typeOf(server.registry, app.view?.effective.schema?.type);

  const where = (jump: Jump) => {
    const key = jump.field.match(/^schema\.props\.(.+)$/)?.[1];
    // A value inside hand-added JSON-LD: named by its path.
    if (jump.at) {
      return `${jump.at.path} in ${jump.field === 'schema.custom' ? 'your own JSON-LD' : 'the added details'}`;
    }
    return (
      type.props
        ?.find((prop) => prop.key === key)
        ?.label.toLowerCase() ??
      type.groups?.[key ?? '']?.label?.toLowerCase() ??
      FIELDS.find(([pattern]) => pattern.test(jump.field))?.[1] ??
      'field'
    );
  };

  /** `titleId`: the row's sentence, which describes its Show. */
  const actions = (issue: Issue, titleId: string) => {
    const { fix, jump } = issue;
    return (
      <>
        {fix && 'apply' in fix && !locked.target && (
          <Btn
            variant="soft"
            onClick={(event) => {
              // The fixed row goes with its button: focus moves on to the
              // next row of its group, on its sentence, never onto the same
              // action there; else to the summary.
              const row = event.currentTarget.closest('li');
              const rows = Array.from(
                row?.parentElement?.querySelectorAll(':scope > li') ?? [],
              );
              const next = rows[rows.indexOf(row!) + 1]?.querySelector<HTMLElement>('.seo-check-title');
              dispatch({
                type: 'apply',
                scope: 'target',
                values: fix.apply(state.edits.target),
                undo: fix.undo?.(state.edits.target) ?? fixedText(fix.label),
              });
              requestAnimationFrame(() =>
                (next?.isConnected ? next : heading.current)?.focus(),
              );
            }}
          >
            {fix.label}
          </Btn>
        )}
        {fix && 'suggest' in fix && jump && (
          <Btn
            variant="soft"
            aria-label={`Suggest a ${where(jump)}`}
            aria-description={AI_SENDS}
            onClick={() => goTo(jump, { suggest: true })}
          >
            <SparkleIcon />
            Suggest
          </Btn>
        )}
        {fix && 'image' in fix && !locked.target && (
          <Btn
            variant="soft"
            aria-describedby={titleId}
            onClick={() =>
              openSheet({
                kind: 'image',
                request: {
                  minWidth: 600,
                  chosen: undefined,
                  onPick: (value) => dispatch({ type: 'edit', scope: 'target', path: fix.image, value }),
                },
              })
            }
          >
            {fix.label}
          </Btn>
        )}
        {issue.recheck && (
          <Btn
            variant="ghost"
            aria-describedby={titleId}
            onClick={() => recheck(issue.id)}
          >
            {issue.recheck}
          </Btn>
        )}
        {fix && 'link' in fix && jump && (
          <Btn
            variant="soft"
            aria-describedby={titleId}
            onClick={() => goTo(jump, { link: true })}
          >
            {fix.label}
          </Btn>
        )}
        {jump && !(fix && 'link' in fix) && (
          <Btn
            variant="ghost"
            // Named for its field, described by its issue: several issues
            // can lead to one field.
            aria-label={`Show ${where(jump)}`}
            aria-describedby={titleId}
            onClick={() => goTo(jump)}
          >
            Show
          </Btn>
        )}
      </>
    );
  };

  const counted = issues.filter((issue) => issue.severity !== 'info');
  const info = issues.filter((issue) => issue.severity === 'info');
  return (
    <>
      <h3 className="seo-checks-sum" ref={heading} tabIndex={-1}>
        {summary(issues)}
      </h3>
      {target.scope === 'template' && (
        // One line, however long the node's title: whole on hover.
        <p
          className="seo-meta seo-checks-against"
          title={server.preview?.label}
        >
          Checked against <em dir="auto">{server.preview?.label ?? ''}</em>
        </p>
      )}
      {counted.length === 0 && info.length === 0 && (
        <p className="seo-sheet-intro">
          Everything this dialog can check looks right.
        </p>
      )}
      {GROUPS.map((group) => {
        const rows = issues.filter(
          (issue) => issue.severity === group.severity,
        );
        return (
          rows.length > 0 && (
            <section
              key={group.severity}
              className="seo-checks-group"
              aria-labelledby={`seo-checks-${group.severity}`}
            >
              <h4 id={`seo-checks-${group.severity}`}>{group.label}</h4>
              <ul>
                {rows.map((issue, index) => (
                  <li key={issue.id} className="seo-check">
                    <span className="seo-check-mark" aria-hidden>
                      {issue.severity === 'info' ? (
                        <InfoCircledIcon />
                      ) : (
                        <span
                          className="seo-dot"
                          data-tone={issue.severity === 'fix' ? 'red' : 'amber'}
                        />
                      )}
                    </span>
                    <div>
                      <p
                        className="seo-check-title"
                        id={`seo-check-${group.severity}-${index}`}
                        tabIndex={-1}
                      >
                        {issue.message}
                      </p>
                      {issue.detail && (
                        <p className="seo-check-detail">{issue.detail}</p>
                      )}
                      <div className="seo-check-actions">
                        {actions(issue, `seo-check-${group.severity}-${index}`)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        );
      })}
    </>
  );
}
