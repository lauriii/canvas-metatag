import { Pencil1Icon, ReloadIcon } from '@radix-ui/react-icons';
import { CheckboxGroup, RadioGroup } from '@radix-ui/themes';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

import { ApiError } from '../api';
import { useApp } from '../App';
import {
  AI_SENDS,
  aiError,
  article,
  kindOfType,
  meter,
  proposalLossText,
  removed,
  texts,
} from '../model';
import type {
  SchemaSuggestion,
  SeoValues,
  SuggestField,
  Texts,
} from '../types';
import { Btn, IconBtn, Sk, SparkleIcon, reveal } from './ui';

type Failure = ReturnType<typeof aiError>;

const failure = (error: unknown, refined = false): Failure =>
  aiError(error instanceof ApiError ? error.code : null, refined);

const DISCLOSURE = "Written by AI from this page's text. Check the facts.";
const TIP = "Suggest with AI · sends this page's text to the AI service";

/** Suggestions are offered at page scope, to people who can use them, when AI can work. */
export function useAi(): boolean {
  const { state, locked } = useApp();
  return (
    state.server?.capabilities.ai?.available === true &&
    state.server.target?.scope === 'page' &&
    !locked.target
  );
}

/** The sparkle in a field. Not rendered when AI cannot work. */
export function SuggestIcon(props: {
  id: string;
  label: string;
  open: boolean;
  onClick(): void;
}) {
  if (!useAi()) {
    return null;
  }
  return (
    <IconBtn
      id={props.id}
      label={props.label}
      tip={TIP}
      side="bottom"
      ai
      aria-description={AI_SENDS}
      aria-expanded={props.open}
      onClick={props.onClick}
    >
      <SparkleIcon />
    </IconBtn>
  );
}

/** "✦ Suggest" as text: on the link preview and beside the page type. */
export function SuggestButton(props: {
  id: string;
  label: string;
  open: boolean;
  variant?: 'ghost' | 'soft';
  onClick(): void;
}) {
  if (!useAi()) {
    return null;
  }
  return (
    <Btn
      id={props.id}
      variant={props.variant ?? 'soft'}
      size={props.variant === 'ghost' ? 24 : 32}
      aria-label={props.label}
      aria-description={AI_SENDS}
      aria-expanded={props.open}
      onClick={props.onClick}
    >
      <SparkleIcon />
      Suggest
    </Btn>
  );
}

/** What a request describes: the page as Checks already read it. */
function usePage() {
  const { state, view } = useApp();
  const end = view?.texts.title_end ?? '';
  return {
    langcode: state.server!.langcode,
    page: {
      title: view?.facts.title?.value ?? '',
      site: view?.facts.site?.value ?? '',
      text: (state.facts?.text ?? '').slice(0, 12000),
      // What is added after the title's main part: its length counts.
      ending: end ? `${state.server!.separator} ${end}` : '',
    },
  };
}

/** The inline tray: it grows under its field and never covers the next one. */
function Tray(props: {
  /** The control that opened it: closing returns focus there. */
  opener: string;
  /** Something written by AI is shown: the disclosure follows it. */
  written: boolean;
  onClose(): void;
  children: ReactNode;
}) {
  const { setTrial } = useApp();
  const tray = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = tray.current;
    element?.focus({ preventScroll: true });
    // It grows as it unfolds and when the options arrive: its last line
    // stays in view as it does.
    const observer = new ResizeObserver(() => reveal(element));
    if (element) {
      // The wrap animates open; the tray inside changes with its content.
      observer.observe(element);
      observer.observe(element.closest('.seo-tray-wrap') ?? element);
    }
    return () => {
      observer.disconnect();
      setTrial(null);
      const opener = document.getElementById(props.opener);
      opener?.focus({ preventScroll: true });
      // After the tray has gone: the opener may sit above the fold.
      requestAnimationFrame(() => reveal(opener));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="seo-tray-wrap">
      <div>
        <div
          ref={tray}
          className="seo-tray"
          role="group"
          aria-label="Suggestions"
          tabIndex={-1}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === 'Escape' && !event.defaultPrevented) {
              event.stopPropagation();
              props.onClose();
            }
          }}
        >
          {props.children}
          {props.written && <p className="seo-tray-note">{DISCLOSURE}</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * A failure that asking again would only repeat: the sentence and Dismiss.
 * The button that asked may have gone with it, so focus goes back to the
 * tray, which holds the sentence.
 */
function Final(props: { text: string; onClose(): void }) {
  const message = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const tray = message.current?.closest<HTMLElement>('.seo-tray');
    const active = document.activeElement;
    if (tray && (active === document.body || tray.contains(active))) {
      tray.focus({ preventScroll: true });
    }
  }, []);
  return (
    <>
      <p
        ref={message}
        className="seo-tray-message"
        data-tone="error"
        role="alert"
      >
        {props.text}
      </p>
      <div className="seo-tray-foot">
        <Btn variant="soft" onClick={props.onClose}>
          Dismiss
        </Btn>
      </div>
    </>
  );
}

const Working = () => (
  <div className="seo-tray-working" aria-busy="true">
    <Sk w="100%" h={20} />
    <Sk w="86%" h={20} />
    <Sk w="92%" h={20} />
    <span className="seo-meta" role="status">
      Writing suggestions from this page's text…
    </span>
  </div>
);

/**
 * Three variants for a title, a description, or a link card (title and
 * description together). Nothing is written until "Use".
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
  const [message, setMessage] = useState<Failure>(aiError(null));
  const [selected, setSelected] = useState(0);
  const [hint, setHint] = useState('');
  const [refining, setRefining] = useState(false);
  const calls = useRef(0);
  const list = useRef<HTMLDivElement>(null);
  /** The four texts as they would read with a variant applied. */
  const applied = (variant: Partial<Record<SuggestField, string>>): Texts =>
    texts(
      {
        ...view.effective,
        // A title variant is the main part: the ending stays.
        ...(variant.title !== undefined ? { title: { text: variant.title } } : {}),
        social: {
          ...view.effective.social,
          ...(variant['social.title'] !== undefined
            ? { title: { text: variant['social.title'] } }
            : {}),
          ...(variant['social.description'] !== undefined
            ? { description: { text: variant['social.description'] } }
            : {}),
        },
      },
      // A page's description is Canvas's own: its Description fact.
      (value) =>
        variant.description !== undefined && 'fact' in value && value.fact === 'description'
          ? variant.description
          : view.text(value),
      server.separator,
      server.site.values.title_end,
    );

  const ask = () => {
    const mine = ++calls.current;
    const refined = hint.trim() !== '';
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
            // The title's ending is sent on its own (page.ending): the
            // current title is its main part.
            field === 'title'
              ? view.texts.title_main
              : view.texts[field.replace('.', '_') as keyof Texts],
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
            setMessage(aiError('invalid_response'));
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
            setMessage(failure(error, refined));
            setPhase('error');
          }
        },
      );
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(ask, []);

  // The previews show the chosen variant, so it can be judged in place.
  const shown = phase === 'ready' ? variants[selected] : undefined;
  useEffect(() => {
    setTrial(shown ? { ...applied(shown), index: selected + 1 } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  // Focus goes to the options when they arrive, unless the user went elsewhere.
  useEffect(() => {
    const tray = list.current?.closest('.seo-tray');
    if (phase === 'ready' && document.activeElement === tray) {
      list.current
        ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
        ?.focus({ preventScroll: true });
    }
  }, [phase]);

  const count = (variant: Partial<Record<SuggestField, string>>) => {
    const kind =
      variant.title !== undefined
        ? 'title'
        : variant.description !== undefined
          ? 'description'
          : null;
    return kind ? meter(kind, applied(variant)[kind], measurer) : null;
  };

  if (phase === 'error' && !message.retry) {
    return (
      <Tray opener={props.opener} written={false} onClose={props.onClose}>
        <Final text={message.text} onClose={props.onClose} />
      </Tray>
    );
  }

  return (
    <Tray
      opener={props.opener}
      written={phase === 'ready'}
      onClose={props.onClose}
    >
      {/* An error tray holds one message. */}
      {phase !== 'error' && (state.facts?.text.trim().length ?? 0) < 200 && (
        <p className="seo-tray-note" data-tone="improve">
          There is not much text on this page yet, so these may be generic.
        </p>
      )}
      {phase === 'working' && <Working />}
      {phase === 'error' && (
        <p className="seo-tray-message" data-tone="error" role="alert">
          {message.text}
        </p>
      )}
      {phase === 'ready' && (
        <RadioGroup.Root
          ref={list}
          size="2"
          aria-label="Suggestions"
          value={String(selected)}
          onValueChange={(value) => setSelected(Number(value))}
          // Selection follows focus: the arrows try each one in the preview.
          onFocus={(event) => {
            const value = (event.target as HTMLElement).getAttribute('value');
            if (value !== null && Number(value) !== selected) {
              setSelected(Number(value));
            }
          }}
          className="seo-tray-options"
        >
          {variants.map((variant, index) => {
            const result = count(variant);
            return (
              <RadioGroup.Item
                key={index}
                value={String(index)}
                className="seo-tray-option"
                // The count as words, not as a number in the option's name.
                aria-description={
                  result
                    ? `${result.chars} ${result.chars === 1 ? 'character' : 'characters'}`
                    : undefined
                }
              >
                <span className="seo-tray-text" lang={server.langcode}>
                  {props.fields.map((field, at) =>
                    props.fields.length > 1 && at === 0 ? (
                      <b key={field}>{variant[field]}</b>
                    ) : (
                      <span key={field}>{variant[field]}</span>
                    ),
                  )}
                </span>
                {result && (
                  <span
                    className="seo-tray-count"
                    aria-hidden
                    data-long={result.state === 'long' || undefined}
                  >
                    {result.chars}
                  </span>
                )}
              </RadioGroup.Item>
            );
          })}
        </RadioGroup.Root>
      )}
      {refining && (
        <div className="seo-tray-refine">
          <input
            className="seo-input"
            dir="auto"
            aria-label="Refine"
            placeholder="Shorter, mention the free pilot…"
            maxLength={200}
            autoFocus
            value={hint}
            onChange={(event) => setHint(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && phase !== 'working') {
                ask();
              }
            }}
          />
        </div>
      )}
      <div className="seo-tray-foot">
        {!refining && (
          <Btn variant="ghost" onClick={() => setRefining(true)}>
            <Pencil1Icon aria-hidden />
            Refine
          </Btn>
        )}
        <span className="seo-bar-actions">
          <Btn
            variant="soft"
            // Not `disabled`: a disabled button drops the focus it has.
            aria-disabled={phase === 'working'}
            onClick={() => phase !== 'working' && ask()}
          >
            <ReloadIcon aria-hidden />
            Try again
          </Btn>
          {phase === 'ready' && (
            <Btn
              variant="solid"
              onClick={() => {
                if (props.onUse(variants[selected])) {
                  props.onClose();
                } else {
                  setMessage({
                    text: "The editor didn't take the text. Try again.",
                    retry: true,
                  });
                  setPhase('error');
                }
              }}
            >
              Use
            </Btn>
          )}
        </span>
      </div>
    </Tray>
  );
}

/** One proposal for the page type and its details. Nothing is applied without "Use selected". */
export function SchemaSuggest(props: { opener: string; onClose(): void }) {
  const { state, api, dispatch, view } = useApp();
  const request = usePage();
  const [phase, setPhase] = useState<'working' | 'ready' | 'error'>('working');
  const [proposal, setProposal] = useState<SchemaSuggestion | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [message, setMessage] = useState<Failure>(aiError(null));
  // Another type drops the details of the current one: asked first, as a
  // change of type by hand is. The details it removes, named.
  const [dropping, setDropping] = useState<string[]>([]);
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
          // No Refine text to change in this tray.
          setMessage(failure(error));
          setPhase('error');
        }
      },
    );
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(ask, []);

  // Focus goes to the first detail when the proposal arrives, as with options.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tray = box.current?.closest('.seo-tray');
    if (phase === 'ready' && document.activeElement === tray) {
      box.current?.querySelector<HTMLElement>('button')?.focus();
    }
  }, [phase]);

  const server = state.server!;
  const registry = server.registry;
  const type = proposal ? registry[proposal.type] : undefined;
  const props_ = type?.props ?? [];
  // Only what was found on the page is offered; the rest is counted.
  const keys = Object.keys(proposal?.props ?? {}).filter((key) => !proposal?.unverified.includes(key));
  const guesses = proposal?.unverified.length ?? 0;
  // Facts the kind needs that are for people to fill in, not yet set.
  const own = state.edits.target.schema?.props ?? {};
  const yours = props_.filter(
    (prop) => (prop.level === 'required' || type?.main?.includes(prop.key)) && (prop.kind !== 'text' || prop.ai === false) && prop.kind !== 'image' && own[prop.key] === undefined,
  );
  const nothing = phase === 'ready' && (!type || !type.primary_type);
  const kindName = (id: string) => {
    const entry = registry[id];
    return entry?.kind?.name ?? (entry ? `${article(entry.label)} ${entry.label.toLowerCase()}` : 'a web page');
  };

  const currentName = kindName(kindOfType(registry, view?.effective.schema?.type));
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
    const lost = removed(server, state.edits.target, proposal.type, server.ui);
    if (lost.length > 0 && !confirmed) {
      setDropping(lost);
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
            ticked.map((key) => [key, { text: proposal.props[key] }]),
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
    <Tray
      opener={props.opener}
      written={phase === 'ready' && !nothing}
      onClose={props.onClose}
    >
      {phase === 'working' && <Working />}
      {phase === 'error' && !message.retry && (
        <Final text={message.text} onClose={props.onClose} />
      )}
      {phase === 'error' && message.retry && (
        <>
          <p className="seo-tray-message" data-tone="error" role="alert">
            {message.text}
          </p>
          <div className="seo-tray-foot">
            <Btn variant="soft" onClick={ask}>
              <ReloadIcon aria-hidden />
              Try again
            </Btn>
          </div>
        </>
      )}
      {nothing && (
        <>
          <p className="seo-tray-message">
            This already looks right: {type?.kind?.label ?? type?.label ?? 'A web page'}.
          </p>
          <div className="seo-tray-foot">
            <Btn variant="soft" onClick={props.onClose}>
              Dismiss
            </Btn>
          </div>
        </>
      )}
      {phase === 'ready' && proposal && type && !nothing && (
        <div className="seo-tray-proposal" ref={box}>
          <p className="seo-tray-message">This looks like {kindName(proposal.type)}.</p>
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
                    <b>{prop?.label ?? key}</b>
                    <span lang={request.langcode}>{value}</span>
                  </span>
                </CheckboxGroup.Item>
              );
            })}
          </CheckboxGroup.Root>
          {yours.length > 0 && (
            <>
              <ul className="seo-proposal-yours">
                {yours.map((prop) => (
                  <li key={prop.key}>
                    <b>{prop.label}</b> · Add it yourself
                  </li>
                ))}
              </ul>
              <p className="seo-tray-note">AI doesn't fill in dates, prices or authors.</p>
            </>
          )}
          {guesses > 0 && (
            <p className="seo-tray-note">
              {guesses === 1 ? "1 more guess wasn't found on the page." : `${guesses} more guesses weren't found on the page.`}
            </p>
          )}
          {dropping.length > 0 && (
            <p className="seo-tray-note" data-tone="improve" role="alert">
              {proposalLossText(dropping)}
            </p>
          )}
          <div className="seo-tray-foot">
            <span className="seo-bar-actions">
              <Btn variant="soft" onClick={props.onClose}>
                {dropping.length > 0 ? `Keep ${currentName}` : 'Dismiss'}
              </Btn>
              <Btn variant="solid" onClick={() => use(dropping.length > 0)}>
                Use selected
              </Btn>
            </span>
          </div>
        </div>
      )}
    </Tray>
  );
}
