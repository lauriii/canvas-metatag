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
    'site' => ['title_end', 'robots'],
  ];

  private const PREVIEWS = ['none', 'standard', 'large'];

  private const INVALID = 'This value is not valid.';
  private const NOT_HERE = 'This setting is not available here.';
  private const IMAGE = 'Choose an image from the list.';
  private const FACT = 'Choose a value from the list.';
  private const FIELD = 'Choose a field from the list.';
  private const CUSTOM_SHAPE = 'Use one object, or a list of up to 10 objects, each with "@type".';

  private const LITERAL = [
    'url' => 'Enter a full address that starts with https://.',
    'date' => 'Choose a date.',
    'number' => 'Enter a number, like 49 or 49.90.',
    'enum' => 'Choose one of the listed options.',
    'currency' => 'Choose a currency code from the list, such as EUR.',
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
   *
   * @return array{0: array, 1: array<string, string>}
   *   The clean values in canonical key order, and field path => message.
   */
  public static function clean(array $input, string $scope, ?callable $accepts, string $inheritedType = 'WebPage'): array {
    $errors = [];
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
        'schema' => self::schema($item, $value, $inheritedType, $accepts === NULL, $errors),
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
      // "No ending" is the one empty value that is stored.
      if ($key === 'title_end' && $value === ['text' => '']) {
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
  private static function schema(mixed $value, callable $clean_value, string $inheritedType, bool $read, array &$errors): array {
    if (!is_array($value)) {
      $errors['schema'] = self::INVALID;
      return [];
    }
    $clean = [];
    $types = SchemaGraph::types();
    $type = isset($types[$inheritedType]) ? $inheritedType : 'WebPage';
    if (isset($value['type']) && $value['type'] !== '') {
      if (is_string($value['type']) && isset($types[$value['type']])) {
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
        if (!isset($props[$key])) {
          $errors[$path] = self::NOT_HERE;
          continue;
        }
        $kind = $props[$key]['kind'];
        $item = $clean_value($item, $path, self::KINDS[$kind], 2000);
        // Typed text is checked now; a linked value when it is read. A
        // three-letter currency stored before the code list ("RMB") is kept
        // when read, so that the graph reports it as dropped instead of
        // losing it without a word.
        $code = $read && $kind === 'currency' && preg_match('/^[A-Z]{3}$/D', $item['text'] ?? '');
        if (isset($item['text']) && !$code && !SchemaGraph::validLiteral($type, (string) $key, $item['text'])) {
          $errors[$path] = self::LITERAL[$kind] ?? 'This value has characters that are not allowed here.';
          continue;
        }
        $clean['props'][$key] = $item;
      }
    }
    if (isset($value['custom'])) {
      $clean['custom'] = self::custom($value['custom'], $errors);
    }
    if (isset($value['skip'])) {
      $clean['skip'] = self::skip($value['skip'], $clean['custom'] ?? NULL, $errors);
    }
    foreach (array_diff(array_keys($value), ['type', 'props', 'custom', 'skip']) as $key) {
      $errors["schema.$key"] = self::NOT_HERE;
    }
    return $clean;
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
   * Parses, restricts and re-encodes custom JSON-LD; the input is never echoed.
   */
  private static function custom(mixed $value, array &$errors): ?string {
    if (!is_string($value)) {
      $errors['schema.custom'] = self::INVALID;
      return NULL;
    }
    if (self::blank($value)) {
      return NULL;
    }
    if (strlen($value) > 32768) {
      $errors['schema.custom'] = 'Custom JSON-LD is too large. Keep it under 32 KB.';
      return NULL;
    }
    try {
      // Objects decode to \stdClass so that {} and [] stay distinguishable.
      $data = json_decode($value, FALSE, 64, JSON_THROW_ON_ERROR);
    }
    catch (\JsonException $e) {
      $errors['schema.custom'] = $e->getCode() === JSON_ERROR_DEPTH ? self::CUSTOM_SHAPE : 'This is not valid JSON.';
      return NULL;
    }
    $nodes = is_array($data) ? $data : [$data];
    $error = count($nodes) > 10 ? self::CUSTOM_SHAPE : NULL;
    foreach ($nodes as $index => $node) {
      if (!$node instanceof \stdClass || !isset($node->{'@type'})) {
        $error = self::CUSTOM_SHAPE;
        break;
      }
      $nodes[$index] = self::customValue($node, 1, $error);
    }
    if ($error !== NULL) {
      $errors['schema.custom'] = $error;
      return NULL;
    }
    return $nodes ? self::json(is_array($data) ? $nodes : $nodes[0]) : NULL;
  }

  /**
   * Checks one custom JSON-LD value and returns it with object keys sorted.
   */
  private static function customValue(mixed $value, int $depth, ?string &$error): mixed {
    if (is_string($value) && preg_match('~^[\s\x00-\x1F]*(?:javascript|vbscript|data|file)\s*:~i', $value)) {
      // Consumers turn JSON-LD addresses into links.
      $error ??= 'Addresses must start with https:// or http://.';
      return NULL;
    }
    if (is_string($value) || is_int($value) || is_float($value) || is_bool($value)) {
      return $value;
    }
    if ($depth > 8 || !(is_array($value) || $value instanceof \stdClass)) {
      $error ??= self::CUSTOM_SHAPE;
      return NULL;
    }
    if (is_array($value)) {
      return array_map(static function (mixed $item) use ($depth, &$error): mixed {
        return self::customValue($item, $depth + 1, $error);
      }, $value);
    }
    $members = [];
    foreach (get_object_vars($value) as $key => $item) {
      $key = (string) $key;
      if (str_starts_with($key, '@')) {
        if ($key !== '@type' && $key !== '@id') {
          $error ??= 'Only "@type" and "@id" may start with @.';
        }
        elseif (!is_string($item) || $item === '') {
          $error ??= $key === '@id' ? 'An "@id" must be a full address, or a name that starts with #.' : self::CUSTOM_SHAPE;
        }
        elseif ($key === '@id' && !preg_match('/^#\S+$/u', $item) && !self::isHttpUrl($item)) {
          $error ??= 'An "@id" must be a full address, or a name that starts with #.';
        }
      }
      $members[$key] = self::customValue($item, $depth + 1, $error);
    }
    ksort($members, SORT_STRING);
    // Back to an object: a PHP array with the keys "0", "1" would encode as
    // a list.
    $object = new \stdClass();
    foreach ($members as $key => $item) {
      $object->{$key} = $item;
    }
    return $object;
  }

}
