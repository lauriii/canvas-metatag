import {
  CheckIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon,
  MagicWandIcon,
} from '@radix-ui/react-icons';
import { Button, Flex, IconButton, Text, Tooltip } from '@radix-ui/themes';

import { useApp } from '../App';
import { REGISTRY } from '../model';
import type { Issue, Jump } from '../types';

const GROUPS = [
  {
    severity: 'fix',
    label: 'FIX',
    alt: 'To fix',
    icon: CrossCircledIcon,
    color: 'var(--red-11)',
  },
  {
    severity: 'improve',
    label: 'IMPROVE',
    alt: 'To improve',
    icon: ExclamationTriangleIcon,
    color: 'var(--amber-11)',
  },
  {
    severity: 'info',
    label: 'GOOD TO KNOW',
    alt: 'Good to know',
    icon: InfoCircledIcon,
    color: 'var(--gray-11)',
  },
] as const;

const FIELDS: [RegExp, string][] = [
  [/^title$/, 'title'],
  [/^description$/, 'description'],
  [/^canonical$/, 'canonical address'],
  [/^social\.image$/, 'image'],
  [/^social\.title$/, 'social title'],
  [/^social\.description$/, 'social description'],
  [/^robots\./, 'search visibility'],
  [/^values\./, 'Site defaults'],
  [/^identity\./, 'Site identity'],
];

/** Facts about this dialog's settings and the page preview. No score, no "passed" list. */
export function ChecksTab() {
  const { state, dispatch, issues, goTo, locked, ...app } = useApp();
  const server = state.server!;
  const target = server.target!;
  const type =
    REGISTRY[app.view?.effective.schema?.type ?? 'WebPage'] ?? REGISTRY.WebPage;

  const where = (jump: Jump) => {
    const key = jump.field.match(/^schema\.props\.(.+)$/)?.[1];
    return (
      type.props?.find((prop) => prop.key === key)?.label ??
      FIELDS.find(([pattern]) => pattern.test(jump.field))?.[1] ??
      'the field'
    );
  };

  const action = (issue: Issue) => {
    const { fix, jump } = issue;
    if (fix && 'apply' in fix) {
      return locked.target ? null : (
        <Button
          size="1"
          variant="ghost"
          onClick={(event) => {
            // The fixed row goes away with its button: focus moves on to the
            // next row's action, else to the summary.
            const list = event.currentTarget.closest('.seo-checks');
            const rows = Array.from(
              list?.querySelectorAll<HTMLElement>('.seo-issue-action button') ??
                [],
            );
            const next = rows[rows.indexOf(event.currentTarget) + 1];
            dispatch({
              type: 'apply',
              scope: 'target',
              values: fix.apply(state.edits.target),
            });
            requestAnimationFrame(() =>
              (next?.isConnected
                ? next
                : list?.querySelector<HTMLElement>('[data-summary]')
              )?.focus(),
            );
          }}
        >
          {fix.label}
        </Button>
      );
    }
    // Going to the field is always offered; an AI suggestion, an external
    // call, is the secondary action.
    return (
      <>
        {jump && (
          <Button size="1" variant="ghost" onClick={() => goTo(jump)}>
            Go to {where(jump)}
          </Button>
        )}
        {fix && jump && (
          <Tooltip content={`Suggest a ${where(jump)} with AI`}>
            <IconButton
              size="1"
              variant="ghost"
              aria-label={`Suggest a ${where(jump)} with AI`}
              onClick={() => goTo(jump, { suggest: true })}
            >
              <MagicWandIcon aria-hidden />
            </IconButton>
          </Tooltip>
        )}
      </>
    );
  };

  const count = (severity: Issue['severity']) =>
    issues.filter((issue) => issue.severity === severity).length;
  const summary = [
    count('fix') > 0 && `${count('fix')} to fix`,
    count('improve') > 0 && `${count('improve')} to improve`,
  ].filter(Boolean);

  return (
    <div className="seo-checks">
      {target.scope === 'template' && (
        <Text as="p" size="1" color="gray" mb="2">
          Checked against: {server.preview?.label ?? ''}
        </Text>
      )}
      {summary.length > 0 ? (
        <Text as="p" size="2" weight="medium" mb="3" tabIndex={-1} data-summary>
          {summary.join(' · ')}
        </Text>
      ) : (
        <Flex direction="column" align="center" gap="1" py="5">
          <Flex align="center" gap="2">
            <CheckIcon color="var(--green-11)" aria-hidden />
            <Text size="2" weight="medium" tabIndex={-1} data-summary>
              Nothing to fix
            </Text>
          </Flex>
          <Text as="p" size="2" color="gray" align="center">
            Nothing to fix in this page's SEO settings.
          </Text>
        </Flex>
      )}
      {GROUPS.map((group) => {
        const rows = issues.filter(
          (issue) => issue.severity === group.severity,
        );
        return (
          rows.length > 0 && (
            <section key={group.severity} aria-label={group.alt}>
              <Text as="div" size="1" className="seo-group-label" mb="1">
                {group.label}
              </Text>
              <ul className="seo-issues">
                {rows.map((issue) => (
                  <li key={issue.id}>
                    <group.icon
                      color={group.color}
                      role="img"
                      aria-label={group.alt}
                    />
                    <div>
                      <Text as="p" size="2" className="seo-wrap">
                        {issue.message}
                      </Text>
                      {issue.detail && (
                        <Text as="p" size="1" color="gray" className="seo-wrap">
                          {issue.detail}
                        </Text>
                      )}
                    </div>
                    <span className="seo-issue-action">{action(issue)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )
        );
      })}
      <Text as="p" size="1" color="gray" mt="4">
        These checks cover the settings in this dialog and the page preview.
        They do not check robots.txt, speed or rankings.
      </Text>
    </div>
  );
}
