<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\Component\Utility\Html;
use Drupal\Component\Utility\Unicode;
use Drupal\Component\Utility\UrlHelper;
use Drupal\Component\Uuid\Uuid;

/**
 * The SEO value shape: validation, canonical encoding, layers and text output.
 *
 * Static and pure. The same rules exist once more in TypeScript
 * (extension/src/model.ts and values.ts); tests/fixtures/text-cases.json pins
 * both.
 *
 * A value is a map with exactly one key: `text` (typed, never scanned),
 * `fact` (one of FACTS), `media` (a media UUID, images only) or `source` (a
 * Canvas entity-field source, templates only; see Sources).
 */
final class Values {

  /**
   * The facts every page and node has, with the kind of value each gives.
   */
  public const FACTS = [
    'title' => 'text',
    'description' => 'text',
    'site' => 'text',
    'url' => 'address',
    'author' => 'text',
    'published' => 'date',
    'modified' => 'date',
    'image' => 'image',
    'identity' => 'ref',
  ];

  /**
   * The value kind of each structured data property kind.
   */
  public const KINDS = [
    'text' => 'text',
    'url' => 'address',
    'date' => 'date',
    'number' => 'number',
    'enum' => 'text',
    'currency' => 'text',
    'image' => 'image',
    'ref' => 'ref',
    'hours' => 'hours',
  ];

  /**
   * The names custom JSON-LD strings may use. Other brace text is literal.
   */
  private const FILLED = '/\{(title|description|site|sep|url|author|published|modified|image)\}/';

  /**
   * C0, DEL and C1 controls except tab, LF and CR; bidi overrides and isolates.
   */
  private const UNSAFE = '/[\x{00}-\x{08}\x{0B}\x{0C}\x{0E}-\x{1F}\x{7F}-\x{9F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u';

  private const KEYS = [
    'page' => ['title', 'title_end', 'canonical', 'social', 'robots', 'schema'],
    'template' => ['title', 'title_end', 'description', 'social', 'robots', 'schema'],
    'site' => ['title_end', 'robots', 'schema'],
  ];

  private const PREVIEWS = ['none', 'standard', 'large'];

  private const INVALID = 'This value is not valid.';
  private const NOT_HERE = 'This setting is not available here.';
  private const IMAGE = 'Choose an image from the list.';
  private const FACT = 'Choose a value from the list.';
  private const FIELD = 'Choose a field from the list.';
  private const CUSTOM_SHAPE = 'Use one object, or a list of up to 10 objects, each with "@type".';
  private const DEEP = 'Too deeply nested (items and lists count). Keep to 8.';
  private const AT_KEYS = 'Only “@type”, “@id” and a schema.org “@context” may start with @.';

  /**
   * The bytes every hand-added text of one page shares, minified.
   */
  public const CUSTOM_MAX = 32768;

  /**
   * The bytes one hand-added text may have as written.
   */
  public const CUSTOM_RAW_MAX = 65536;

  /**
   * The flags structured data is written out with (CanvasMetatagHooks).
   */
  public const OUTPUT_FLAGS = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES
    | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR;

  /**
   * A pasted context that is schema.org's.
   */
  private const CONTEXT = '~^https?://schema\.org/?$~';

  /**
   * An added-details key that names items of a list: "offers[*]".
   *
   * Or one item by its name: "offers[name=Growth]".
   */
  public const SELECTOR = '/^[A-Za-z][A-Za-z0-9_-]*\[(\*|name=[^\]]{1,200})\]$/D';
  private const FROM_FIELD = 'This comes from a field or a component.';

  private const LITERAL = [
    'url' => 'Enter a full address that starts with https://.',
    'date' => 'Choose a date.',
    'number' => 'Enter a number, like 49 or 49.90.',
    'enum' => 'Choose one of the listed options.',
    'currency' => 'Choose a currency code from the list, such as EUR.',
    'hours' => 'Check the opening hours: times are in order and do not overlap.',
    'duration' => 'Enter a whole number, or leave it empty if you do not know it.',
    'duration_max' => 'Use at most 30 days.',
  ];

  /**
   * Validates values for one scope.
   *
   * @param array $input
   *   The sparse values object.
   * @param string $scope
   *   One of 'page', 'template', 'site'.
   * @param (callable(array, string): bool)|null $accepts
   *   Write mode: whether the template may store a source for a value of a
   *   kind. NULL for read mode: any well-shaped source is kept (it reads as
   *   broken when it cannot be read), and callers ignore the errors, because
   *   every offending key is already left out of the clean values.
   * @param string $inheritedType
   *   The structured-data type that applies when the values name none: a
   *   page translation's details belong to the type of the default one.
   * @param string|null $origin
   *   The site's public base: an absolute address on it that ends in one of
   *   the module's ids is refused as a hand-added item's @id too.
   * @param array|null $paths
   *   Set to where in hand-added JSON-LD each refusal is: field path =>
   *   {item, path (a JSON pointer inside that item)}.
   * @param array{identity?: string} $context
   *   What decides the type of a node that takes added details, besides the
   *   values themselves: the identity's kind ('organization' or 'person')
   *   the site saves with.
   *
   * @return array{0: array, 1: array<string, string>}
   *   The clean values in canonical key order, and field path => message.
   */
  public static function clean(array $input, string $scope, ?callable $accepts, string $inheritedType = 'WebPage', ?string $origin = NULL, ?array &$paths = NULL, array $context = []): array {
    $errors = [];
    $paths = [];
    $clean = [];
    $value = static function (mixed $item, string $path, string $kind, int $max = 255) use ($scope, $accepts, &$errors): ?array {
      return self::value($item, $path, $kind, $scope, $accepts, $max, $errors);
    };
    foreach ($input as $key => $item) {
      if (!in_array($key, self::KEYS[$scope] ?? [], TRUE)) {
        $errors[(string) $key] = self::NOT_HERE;
        continue;
      }
      $clean[$key] = match ($key) {
        'title', 'title_end' => $value($item, $key, 'text'),
        'description' => $value($item, 'description', 'text', 1000),
        'canonical' => self::canonical($item, $errors),
        'social' => self::social($item, $value, $errors),
        'robots' => self::robots($item, $errors),
        'schema' => self::schema($item, $value, $inheritedType, $accepts === NULL, $scope, $origin, $errors, $paths, $context),
      };
    }
    return [self::canon($clean), $errors];
  }

  /**
   * Validates the site identity.
   *
   * @return array{0: array, 1: array<string, string>}
   *   A complete identity in which every refused member has its default, and
   *   field path ('identity.<key>') => message.
   */
  public static function cleanIdentity(array $input): array {
    $errors = [];
    $clean = [
      'kind' => 'organization',
      'name' => '',
      'separator' => '|',
      'logo' => '',
      'default_image' => '',
      'same_as' => [],
    ];

    $kind = $input['kind'] ?? $clean['kind'];
    if ($kind === 'organization' || $kind === 'person') {
      $clean['kind'] = $kind;
    }
    else {
      $errors['identity.kind'] = self::LITERAL['enum'];
    }

    $name = $input['name'] ?? '';
    if (!is_string($name)) {
      $errors['identity.name'] = self::INVALID;
    }
    elseif (!self::blank($name = self::strip($name))) {
      if (mb_strlen($name) > 255) {
        $errors['identity.name'] = 'Use at most 255 characters.';
      }
      $clean['name'] = mb_substr($name, 0, 255);
    }

    $separator = $input['separator'] ?? $clean['separator'];
    $separator = is_string($separator) ? preg_replace('/^\s+|\s+$/u', '', mb_scrub($separator)) : '';
    if (preg_match('/^[^\p{L}\p{N}\p{Z}\p{C}]{1,3}$/u', $separator)) {
      $clean['separator'] = $separator;
    }
    else {
      $errors['identity.separator'] = 'Use one to three symbols, like | or –.';
    }

    foreach (['logo', 'default_image'] as $key) {
      $uuid = $input[$key] ?? '';
      if (is_string($uuid) && ($uuid === '' || Uuid::isValid($uuid))) {
        $clean[$key] = $uuid;
      }
      else {
        $errors["identity.$key"] = self::IMAGE;
      }
    }

    $same_as = $input['same_as'] ?? [];
    if (!is_array($same_as) || !array_is_list($same_as)) {
      $errors['identity.same_as'] = self::INVALID;
      $same_as = [];
    }
    foreach (array_values($same_as) as $index => $url) {
      if (is_string($url) && self::blank($url)) {
        continue;
      }
      if (count($clean['same_as']) === 10) {
        $errors["identity.same_as.$index"] = 'Use at most 10 addresses.';
        break;
      }
      if (is_string($url) && strlen($url) <= 2048 && self::isHttpUrl($url)) {
        $clean['same_as'][] = $url;
      }
      else {
        $errors["identity.same_as.$index"] = sprintf('Line %d is not a full address. Start with https://.', $index + 1);
      }
    }
    return [$clean, $errors];
  }

  /**
   * The canonical encoding: pruned, keys sorted, or NULL when nothing is left.
   */
  public static function encode(array $clean): ?string {
    $clean = self::canon($clean);
    return $clean ? self::json($clean) : NULL;
  }

  /**
   * Decodes a stored value; NULL and anything that is not an object give [].
   */
  public static function decode(?string $json): array {
    $value = json_decode($json ?? '', TRUE);
    return is_array($value) ? $value : [];
  }

  /**
   * The effective values: the target over the site layer.
   *
   * Only the title ending and the robots directives exist at site level.
   */
  public static function cascade(array $target, array $site): array {
    $effective = $target;
    if (!isset($effective['title_end']) && isset($site['title_end'])) {
      $effective['title_end'] = $site['title_end'];
    }
    $robots = ($target['robots'] ?? []) + ($site['robots'] ?? []);
    if ($robots) {
      $effective['robots'] = $robots;
    }
    return $effective;
  }

  /**
   * Fills the fixed names in a custom JSON-LD string, in one pass.
   *
   * `{title}`, `{description}`, `{site}`, `{sep}`, `{url}`, `{author}`,
   * `{published}`, `{modified}` and `{image}`. Every other brace text stays
   * as written, and a filled value is never scanned again.
   *
   * @param string $text
   *   The text.
   * @param array<string, string> $values
   *   Name => value.
   */
  public static function fillFacts(string $text, array $values): string {
    return (string) preg_replace_callback(self::FILLED, static fn (array $m): string => (string) ($values[$m[1]] ?? ''), $text);
  }

  /**
   * Output normalization.
   *
   * Control and bidi characters removed, whitespace runs collapsed to one
   * space, trimmed, then cut to $max code points, never inside a character
   * drawn as one (an emoji sequence, a flag, a letter with its marks).
   */
  public static function plain(string $text, int $max): string {
    $text = trim((string) preg_replace('/[ \t\n\r]+/', ' ', self::strip($text)), ' ');
    return self::whole($text, mb_substr($text, 0, $max));
  }

  /**
   * A cut of a text that never ends inside a character drawn as one.
   *
   * @param string $full
   *   The text.
   * @param string $cut
   *   A start of it.
   *
   * @return string
   *   The cut, without the grapheme cluster that holds the first code point
   *   past it, when the cut splits that cluster.
   */
  public static function whole(string $full, string $cut): string {
    $length = mb_strlen($cut);
    if ($length >= mb_strlen($full)) {
      return $cut;
    }
    preg_match_all('/\X/u', mb_substr($full, 0, $length + 1), $clusters);
    array_pop($clusters[0]);
    return implode('', $clusters[0]);
  }

  /**
   * The four text outputs, and the two parts of the title.
   *
   * A value that is not set, or that gives nothing for the item (an empty,
   * hidden or broken link), gives its default.
   *
   * @param array $effective
   *   The result of cascade().
   * @param callable(array): string $text
   *   The text a value gives for the item; '' for none.
   * @param string $separator
   *   The identity's separator.
   * @param array|null $siteEnd
   *   The site layer's ending: what an ending that gives nothing for the item
   *   falls back to. Not set means the site name.
   *
   * @return array{title: string, description: string, social_title: string, social_description: string, title_main: string, title_end: string}
   *   Plain text; the consumer escapes it. `title_main` and `title_end` are
   *   the parts the title is made of, as they were cut.
   */
  public static function texts(array $effective, callable $text, string $separator, ?array $siteEnd = NULL): array {
    $value = static function (?array $value, ?array $default, int $max) use ($text): string {
      $out = $value === NULL ? '' : self::cut($text($value), $max);
      return $out !== '' || $default === NULL ? $out : self::cut($text($default), $max);
    };
    $main = $value($effective['title'] ?? NULL, ['fact' => 'title'], 255);
    // Without an ending of its own, or with one that gives nothing for the
    // item, the site's; without one there, the site name. "No ending" is the
    // empty typed ending.
    $site_end = $siteEnd ?? ['fact' => 'site'];
    $ending = $effective['title_end'] ?? $site_end;
    $end = $ending === ['text' => ''] ? '' : $value($ending, $site_end, 255);
    [$title, $main, $end] = self::title($main, $end, $separator);
    $description = $value($effective['description'] ?? NULL, ['fact' => 'description'], 1000);
    $social = $effective['social'] ?? [];
    $social_description = $value($social['description'] ?? NULL, NULL, 1000);
    return [
      'title' => $title !== '' ? $title : $value(['fact' => 'site'], NULL, 255),
      'description' => $description,
      'social_title' => $value($social['title'] ?? NULL, ['fact' => 'title'], 255),
      'social_description' => $social_description !== '' ? $social_description : $description,
      'title_main' => $main,
      'title_end' => $end,
    ];
  }

  /**
   * Whether the string is an absolute http(s) URL with a host and no login.
   */
  public static function isHttpUrl(string $url): bool {
    if (!UrlHelper::isValid($url, TRUE)) {
      return FALSE;
    }
    $parts = parse_url($url);
    return is_array($parts)
      && in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], TRUE)
      && ($parts['host'] ?? '') !== ''
      && !isset($parts['user'])
      && !isset($parts['pass']);
  }

  /**
   * Formatted text as plain text.
   *
   * The content of elements that never display (script, style, template,
   * also nested templates) removed, then tags stripped, entities decoded
   * once, whitespace collapsed. A heading, list item, definition, table row
   * or caption ends a sentence, as does the text before a list or a heading:
   * a full stop follows it unless it ends in a stop, an ellipsis, a question
   * or exclamation mark, a colon, semicolon or comma, or their equivalents in
   * other scripts (closing quotes and brackets after it included). Such an
   * element with no text of its own still ends the text before it. An opening
   * tag may hold ">" in a quoted attribute. Should a markup pattern fail, the
   * text is kept as it was; text that is not valid UTF-8 gives an empty
   * string.
   */
  public static function fromHtml(string $html): string {
    if (!mb_check_encoding($html, 'UTF-8')) {
      return '';
    }
    // The end of a sentence. Entities never decode to a control character,
    // so only the text's own need removing.
    $end = "\x01";
    $html = str_replace($end, '', $html);
    $attributes = '(?:"[^"]*+"|\'[^\']*+\'|[^\'">]++)*+';
    $html = preg_replace('~<(script|style)\b' . $attributes . '>(?:[^<]++|<(?!/\1\s*>))*+(?:</\1\s*>|\z)~i', ' ', $html) ?? $html;
    $html = preg_replace('~<template\b' . $attributes . '>(?:[^<]++|(?R)|<(?!/?template\b))*+(?:</template\s*>|\z)~i', ' ', $html) ?? $html;
    $html = preg_replace('~</(?:h[1-6]|li|dd|tr|caption)\s*>|<(?:ul|ol|dl|h[1-6])(?=[\s\/>])~i', $end . '$0', $html) ?? $html;
    // A space keeps the words of neighboring blocks apart; inline markup
    // joins its words as written.
    $html = preg_replace('~<(?=/?(?:p|div|br|li|ul|ol|h[1-6]|td|th|tr|blockquote|pre|hr|dt|dd|section|article|figure|figcaption)[\s\/>])~i', ' <', $html) ?? $html;
    $text = Html::decodeEntities(strip_tags($html));
    // Nested ends are one end; after a sentence or clause mark, or with
    // nothing before it, an end adds nothing; else a full stop.
    $ends = '[.!?…:;,。！？、，．：；｡؟۔।॥،؛][\p{Pe}\p{Pf}"\'»]*';
    // Should this fail, no mark is left in the text.
    $text = preg_replace(['/\s*\x01(?:\s*\x01)*/u', "/(^|$ends)\x01/u", '/\x01/'], [$end, '$1', '.'], $text) ?? str_replace($end, ' ', $text);
    return trim((string) preg_replace('/\s+/u', ' ', $text));
  }

  /**
   * The items of one formatted text, for a list.
   *
   * Its list items, else its paragraphs, each as plain text (fromHtml()).
   * Text with neither is one item. A list item's nested list stays part of
   * it.
   *
   * @return list<string>
   *   The items in order, without empty ones.
   */
  public static function items(string $html): array {
    if (!mb_check_encoding($html, 'UTF-8')) {
      return [];
    }
    $parts = [];
    foreach (['li', 'p'] as $tag) {
      // Only the outermost elements: a nested list is part of its item.
      $depth = 0;
      $start = 0;
      preg_match_all("~<(/?)$tag\\b[^>]*>~i", $html, $tags, PREG_OFFSET_CAPTURE);
      foreach ($tags[0] as $at => [$tag_text, $offset]) {
        if ($tags[1][$at][0] === '') {
          if ($depth++ === 0) {
            $start = $offset + strlen($tag_text);
          }
        }
        elseif ($depth > 0 && --$depth === 0) {
          $parts[] = substr($html, $start, $offset - $start);
        }
      }
      if ($parts !== []) {
        break;
      }
    }
    // An item is read without its own element, so no full stop is added.
    $items = array_map(static fn (string $part): string => self::fromHtml($part), $parts ?: [$html]);
    return array_values(array_filter($items, static fn (string $item): bool => $item !== ''));
  }

  /**
   * The start of a text read from formatted text.
   *
   * 160 characters at most, cut at a word boundary, never inside a character
   * drawn as one.
   */
  public static function excerpt(string $text): string {
    return rtrim(self::whole($text, Unicode::truncate($text, 160, TRUE)));
  }

  /**
   * A head text: plain(), ending at a word when one ends near the limit.
   *
   * A cut inside a word backs up to the last space when that space is within
   * the last tenth of the limit; otherwise the plain() cut stands.
   */
  private static function cut(string $text, int $max): string {
    $full = self::plain($text, PHP_INT_MAX);
    $cut = self::plain($full, $max);
    if ($cut === $full || str_ends_with($cut, ' ') || ($full[strlen($cut)] ?? '') === ' ') {
      return rtrim($cut, ' ');
    }
    $space = mb_strrpos($cut, ' ');
    return $space !== FALSE && $space >= $max - intdiv($max, 10) ? mb_substr($cut, 0, $space) : $cut;
  }

  /**
   * Joins the title's parts; an empty part goes with its separator.
   *
   * Over 255 characters the main part is shortened, by the rules of cut(),
   * so that the ending stays whole.
   *
   * @return array{string, string, string}
   *   The title, and its main part and ending as used.
   */
  private static function title(string $main, string $end, string $separator): array {
    if ($main === '' || $end === '') {
      return [$main . $end, $main, $end];
    }
    $glue = ' ' . self::plain($separator, 3) . ' ';
    $room = 255 - mb_strlen($glue) - mb_strlen($end);
    if (mb_strlen($main) > $room) {
      $main = $room > 0 ? self::cut($main, $room) : '';
    }
    return $main === '' ? [$end, '', $end] : [$main . $glue . $end, $main, $end];
  }

  /**
   * Removes the characters that must never be stored or emitted.
   */
  private static function strip(string $text): string {
    return (string) preg_replace(self::UNSAFE, '', mb_scrub($text));
  }

  /**
   * Whether the text is empty or only whitespace.
   */
  private static function blank(string $text): bool {
    return (bool) preg_match('/^[\s\x{FEFF}]*$/u', $text);
  }

  /**
   * The one JSON encoding of stored values.
   */
  private static function json(mixed $value): string {
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
  }

  /**
   * Prunes empties and sorts map keys recursively; lists keep their order.
   */
  private static function canon(array $values): array {
    foreach ($values as $key => $value) {
      // The empty values that are stored: "No ending", and "Someone else"
      // not named yet (schema(): an organizer or author on a Canvas page).
      if ($value === ['text' => ''] && in_array($key, ['title_end', 'organizer', 'author'], TRUE)) {
        continue;
      }
      if (is_array($value)) {
        $values[$key] = $value = self::canon($value);
      }
      if ($value === NULL || $value === [] || (is_string($value) && self::blank($value))) {
        unset($values[$key]);
      }
    }
    if (array_is_list($values)) {
      return $values;
    }
    // After a prune a list may have gaps; it is still a list.
    if (!array_filter(array_keys($values), is_string(...))) {
      return array_values($values);
    }
    ksort($values, SORT_STRING);
    return $values;
  }

  /**
   * Cleans one value. Returns NULL when there is nothing to store.
   *
   * Typed text that is too long is reported and cut, so that read mode keeps
   * the cut text.
   *
   * @param mixed $value
   *   The value as sent or stored.
   * @param string $path
   *   Its dotted path, for errors.
   * @param string $kind
   *   The kind of value its place takes: text, address, date, number or
   *   image.
   * @param string $scope
   *   One of 'page', 'template', 'site'.
   * @param callable|null $accepts
   *   See clean().
   * @param int $max
   *   The length typed text may have.
   * @param array<string, string> $errors
   *   Collects path => sentence.
   */
  private static function value(mixed $value, string $path, string $kind, string $scope, ?callable $accepts, int $max, array &$errors): ?array {
    if (!is_array($value) || count($value) !== 1) {
      $errors[$path] = self::INVALID;
      return NULL;
    }
    $key = array_key_first($value);
    $item = $value[$key];
    switch ($key) {
      case 'text':
        if ($kind === 'image') {
          $errors[$path] = self::IMAGE;
          return NULL;
        }
        if (!is_string($item)) {
          $errors[$path] = self::INVALID;
          return NULL;
        }
        $item = self::strip($item);
        // An empty ending is "No ending"; anything else empty is no value.
        if (self::blank($item)) {
          return $path === 'title_end' ? ['text' => ''] : NULL;
        }
        if (mb_strlen($item) > $max) {
          $errors[$path] = sprintf('Use at most %d characters.', $max);
          $item = mb_substr($item, 0, $max);
        }
        return ['text' => $item];

      case 'fact':
        // A page links only its ending to the site name and its structured
        // data addresses, dates and images to its own facts. The site links
        // only its ending, to the site name.
        $here = match ($scope) {
          'template' => TRUE,
          'site' => $path === 'title_end',
          default => $path === 'title_end' || (str_starts_with($path, 'schema.props.') && $kind !== 'text'),
        };
        $fits = is_string($item) && (self::FACTS[$item] ?? NULL) === $kind && ($path !== 'title_end' || $scope === 'template' || $item === 'site');
        $error = !$here ? self::NOT_HERE : (!$fits ? self::FACT : NULL);
        break;

      case 'media':
        $error = $kind !== 'image' ? self::INVALID : (is_string($item) && Uuid::isValid($item) ? NULL : self::IMAGE);
        break;

      case 'source':
        // Keys in canonical order, whatever order they came in.
        $item = Sources::wellShaped($item) ? ['expression' => $item['expression'], 'sourceType' => $item['sourceType']] : NULL;
        $error = match (TRUE) {
          $item === NULL => self::INVALID,
          $scope !== 'template' => self::NOT_HERE,
          $accepts !== NULL && !$accepts($item, $kind) => self::FIELD,
          default => NULL,
        };
        break;

      default:
        $error = $kind === 'image' ? self::IMAGE : self::INVALID;
    }
    if ($error !== NULL) {
      $errors[$path] = $error;
      return NULL;
    }
    return [$key => $item];
  }

  /**
   * A path on the public base, or an absolute http(s) URL; no fragment.
   */
  private static function canonical(mixed $value, array &$errors): ?string {
    if ($value === '') {
      return NULL;
    }
    if (is_string($value) && str_contains($value, '#')) {
      $errors['canonical'] = 'Leave out the # and everything after it.';
      return NULL;
    }
    $valid = is_string($value) && mb_strlen($value) <= 2048 && (
      // A path on the public base: one leading slash, so it can never become
      // a protocol-relative URL. The ASCII characters RFC 3986 allows in a
      // path and query, and non-ASCII text that is not a control, format or
      // space character: nothing that could end an attribute or a string.
      preg_match('~^/(?!/)(?:[A-Za-z0-9\-._\~!$&\'()*+,;=:@%/?]|[^\x00-\x7F\p{C}\p{Z}])*$~uD', $value) || self::isHttpUrl($value)
    );
    if (!$valid) {
      $errors['canonical'] = 'Enter a full address that starts with https://, or a path that starts with /.';
      return NULL;
    }
    return $value;
  }

  /**
   * Cleans the `social` map.
   */
  private static function social(mixed $value, callable $clean, array &$errors): array {
    if (!is_array($value)) {
      $errors['social'] = self::INVALID;
      return [];
    }
    $values = [];
    foreach ($value as $key => $item) {
      $path = "social.$key";
      $values[$key] = match ($key) {
        'title' => $clean($item, $path, 'text'),
        'description' => $clean($item, $path, 'text', 1000),
        'image' => $clean($item, $path, 'image'),
        default => NULL,
      };
      if (!in_array($key, ['title', 'description', 'image'], TRUE)) {
        $errors[$path] = self::NOT_HERE;
      }
    }
    return $values;
  }

  /**
   * Cleans the `robots` map: real booleans, a bounded integer, an enum.
   */
  private static function robots(mixed $value, array &$errors): array {
    if (!is_array($value)) {
      $errors['robots'] = self::INVALID;
      return [];
    }
    $clean = [];
    foreach ($value as $key => $item) {
      $error = match ($key) {
        'noindex', 'nofollow', 'nosnippet' => is_bool($item) ? NULL : self::INVALID,
        'max_snippet' => is_int($item) && $item >= -1 && $item <= 1000 ? NULL : 'Enter a number from 0 to 1000, or -1 for no limit.',
        'max_image_preview' => in_array($item, self::PREVIEWS, TRUE) ? NULL : self::LITERAL['enum'],
        default => self::NOT_HERE,
      };
      if ($error === NULL) {
        $clean[$key] = $item;
      }
      else {
        $errors["robots.$key"] = $error;
      }
    }
    return $clean;
  }

  /**
   * Cleans the `schema` map against the type registry.
   */
  private static function schema(mixed $value, callable $clean_value, string $inheritedType, bool $read, string $scope, ?string $origin, array &$errors, array &$paths, array $context = []): array {
    if (!is_array($value)) {
      $errors['schema'] = self::INVALID;
      return [];
    }
    $clean = [];
    // The site adds details to its identity, and nothing else.
    if ($scope === 'site') {
      foreach (array_diff(array_keys($value), ['extend']) as $key) {
        $errors["schema.$key"] = self::NOT_HERE;
      }
      self::own(array_intersect_key($value, ['extend' => TRUE]), $clean, 'WebPage', $scope, $read, $origin, $errors, $paths, $context);
      return $clean;
    }
    $types = SchemaGraph::types();
    $type = isset($types[$inheritedType]) ? $inheritedType : 'WebPage';
    if (isset($value['type']) && $value['type'] !== '') {
      if (is_string($value['type']) && isset($types[$value['type']]) && ($read || SchemaGraph::offered($value['type'], NULL, $scope))) {
        $clean['type'] = $type = $value['type'];
      }
      elseif ($read && is_string($value['type']) && preg_match('/^[A-Za-z][A-Za-z0-9]{0,63}$/D', $value['type'])) {
        // A type this release no longer has stays stored, so that the dialog
        // can say so; output is a plain web page and its details go.
        $clean['type'] = $value['type'];
        $type = 'WebPage';
      }
      else {
        $errors['schema.type'] = 'Choose one of the listed page types.';
      }
    }
    if (isset($value['props']) && !is_array($value['props'])) {
      $errors['schema.props'] = self::INVALID;
    }
    elseif (isset($value['props'])) {
      $props = array_column($types[$type]['props'] ?? [], NULL, 'key');
      foreach ($value['props'] as $key => $item) {
        $path = "schema.props.$key";
        $prop = $props[$key] ?? NULL;
        if ($prop === NULL) {
          $errors[$path] = self::NOT_HERE;
          continue;
        }
        $error = self::propError($prop, $item, $scope);
        if ($error !== NULL) {
          $errors[$path] = $error;
          continue;
        }
        // "Someone else", not named yet: on a Canvas page it keeps the site
        // from being the organizer or author by default.
        if (!empty($prop['page_default']) && $scope === 'page' && $item === ['text' => '']) {
          $clean['props'][$key] = $item;
          continue;
        }
        $kind = $prop['kind'];
        // A linked duration keeps the unit its field counts in.
        $unit = is_array($item) && isset($item['unit'], $item['source']) ? $item['unit'] : NULL;
        if ($unit !== NULL) {
          unset($item['unit']);
        }
        $item = $clean_value($item, $path, self::kindOf($prop), 2000);
        // Typed text is checked now; a linked value when it is read. A
        // three-letter currency stored before the code list ("RMB"), and a
        // country typed as text before countries were codes ("Finland"),
        // are kept when read, so that the graph reports them as dropped
        // instead of losing them without a word.
        $code = $read && (($kind === 'currency' && preg_match('/^[A-Z]{3}$/D', $item['text'] ?? '')) || isset($prop['codes']));
        if (isset($item['text']) && !$code && !SchemaGraph::literal($prop, $item['text'])) {
          $errors[$path] = self::LITERAL[match (TRUE) {
            isset($prop['unit']) && preg_match('/^\d+$/D', $item['text']) && (int) $item['text'] > 0 => 'duration_max',
            isset($prop['unit']) => 'duration',
            default => $kind,
          }] ?? 'This value has characters that are not allowed here.';
          continue;
        }
        if (isset($item['fact']) && $item['fact'] === 'identity' && empty($prop['site'])) {
          $errors[$path] = self::FACT;
          continue;
        }
        $clean['props'][$key] = $item === NULL || $unit === NULL ? $item : $item + ['unit' => $unit];
      }
    }
    self::own($value, $clean, $type, $scope, $read, $origin, $errors, $paths, $context);
    if (isset($value['skip']) || isset($clean['skip'])) {
      $sent = $value['skip'] ?? [];
      $clean['skip'] = self::skip(is_array($sent) && array_is_list($sent) ? [...$sent, ...$clean['skip'] ?? []] : $sent, $clean['custom'] ?? NULL, $errors);
    }
    foreach (array_diff(array_keys($value), ['type', 'props', 'custom', 'skip', 'extend', 'main']) as $key) {
      $errors["schema.$key"] = self::NOT_HERE;
    }
    return $clean;
  }

  /**
   * The kind of value a property takes.
   *
   * Formatted text for a job description, else its kind's (KINDS).
   */
  public static function kindOf(array $prop): string {
    return empty($prop['html']) ? self::KINDS[$prop['kind']] : 'html';
  }

  /**
   * Why a value of a property is refused before its kind is checked.
   *
   * A property not offered on the scope, typed text where only a field or
   * a component gives the value, a unit beside anything but a linked
   * duration.
   */
  private static function propError(array $prop, mixed $item, string $scope): ?string {
    if (isset($prop['scopes'][$scope])) {
      return $prop['scopes'][$scope] === 'component' ? self::FROM_FIELD : self::NOT_HERE;
    }
    if (!is_array($item)) {
      return NULL;
    }
    if (isset($item['text']) && !SchemaGraph::typable($prop, $scope)) {
      return self::FROM_FIELD;
    }
    if (array_key_exists('unit', $item)) {
      return isset($item['source']) && count($item) === 2 && in_array($item['unit'], $prop['units'] ?? [], TRUE) ? NULL : self::INVALID;
    }
    return NULL;
  }

  /**
   * The hand-added items left out: @ids as written, of items that exist.
   *
   * An id whose item is gone is dropped, also when it is written: the list
   * follows the custom JSON-LD.
   */
  private static function skip(mixed $value, ?string $custom, array &$errors): array {
    if (!is_array($value) || !array_is_list($value) || array_filter($value, static fn (mixed $id): bool => !is_string($id))) {
      $errors['schema.skip'] = self::INVALID;
      return [];
    }
    $items = json_decode($custom ?? '', TRUE);
    $items = is_array($items) ? (array_is_list($items) ? $items : [$items]) : [];
    $ids = array_filter(array_map(static fn (mixed $item): mixed => is_array($item) ? $item['@id'] ?? NULL : NULL, $items), is_string(...));
    return array_values(array_unique(array_intersect($value, $ids)));
  }

  /**
   * The site currency: an ISO 4217 code, or '' for none.
   *
   * @return array{0: string, 1: ?string}
   *   The clean code ('' when refused), and the message when refused.
   */
  public static function currency(mixed $value): array {
    if ($value === '' || $value === NULL) {
      return ['', NULL];
    }
    if (is_string($value) && isset(SchemaGraph::currencies()[$value])) {
      return [$value, NULL];
    }
    return ['', self::LITERAL['currency']];
  }

  /**
   * Checks hand-added JSON-LD, or details added to a node, as written.
   *
   * The rules are the dialog's red problems, exactly (extension/src/custom/
   * validate.ts runs the same fixtures, tests/fixtures/custom/). The text is
   * never re-encoded: what is saved is what reloads. The 32 KB the minified
   * encodings of every hand-added text share is counted by schema().
   *
   * @param mixed $value
   *   The text as sent or stored.
   * @param array{extend?: list<string>, origin?: ?string} $mode
   *   How to read it. With `extend`, the text adds details to a node of
   *   these types (any one of them may be the node's), so it is one object
   *   without an @id, its keys may name list items, and its @type may only
   *   add to the node's.
   *   `origin`: the site's public base, so that an absolute id of one of the
   *   module's nodes is refused too.
   *
   * @return array{text: ?string, data: mixed, size: int, error: ?array{message: string, item: int, path: string}}
   *   The trimmed text (NULL for nothing to store), its decoded form (objects
   *   as \stdClass), the length of its minified encoding, and the first
   *   problem with the item it is in and a JSON pointer inside that item.
   */
  public static function checkCustom(mixed $value, array $mode = []): array {
    $result = ['text' => NULL, 'data' => NULL, 'size' => 0, 'error' => NULL];
    $fail = static function (string $message, int $item = 0, string $path = '') use (&$result): array {
      $result['error'] = ['message' => $message, 'item' => $item, 'path' => $path];
      $result['text'] = NULL;
      return $result;
    };
    if (!is_string($value)) {
      return $fail(self::INVALID);
    }
    // Spaces and byte order marks around the text, as the dialog trims it.
    $text = $value;
    do {
      $before = $text;
      $text = trim($text);
      $text = str_starts_with($text, "\u{FEFF}") ? substr($text, 3) : $text;
      $text = str_ends_with($text, "\u{FEFF}") ? substr($text, 0, -3) : $text;
    } while ($text !== $before);
    if (self::blank($text)) {
      return $result;
    }
    if (strlen($text) > self::CUSTOM_RAW_MAX) {
      return $fail(sprintf('%d KB as written. Keep under %d KB.', (int) ceil(strlen($text) / 1024), self::CUSTOM_RAW_MAX / 1024));
    }
    try {
      // Objects decode to \stdClass so that {} and [] stay apart.
      $data = json_decode($text, FALSE, 64, JSON_THROW_ON_ERROR);
    }
    catch (\JsonException $e) {
      return $fail(match ($e->getCode()) {
        JSON_ERROR_DEPTH => self::DEEP,
        JSON_ERROR_UTF16, JSON_ERROR_UTF8 => 'This text has a broken character.',
        default => 'This is not valid JSON.',
      });
    }
    $extend = $mode['extend'] ?? NULL;
    if ($extend !== NULL) {
      if (!$data instanceof \stdClass) {
        return $fail('Use one object of details, like {"sku": "…"}.');
      }
      $nodes = [$data];
    }
    else {
      $nodes = is_array($data) ? $data : [$data];
      if (count($nodes) > 10) {
        return $fail(sprintf('%d items. Keep up to 10.', count($nodes)), 10);
      }
    }
    $ids = [];
    foreach ($nodes as $index => $node) {
      if (!$node instanceof \stdClass) {
        return $fail(self::CUSTOM_SHAPE, $index);
      }
      if ($extend === NULL && !isset($node->{'@type'})) {
        return $fail('“@type” is missing.', $index);
      }
      $problem = self::walk($node, 1, [], $extend === NULL ? 'item' : 'extend');
      if ($problem !== NULL) {
        return $fail($problem[0], $index, self::pointer($problem[1]));
      }
      if ($extend !== NULL && isset($node->{'@type'}) && !array_intersect((array) $node->{'@type'}, $extend)) {
        return $fail(sprintf('@type: a type can only be added to “%s”, in a list that keeps it.', $extend[0]), $index, '/@type');
      }
      $id = $node->{'@id'} ?? NULL;
      if ($extend === NULL && is_string($id)) {
        if (self::reserved($id, $mode['origin'] ?? NULL)) {
          return $fail(sprintf('“%s” is made by this page. Use Add details, or give the item another @id.', $id), $index, '/@id');
        }
        if (isset($ids[$id])) {
          return $fail(sprintf('“%s” is used by two items. Give the second another @id.', $id), $index, '/@id');
        }
        $ids[$id] = TRUE;
      }
    }
    if ($nodes === []) {
      return $result;
    }
    try {
      // Output re-encodes with these flags: a value they refuse is refused
      // now, never in a visitor's head.
      json_encode($data, self::OUTPUT_FLAGS);
    }
    catch (\JsonException) {
      return $fail('This can’t be written out as structured data.');
    }
    $result['text'] = $text;
    $result['data'] = $data;
    $result['size'] = strlen(self::json($data));
    return $result;
  }

  /**
   * The first problem in one value of hand-added JSON-LD.
   *
   * @param mixed $value
   *   The decoded value.
   * @param int $depth
   *   Its depth: an item is 1, and lists count.
   * @param list<int|string> $at
   *   Its path inside the item.
   * @param string $role
   *   An "item" at the top, "extend" for added details, "" inside.
   *
   * @return array{0: string, 1: list<int|string>}|null
   *   The sentence and the path it is about.
   */
  private static function walk(mixed $value, int $depth, array $at, string $role = ''): ?array {
    $label = implode(' › ', array_filter($at, is_string(...)));
    $say = static fn (string $text, ?array $path = NULL): array => [
      $label === '' ? ucfirst($text) : "$label: $text",
      $path ?? $at,
    ];
    if (is_string($value)) {
      $scheme = self::scheme($value);
      return $scheme === NULL ? NULL : $say(sprintf('text can’t start with “%s:”.', $scheme));
    }
    if (is_float($value) && !is_finite($value)) {
      return $say('this number is too large to use.');
    }
    if ($value === NULL) {
      return [($label === '' ? 'This' : $label) . ' is empty (null). Remove it or give it a value.', $at];
    }
    if (!is_array($value) && !$value instanceof \stdClass) {
      return NULL;
    }
    if ($depth > 8) {
      return $say('too deeply nested (items and lists count). Keep to 8.');
    }
    if (is_array($value)) {
      foreach ($value as $index => $item) {
        $problem = self::walk($item, $depth + 1, [...$at, $index]);
        if ($problem !== NULL) {
          return $problem;
        }
      }
      return NULL;
    }
    foreach (get_object_vars($value) as $key => $item) {
      $key = (string) $key;
      $path = [...$at, $key];
      if (str_starts_with($key, '@')) {
        $problem = match ($key) {
          '@type' => self::typeProblem($item) ?? (($scheme = self::scheme(...array_filter((array) $item, is_string(...)))) === NULL ? NULL : sprintf('@type: text can’t start with “%s:”.', $scheme)),
          '@id' => match (TRUE) {
            $role === 'extend' => '@id: the id of this item can’t change. Leave @id out.',
            !is_string($item) || (!preg_match('/^#\S+$/u', $item) && !self::isHttpUrl($item)) => '@id: use a full address, or a name that starts with #.',
            default => NULL,
          },
          '@context' => $role === 'item' && self::isContext($item) ? NULL : self::AT_KEYS,
          default => self::AT_KEYS,
        };
        if ($problem !== NULL) {
          $words = match (TRUE) {
            $label === '' => $problem,
            $problem === self::AT_KEYS => "$label: " . lcfirst($problem),
            default => "$label › $problem",
          };
          return [$words, $path];
        }
        continue;
      }
      if ($role === 'extend' && str_contains($key, '[') && !preg_match(self::SELECTOR, $key)) {
        return [sprintf('“%s”: name one item with [name=…], or every item with [*].', $key), $path];
      }
      $problem = self::walk($item, $depth + 1, $path);
      if ($problem !== NULL) {
        return $problem;
      }
    }
    return NULL;
  }

  /**
   * The script, data or file scheme a string starts with, if any.
   *
   * Consumers turn JSON-LD addresses into links, and address parsers drop
   * tabs and line breaks ("java\tscript:"), so they are dropped before the
   * colon too. A word before a colon in a sentence ("Data: collected in
   * 2026") is not an address.
   *
   * @param string ...$values
   *   The strings: one value, or the types of an @type list.
   */
  public static function scheme(string ...$values): ?string {
    foreach ($values as $value) {
      $colon = strpos($value, ':');
      if ($colon === FALSE) {
        continue;
      }
      $probe = str_replace(["\t", "\n", "\r"], '', substr($value, 0, $colon)) . substr($value, $colon);
      // ASCII spaces only, as the dialog's mirror reads them.
      if (preg_match('~^[ \x00-\x1F]*(javascript|vbscript)[ \t\n\x0B\f\r]*:~i', $probe, $m) || preg_match('~^[ \x00-\x1F]*(data|file):[\t\n\r]*(?=[^ \t\n\x0B\f\r])~i', $probe, $m)) {
        return strtolower($m[1]);
      }
    }
    return NULL;
  }

  /**
   * Why an @type is refused: one type, or a list of up to four.
   */
  private static function typeProblem(mixed $type): ?string {
    $types = is_array($type) ? $type : [$type];
    $ok = $types !== [] && count($types) <= 4 && !array_filter($types, static fn (mixed $one): bool => !is_string($one) || trim($one) === '');
    return $ok ? NULL : '@type: use one type, or a list of up to 4 types.';
  }

  /**
   * Whether a pasted @context is schema.org's, in any of its spellings.
   */
  public static function isContext(mixed $context): bool {
    $one = static fn (mixed $item): bool => (is_string($item) && preg_match(self::CONTEXT, $item))
      || ($item instanceof \stdClass && array_keys(get_object_vars($item)) === ['@vocab'] && is_string($item->{'@vocab'}) && preg_match(self::CONTEXT, $item->{'@vocab'}));
    return is_array($context) ? $context !== [] && count(array_filter($context, $one)) === count($context) : $one($context);
  }

  /**
   * Whether a hand-added item's @id is one of the module's.
   *
   * "#webpage", "#c-…", and with the site's public base an absolute address
   * on it, http or https, that ends in one of them.
   */
  public static function reserved(string $id, ?string $origin = NULL): bool {
    // On the site's address whichever scheme it is written with.
    $bare = static fn (string $url): string => (string) preg_replace('~^https?:~i', '', $url);
    $name = match (TRUE) {
      str_starts_with($id, '#') => substr($id, 1),
      $origin !== NULL && $origin !== '' && str_starts_with($bare($id), rtrim($bare($origin), '/') . '/') && str_contains($id, '#') => substr($id, strpos($id, '#') + 1),
      default => NULL,
    };
    return $name !== NULL && (isset(SchemaGraph::MODULE_IDS[$name]) || str_starts_with($name, SchemaGraph::COMPONENT_PREFIX));
  }

  /**
   * Renames top-level ids that are the module's, or another item's.
   *
   * Hand-added JSON-LD stored before ids were reserved keeps its output: the
   * item is renamed "‹id›-2" ("#item-c-…" for an id with the components'
   * prefix); references to it are renamed too when they
   * reached it (a site id, "#identity", was the page's own "#identity"
   * then); an item that was left out (one of the page's ids, or the second
   * of two) is listed in `skip`.
   *
   * @param mixed $data
   *   The decoded text (\stdClass objects).
   *
   * @return array{0: mixed, 1: list<array{from: string, to: string, skip: bool}>}
   *   The data, and what was renamed.
   */
  public static function renameReserved(mixed $data): array {
    $nodes = is_array($data) ? $data : [$data];
    $taken = [];
    foreach ($nodes as $node) {
      if ($node instanceof \stdClass && is_string($node->{'@id'} ?? NULL)) {
        $taken[$node->{'@id'}] = TRUE;
      }
    }
    $seen = $renames = $refs = [];
    foreach ($nodes as $node) {
      $id = $node instanceof \stdClass && is_string($node->{'@id'} ?? NULL) ? $node->{'@id'} : NULL;
      if ($id === NULL) {
        continue;
      }
      $reserved = self::reserved($id);
      $duplicate = isset($seen[$id]);
      $seen[$id] = TRUE;
      if (!$reserved && !$duplicate) {
        continue;
      }
      $name = substr($id, 1);
      // "#c-suite" is reserved by its prefix, so every "-2" would be too:
      // the new name starts with a word of its own.
      $base = $reserved && !isset(SchemaGraph::MODULE_IDS[$name]) ? '#item-' . $name : $id;
      $new = $base;
      for ($n = 2; isset($taken[$new]) || self::reserved($new); $n++) {
        $new = "$base-$n";
      }
      $taken[$new] = TRUE;
      // An id of the page was its node, never this item; a site id on a
      // page, or a "#c-…" id, was this item. The second of two was left out.
      $page_id = $reserved && (SchemaGraph::MODULE_IDS[$name] ?? NULL) === 'url';
      $renames[] = ['from' => $id, 'to' => $new, 'skip' => $page_id || $duplicate];
      if (!$page_id && !$duplicate) {
        $refs[$id] = $new;
      }
      $node->{'@id'} = $new;
    }
    if ($refs) {
      $rewrite = static function (mixed $value, bool $top) use (&$rewrite, $refs): mixed {
        if (is_array($value)) {
          return array_map(static fn (mixed $item): mixed => $rewrite($item, FALSE), $value);
        }
        if (!$value instanceof \stdClass) {
          return $value;
        }
        foreach (get_object_vars($value) as $key => $item) {
          if ($key === '@id' && !$top && is_string($item) && isset($refs[$item])) {
            $value->{'@id'} = $refs[$item];
          }
          elseif ($key !== '@id') {
            $value->{$key} = $rewrite($item, FALSE);
          }
        }
        return $value;
      };
      foreach ($nodes as $node) {
        $rewrite($node, TRUE);
      }
    }
    return [$data, $renames];
  }

  /**
   * Hand-added JSON-LD written by the module: two spaces, keys in order.
   */
  public static function pretty(mixed $data): string {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    return (string) preg_replace_callback('/^( {4})+/m', static fn (array $m): string => str_repeat('  ', intdiv(strlen($m[0]), 4)), $json);
  }

  /**
   * The type each node that takes added details has before they merge.
   *
   * An added @type must be a list that keeps it. The main node's is the
   * kind chosen by a prop emitted as the type ("Kind of place"), else the
   * registry's; the page node's is the registry's; the identity's is its
   * kind, or either when that is not known.
   *
   * @param string $type
   *   The registry type.
   * @param array $props
   *   The type's stored props (a page translation's include those it
   *   inherits).
   * @param string|null $identityKind
   *   'organization', 'person', or NULL for either.
   *
   * @return array{'#primary': list<string>, '#webpage': list<string>, '#identity': list<string>}
   *   Short id => the types an added list must keep one of.
   */
  public static function nodeTypes(string $type, array $props = [], ?string $identityKind = NULL): array {
    $types = SchemaGraph::types();
    $type = isset($types[$type]) ? $type : 'WebPage';
    $primary = $types[$type]['primary_type'] ?? 'Thing';
    foreach ($types[$type]['props'] ?? [] as $prop) {
      $text = ($prop['emit'] ?? NULL) === 'type' ? ($props[$prop['key']]['text'] ?? $prop['default']['text'] ?? NULL) : NULL;
      if (is_string($text) && in_array($text, $prop['options'] ?? [], TRUE)) {
        $primary = $text;
      }
    }
    return [
      '#primary' => [$primary],
      '#webpage' => [$types[$type]['page_type'] ?? 'WebPage'],
      '#identity' => match ($identityKind) {
        'person' => ['Person'],
        'organization' => ['Organization'],
        default => ['Organization', 'Person'],
      },
    ];
  }

  /**
   * Hand-added JSON-LD stored before a rule, read as far as it can be.
   *
   * Ids taken before they were reserved are renamed (renameReserved()); an
   * item that is still refused is left out, so that the others are output.
   *
   * @param string $text
   *   The stored text.
   * @param array{message: string, item: int, path: string} $error
   *   Why it is refused as stored.
   * @param string|null $origin
   *   The site's public base.
   *
   * @return array{0: array, 1: list<string>, 2: ?array{message: string, item: int, path: string}}
   *   checkCustom()'s result for what is kept, the renamed ids to leave out
   *   as before, and the refusal of the first item that was left out.
   */
  private static function legacy(string $text, array $error, ?string $origin): array {
    $refused = ['text' => NULL, 'data' => NULL, 'size' => 0, 'error' => $error];
    try {
      $data = json_decode($text, FALSE, 64, JSON_THROW_ON_ERROR);
    }
    catch (\JsonException) {
      return [$refused, [], NULL];
    }
    if (!is_array($data) && !$data instanceof \stdClass) {
      return [$refused, [], NULL];
    }
    [$data, $renames] = self::renameReserved($data);
    $kept_out = array_column(array_filter($renames, static fn (array $one): bool => $one['skip']), 'to');
    $nodes = is_array($data) ? $data : [$data];
    $first = NULL;
    // Item by item: at most one round per item, and one for what is left.
    for ($round = 0; $round <= 11; $round++) {
      $drop = NULL;
      foreach ($nodes as $at => $node) {
        try {
          json_encode($node, self::OUTPUT_FLAGS);
        }
        catch (\JsonException) {
          // A number stored as 1e400: refused by the walk, never encoded.
          $drop = [$at, $error['item'] === $at ? $error : [
            'message' => 'This can’t be written out as structured data.',
            'item' => $at,
            'path' => '',
          ],
          ];
          break;
        }
      }
      if ($drop === NULL) {
        $probe = self::checkCustom(self::written(count($nodes) === 1 ? $nodes[0] : $nodes), ['origin' => $origin]);
        $item_only = [self::CUSTOM_SHAPE, '“@type” is missing.'];
        $own = $probe['error'] !== NULL && ($probe['error']['path'] !== '' || in_array($probe['error']['message'], $item_only, TRUE));
        if (!$own || !isset($nodes[$probe['error']['item']])) {
          return [$probe, $kept_out, $probe['error'] === NULL ? $first : NULL];
        }
        $drop = [$probe['error']['item'], $probe['error']];
      }
      $first ??= $drop[1];
      array_splice($nodes, $drop[0], 1);
      if ($nodes === []) {
        return [['text' => NULL, 'data' => NULL, 'size' => 0, 'error' => NULL], $kept_out, $first];
      }
    }
    return [$refused, $kept_out, NULL];
  }

  /**
   * Hand-added JSON-LD as the module writes it: pretty when it fits.
   *
   * Two spaces, keys in order; minified when indenting would take it over
   * the 64 KB a text may have as written.
   *
   * @param mixed $data
   *   Decoded JSON-LD (\stdClass objects) that can be encoded.
   */
  public static function written(mixed $data): string {
    $pretty = self::pretty($data);
    return strlen($pretty) <= self::CUSTOM_RAW_MAX ? $pretty : self::json($data);
  }

  /**
   * A path as a JSON pointer.
   *
   * @param list<int|string> $path
   *   Keys and indexes.
   */
  private static function pointer(array $path): string {
    return implode('', array_map(static fn (int|string $part): string => '/' . str_replace(['~', '/'], ['~0', '~1'], (string) $part), $path));
  }

  /**
   * Cleans hand-added JSON-LD, added details and the main thing.
   *
   * @param array $value
   *   The `schema` map, as sent or stored.
   * @param array $clean
   *   The clean map so far: `custom`, `extend` and `main` are added.
   * @param string $type
   *   The structured-data type the values have.
   * @param string $scope
   *   One of 'page', 'template', 'site'.
   * @param bool $read
   *   Read mode: ids stored before they were reserved are renamed.
   * @param ?string $origin
   *   The site's public base, when known.
   * @param array<string, string> $errors
   *   Collects path => sentence.
   * @param array<string, array{item: int, path: string}> $paths
   *   Collects path => where in the text the problem is.
   * @param array{identity?: string} $context
   *   What decides an added @type besides the values (clean()).
   */
  private static function own(array $value, array &$clean, string $type, string $scope, bool $read, ?string $origin, array &$errors, array &$paths, array $context = []): void {
    $refuse = static function (string $field, array $error) use (&$errors, &$paths): void {
      $errors[$field] = $error['message'];
      $paths[$field] = ['item' => $error['item'], 'path' => $error['path']];
    };
    $size = 0;
    if (isset($value['custom'])) {
      $checked = self::checkCustom($value['custom'], ['origin' => $origin]);
      if ($read && $checked['error'] !== NULL && is_string($value['custom'])) {
        // Stored before a rule: renamed as the update does, and only the
        // items still refused are left out, each reported.
        [$checked, $kept_out, $refused] = self::legacy($value['custom'], $checked['error'], $origin);
        if ($kept_out) {
          $clean['skip'] = array_values(array_unique([...$clean['skip'] ?? [], ...$kept_out]));
        }
        if ($refused !== NULL) {
          $refuse('schema.custom', $refused);
        }
      }
      if ($checked['error'] !== NULL) {
        $refuse('schema.custom', $checked['error']);
      }
      elseif ($checked['text'] !== NULL) {
        $clean['custom'] = $checked['text'];
        $size += $checked['size'];
      }
    }
    if (isset($value['extend'])) {
      // Read mode doesn't know the identity's kind: either is kept.
      $nodes = self::nodeTypes($type, $clean['props'] ?? [], $read ? NULL : ($context['identity'] ?? NULL));
      if (!is_array($value['extend']) || array_is_list($value['extend']) && $value['extend'] !== []) {
        $errors['schema.extend'] = self::INVALID;
      }
      else {
        foreach ($value['extend'] as $node => $text) {
          $field = "schema.extend.$node";
          if (!in_array($node, SchemaGraph::EXTEND[$scope] ?? [], TRUE)) {
            $errors[$field] = self::NOT_HERE;
            continue;
          }
          $checked = self::checkCustom($text, ['extend' => $nodes[$node]]);
          if ($read && $checked['error'] !== NULL && $checked['error']['path'] === '/@type' && is_string($text)) {
            // An added type that no longer fits the node (its page type or
            // the identity's kind changed): the other details still merge,
            // so only the type is left out.
            $data = json_decode($text);
            if ($data instanceof \stdClass) {
              unset($data->{'@type'});
              $checked = self::checkCustom(get_object_vars($data) ? self::written($data) : '', ['extend' => $nodes[$node]]);
            }
          }
          if ($checked['error'] !== NULL) {
            $refuse($field, $checked['error']);
          }
          elseif ($checked['text'] !== NULL) {
            $clean['extend'][$node] = $checked['text'];
            $size += $checked['size'];
          }
        }
      }
    }
    if ($size > self::CUSTOM_MAX) {
      // Said on every hand-added text: each one sent back as stored is
      // carried (ApiController::carry()), and the one that grew still fails.
      $over = [
        'message' => sprintf('%d KB. Keep under %d KB, including added details.', (int) ceil($size / 1024), self::CUSTOM_MAX / 1024),
        'item' => 0,
        'path' => '',
      ];
      foreach (array_merge(isset($clean['custom']) ? ['schema.custom'] : [], array_map(static fn (string $node): string => "schema.extend.$node", array_keys($clean['extend'] ?? []))) as $field) {
        $refuse($field, $over);
      }
      unset($clean['custom'], $clean['extend']);
    }
    if (isset($value['main'])) {
      $items = json_decode($clean['custom'] ?? '', TRUE);
      $items = is_array($items) ? (array_is_list($items) ? $items : [$items]) : [];
      $ids = array_filter(array_map(static fn (mixed $item): mixed => is_array($item) ? $item['@id'] ?? NULL : NULL, $items), is_string(...));
      if ($scope !== 'site' && is_string($value['main']) && in_array($value['main'], $ids, TRUE)) {
        $clean['main'] = $value['main'];
      }
      elseif (!$read) {
        $errors['schema.main'] = $scope === 'site' ? self::NOT_HERE : 'Choose one of your own items.';
      }
    }
  }

}
