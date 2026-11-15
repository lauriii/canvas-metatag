import { InfoCircledIcon } from '@radix-ui/react-icons';
import { useEffect, useRef } from 'react';

import { useApp } from '../App';
import { REGISTRY } from '../model';
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
  [/^schema\.type$/, 'type'],
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

/** Facts about this dialog's settings and the page preview. Verb first, fixable in place. */
export function ChecksSheet() {
  const { state, dispatch, issues, goTo, locked, ...app } = useApp();
  const server = state.server!;
  const target = server.target!;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const type =
    REGISTRY[app.view?.effective.schema?.type ?? 'WebPage'] ?? REGISTRY.WebPage;

  const where = (jump: Jump) => {
    const key = jump.field.match(/^schema\.props\.(.+)$/)?.[1];
    return (
      type.props
        ?.find((prop) => prop.key === key)
        ?.label.toLowerCase() ??
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
              // next row's first button, else to the summary.
              const row = event.currentTarget.closest('li');
              const rows = Array.from(
                row?.closest('.seo-body')?.querySelectorAll('li') ?? [],
              );
              const next = rows
                .slice(rows.indexOf(row!) + 1)
                .map((one) => one.querySelector('button'))
                .find(Boolean);
              dispatch({
                type: 'apply',
                scope: 'target',
                values: fix.apply(state.edits.target),
                undo: fixedText(fix.label),
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
            onClick={() => goTo(jump, { suggest: true })}
          >
            <SparkleIcon />
            Suggest
          </Btn>
        )}
        {jump && (
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
