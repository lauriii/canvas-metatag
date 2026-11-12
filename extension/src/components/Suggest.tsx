import { Cross2Icon, MagicWandIcon } from '@radix-ui/react-icons';
import {
  Button,
  Card,
  CheckboxGroup,
  Flex,
  IconButton,
  RadioGroup,
  Skeleton,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { ApiError } from '../api';
import { useApp } from '../App';
import {
  REGISTRY,
  article,
  dateText,
  inherited,
  meter,
  seedTitle,
  texts,
} from '../model';
import type {
  SchemaSuggestion,
  SeoValues,
  SuggestField,
  Texts,
} from '../types';

const ERRORS: Record<string, string> = {
  ai_not_configured: "AI suggestions aren't set up on this site yet.",
  blocked: "This text can't be sent to the AI service.",
  rate_limited: 'The AI service is busy. Try again in a minute.',
  quota_exceeded:
    "The site's AI allowance is used up. Ask a site administrator.",
  invalid_response: "The AI answer couldn't be used. Try again.",
};
const errorText = (error: unknown) =>
  (error instanceof ApiError && ERRORS[error.code]) ||
  "The AI service didn't answer. Try again.";

const DISCLOSURE = "Written by AI from this page's text. Check the facts.";

/** Suggestions are offered at page scope, to people who can use them, when AI can work. */
export function useAi(): boolean {
  const { state, locked } = useApp();
  return (
    state.server?.capabilities.ai?.available === true &&
    state.server.target?.scope === 'page' &&
    !locked.target
  );
}

/** The one control that opens a suggestion panel. Not rendered when AI cannot work. */
export function SuggestButton(props: {
  id: string;
  label: string;
  open: boolean;
  onClick(): void;
}) {
  if (!useAi()) {
    return null;
  }
  return (
    <Tooltip content={`${props.label} (sends this page's text to the AI service)`}>
      <IconButton
        id={props.id}
        size="1"
        variant="ghost"
        aria-label={props.label}
        aria-description="Sends this page's text to the AI service."
        aria-expanded={props.open}
        onClick={props.onClick}
      >
        <MagicWandIcon aria-hidden />
      </IconButton>
    </Tooltip>
  );
}

/** What a request describes: the page as Checks already read it. */
function usePage() {
  const { state, view } = useApp();
  return {
    langcode: state.server!.langcode,
    page: {
      title: view?.values.title ?? '',
      site: view?.values.site ?? '',
      text: (state.facts?.text ?? '').slice(0, 12000),
    },
  };
}

function Panel(props: {
  title: string;
  /** The control that opened it: closing returns focus there. */
  opener: string;
  onClose(): void;
  children: ReactNode;
}) {
  const { setTrial } = useApp();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ block: 'nearest' });
    return () => {
      setTrial(null);
      document.getElementById(props.opener)?.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Card
      ref={panel}
      className="seo-suggest"
      role="group"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          props.onClose();
        }
      }}
    >
      <Flex justify="between" align="center" mb="2">
        <Text as="div" size="1" weight="medium" id={titleId}>
          {props.title}
        </Text>
        <IconButton
          size="1"
          variant="ghost"
          color="gray"
          aria-label="Close suggestions"
          onClick={props.onClose}
        >
          <Cross2Icon aria-hidden />
        </IconButton>
      </Flex>
      {props.children}
      <Text as="p" size="1" color="gray" mt="3">
        {DISCLOSURE}
      </Text>
    </Card>
  );
}

const Working = () => (
  <Flex direction="column" gap="2" aria-busy="true">
    <Skeleton height="36px" />
    <Skeleton height="36px" />
    <Skeleton height="36px" />
    <Text as="p" size="1" color="gray" role="status">
      Writing suggestions from this page's text, sent to the AI service…
    </Text>
  </Flex>
);

/**
 * Three variants for a title, a description, or a social card (title and
 * description together). Nothing is written until "Use this".
 */
export function TextSuggest(props: {
  fields: SuggestField[];
  opener: string;
  /** Writes the variant into its field. False: the editor did not take it. */
  onUse(variant: Partial<Record<SuggestField, string>>): boolean;
  onClose(): void;
}) {
  const { state, api, measurer, setTrial, ...app } = useApp();
  const view = app.view!;
  const server = state.server!;
  const request = usePage();
  const [phase, setPhase] = useState<'working' | 'ready' | 'error'>('working');
  const [variants, setVariants] = useState<
    Partial<Record<SuggestField, string>>[]
  >([]);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(0);
  const [hint, setHint] = useState('');
  const calls = useRef(0);
  const list = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const pattern = String(inherited(server, 'target', 'title') ?? '');

  /** The four texts as they would read with a variant applied. */
  const applied = (variant: Partial<Record<SuggestField, string>>): Texts =>
    texts(
      {
        ...view.effective,
        ...(variant.title !== undefined
          ? { title: seedTitle(pattern, variant.title) }
          : {}),
        social: {
          ...view.effective.social,
          ...(variant['social.title'] !== undefined
            ? { title: variant['social.title'] }
            : {}),
          ...(variant['social.description'] !== undefined
            ? { description: variant['social.description'] }
            : {}),
        },
      },
      variant.description !== undefined
        ? { ...view.values, description: variant.description }
        : view.values,
    );

  const ask = () => {
    const mine = ++calls.current;
    setPhase('working');
    setTrial(null);
    api
      .suggest({
        task: 'text',
        fields: props.fields,
        count: 3,
        current: Object.fromEntries(
          props.fields.map((field) => [
            field,
            view.texts[field.replace('.', '_') as keyof Texts],
          ]),
        ),
        hint: hint.trim(),
        ...request,
      })
      .then(
        ({ suggestions }) => {
          if (mine !== calls.current) {
            return;
          }
          // Variants with the same index form one card.
          const count = Math.min(
            ...props.fields.map((field) => suggestions[field]?.length ?? 0),
          );
          if (count === 0) {
            setMessage(ERRORS.invalid_response);
            setPhase('error');
            return;
          }
          setVariants(
            Array.from({ length: count }, (_, index) =>
              Object.fromEntries(
                props.fields.map((field) => [
                  field,
                  suggestions[field]![index],
                ]),
              ),
            ),
          );
          setSelected(0);
          setPhase('ready');
        },
        (error) => {
          if (mine === calls.current) {
            setMessage(errorText(error));
            setPhase('error');
          }
        },
      );
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(ask, []);

  // The previews show the highlighted variant, so it can be judged in place.
  const shown = phase === 'ready' ? variants[selected] : undefined;
  useEffect(() => {
    setTrial(shown ? applied(shown) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  // Focus goes to the variants when they arrive, unless the user went elsewhere.
  useEffect(() => {
    const panel = list.current?.closest('.seo-suggest');
    if (phase === 'ready' && document.activeElement === panel) {
      list.current
        ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
        ?.focus({ preventScroll: true });
    }
  }, [phase]);

  const verdict = (variant: Partial<Record<SuggestField, string>>) => {
    const kind =
      variant.title !== undefined
        ? 'title'
        : variant.description !== undefined
          ? 'description'
          : null;
    if (!kind) {
      return '';
    }
    const result = meter(kind, applied(variant)[kind], measurer);
    return `${result.chars}${
      result.state === 'fits'
        ? ' · fits'
        : result.state === 'long'
          ? ' · may be cut off'
          : ''
    }`;
  };

  return (
    <Panel title="Suggestions" opener={props.opener} onClose={props.onClose}>
      {(state.facts?.text.trim().length ?? 0) < 200 && (
        <Text as="p" size="1" color="gray" mb="2">
          There is not much text on this page yet, so these may be generic.
        </Text>
      )}
      {phase === 'working' && <Working />}
      {phase === 'error' && (
        <Text as="p" size="2" role="alert" mb="2">
          {message}
        </Text>
      )}
      {phase === 'ready' && (
        <RadioGroup.Root
          ref={list}
          size="2"
          aria-label="Suggestions"
          value={String(selected)}
          onValueChange={(value) => setSelected(Number(value))}
          className="seo-variants"
        >
          {variants.map((variant, index) => (
            <RadioGroup.Item key={index} value={String(index)}>
              <span className="seo-variant" lang={server.langcode}>
                {props.fields.map((field, at) => (
                  <Text
                    as="span"
                    key={field}
                    size="2"
                    weight={
                      props.fields.length > 1 && at === 0 ? 'medium' : 'regular'
                    }
                  >
                    {variant[field]}
                  </Text>
                ))}
                <Text as="span" size="1" color="gray" className="seo-verdict">
                  {verdict(variant)}
                </Text>
              </span>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      )}
      <Flex direction="column" gap="1" mt="3">
        <Text as="label" size="1" color="gray" htmlFor={hintId}>
          Steer it (optional)
        </Text>
        <TextField.Root
          id={hintId}
          size="2"
          maxLength={200}
          value={hint}
          onChange={(event) => setHint(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && ask()}
        />
      </Flex>
      <Flex gap="3" mt="3" align="center">
        {phase === 'ready' && (
          <Button
            size="1"
            onClick={() => {
              if (props.onUse(variants[selected])) {
                props.onClose();
              } else {
                setMessage("The editor didn't take the text. Try again.");
                setPhase('error');
              }
            }}
          >
            Use this
          </Button>
        )}
        <Button
          size="1"
          variant="soft"
          color="gray"
          // Not `disabled`: a disabled button drops the focus it has.
          aria-disabled={phase === 'working'}
          onClick={() => phase !== 'working' && ask()}
        >
          Try again
        </Button>
      </Flex>
    </Panel>
  );
}

/** One proposal for the page type and its details. Nothing is applied without "Use selected". */
export function SchemaSuggest(props: { opener: string; onClose(): void }) {
  const { state, api, dispatch, view } = useApp();
  const request = usePage();
  const [phase, setPhase] = useState<'working' | 'ready' | 'error'>('working');
  const [proposal, setProposal] = useState<SchemaSuggestion | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  // Another type drops the details of the current one: asked first, as a
  // change of type by hand is.
  const [dropping, setDropping] = useState(0);
  const calls = useRef(0);

  const ask = () => {
    const mine = ++calls.current;
    setPhase('working');
    api.suggest({ task: 'schema', ...request }).then(
      (result) => {
        if (mine !== calls.current) {
          return;
        }
        setProposal(result);
        // The server decides what is verified; the rest starts unticked.
        setTicked(
          Object.keys(result.props).filter(
            (key) => !result.unverified.includes(key),
          ),
        );
        setPhase('ready');
      },
      (error) => {
        if (mine === calls.current) {
          setMessage(errorText(error));
          setPhase('error');
        }
      },
    );
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(ask, []);

  const type = proposal ? REGISTRY[proposal.type] : undefined;
  const props_ = type?.props ?? [];
  const keys = Object.keys(proposal?.props ?? {});
  const nothing = phase === 'ready' && (!type || !type.primary_type);

  const current =
    REGISTRY[view?.effective.schema?.type ?? 'WebPage'] ?? REGISTRY.WebPage;
  const use = (confirmed: boolean) => {
    if (!proposal || !type) {
      return;
    }
    const schema = state.edits.target.schema ?? {};
    const kept = Object.fromEntries(
      Object.entries(schema.props ?? {}).filter(([key]) =>
        props_.some((prop) => prop.key === key),
      ),
    );
    const dropped =
      Object.keys(schema.props ?? {}).length - Object.keys(kept).length;
    if (dropped > 0 && !confirmed) {
      setDropping(dropped);
      return;
    }
    const values: SeoValues = {
      ...state.edits.target,
      schema: {
        ...schema,
        type: proposal.type,
        props: {
          ...kept,
          ...Object.fromEntries(
            ticked.map((key) => [key, proposal.props[key]]),
          ),
        },
      },
    };
    dispatch({
      type: 'apply',
      scope: 'target',
      values,
      undo: 'Suggestion used',
    });
    props.onClose();
  };

  return (
    <Panel title="Suggestion" opener={props.opener} onClose={props.onClose}>
      {phase === 'working' && <Working />}
      {phase === 'error' && (
        <>
          <Text as="p" size="2" role="alert" mb="3">
            {message}
          </Text>
          <Button size="1" variant="soft" color="gray" onClick={ask}>
            Try again
          </Button>
        </>
      )}
      {nothing && (
        <>
          <Text as="p" size="2" mb="3">
            This already looks right: {type?.label ?? 'Web page'}.
          </Text>
          <Button size="1" variant="soft" color="gray" onClick={props.onClose}>
            Dismiss
          </Button>
        </>
      )}
      {phase === 'ready' && proposal && type && !nothing && (
        <>
          <Text as="p" size="2" mb="2">
            This looks like {article(type.label)} {type.label}.
          </Text>
          <CheckboxGroup.Root
            size="2"
            value={ticked}
            onValueChange={setTicked}
            aria-label="Details to use"
          >
            {keys.map((key) => {
              const prop = props_.find((item) => item.key === key);
              const value = proposal.props[key];
              return (
                <CheckboxGroup.Item key={key} value={key}>
                  <span className="seo-proposal">
                    <Text as="span" size="2" weight="medium">
                      {prop?.label ?? key}
                    </Text>
                    <Text as="span" size="2" lang={request.langcode}>
                      {prop?.kind === 'date' ? dateText(value) : value}
                    </Text>
                    {proposal.unverified.includes(key) && (
                      <Text as="span" size="1" color="gray">
                        {prop?.kind === 'date'
                          ? "Dates can't be checked against the page."
                          : 'Not found on the page. Check before using.'}
                      </Text>
                    )}
                  </span>
                </CheckboxGroup.Item>
              );
            })}
          </CheckboxGroup.Root>
          {dropping > 0 && (
            <Text as="p" size="2" mt="3" role="alert">
              Using this removes {dropping} {current.label}{' '}
              {dropping === 1 ? 'detail' : 'details'}.
            </Text>
          )}
          <Flex gap="3" mt="3">
            <Button size="1" onClick={() => use(dropping > 0)}>
              Use selected
            </Button>
            <Button
              size="1"
              variant="soft"
              color="gray"
              onClick={props.onClose}
            >
              {dropping > 0 ? `Keep ${current.label}` : 'Dismiss'}
            </Button>
          </Flex>
        </>
      )}
    </Panel>
  );
}
