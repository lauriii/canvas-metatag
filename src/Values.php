<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\Component\Utility\UrlHelper;
use Drupal\Component\Uuid\Uuid;

/**
 * The SEO value shape: validation, canonical encoding, layers and text output.
 *
 * Static and pure. The same rules exist once more in TypeScript
 * (extension/src/model.ts); tests/fixtures/text-cases.json pins both.
 */
final class Values {

  /**
   * The token grammar. Brace text that does not match is literal.
   */
  public const TOKEN = '/\{([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)?)\}/';

  /**
   * C0, DEL and C1 controls except tab, LF and CR; bidi overrides and isolates.
   */
  private const UNSAFE = '/[\x{00}-\x{08}\x{0B}\x{0C}\x{0E}-\x{1F}\x{7F}-\x{9F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u';

  private const KEYS = [
    'page' => ['title', 'canonical', 'social', 'robots', 'schema'],
    'template' => ['title', 'description', 'social', 'robots', 'schema'],
    'site' => ['title', 'robots'],
  ];

  private const PREVIEWS = ['none', 'standard', 'large'];

  private const INVALID = 'This value is not valid.';
  private const NOT_HERE = 'This setting is not available here.';
  private const IMAGE = 'Choose an image from the list.';
  private const CUSTOM_SHAPE = 'Use one object, or a list of up to 10 objects, each with "@type".';

  private const LITERAL = [
    'url' => 'Enter a full address that starts with https://.',
    'date' => 'Choose a date.',
    'number' => 'Enter a number, like 49 or 49.90.',
    'enum' => 'Choose one of the listed options.',
  ];

  /**
   * Validates values for one scope.
   *
   * @param array $input
   *   The sparse values object.
   * @param string $scope
   *   One of 'page', 'template', 'site'.
   * @param array<string, string>|null $tokens
   *   Token name => type for this scope and bundle (write mode), or NULL for
   *   read mode: token names are not checked and callers ignore the errors,
   *   because every offending key is already left out of the clean values.
   * @param string $inheritedType
   *   The structured-data type that applies when the values name none: a
   *   page translation's details belong to the type of the default one.
   *
   * @return array{0: array, 1: array<string, string>}
   *   The clean values in canonical key order, and field path => message.
   */
  public static function clean(array $input, string $scope, ?array $tokens, string $inheritedType = 'WebPage'): array {
    $errors = [];
    $clean = [];
    foreach ($input as $key => $value) {
      if (!in_array($key, self::KEYS[$scope] ?? [], TRUE)) {
        $errors[(string) $key] = self::NOT_HERE;
        continue;
      }
      $clean[$key] = match ($key) {
        'title' => self::text($value, 255, $tokens, 'title', $errors),
        'description' => self::text($value, 1000, $tokens, 'description', $errors),
        'canonical' => self::canonical($value, $errors),
        'social' => self::social($value, $tokens, $errors),
        'robots' => self::robots($value, $errors),
        'schema' => self::schema($value, $tokens, $inheritedType, $errors),
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

    $clean['name'] = self::text($input['name'] ?? '', 255, NULL, 'identity.name', $errors) ?? '';

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
   * Only the title and the robots directives exist at site level.
   */
  public static function cascade(array $target, array $site): array {
    $effective = $target;
    if (!isset($effective['title']) && isset($site['title'])) {
      $effective['title'] = $site['title'];
    }
    $robots = ($target['robots'] ?? []) + ($site['robots'] ?? []);
    if ($robots) {
      $effective['robots'] = $robots;
    }
    return $effective;
  }

  /**
   * Replaces every token in one pass; a substituted value is never rescanned.
   *
   * @param string $template
   *   Text with {tokens}.
   * @param array<string, string> $values
   *   Token name => value.
   * @param bool $keepUnknown
   *   Leave a name that is not in $values as written instead of blanking it.
   */
  public static function fill(string $template, array $values, bool $keepUnknown = FALSE): string {
    return (string) preg_replace_callback(
      self::TOKEN,
      static fn (array $m): string => (string) ($values[$m[1]] ?? ($keepUnknown ? $m[0] : '')),
      $template,
    );
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
   * The four text outputs.
   *
   * @param array $effective
   *   The result of cascade().
   * @param array<string, string> $tokens
   *   Token name => value.
   *
   * @return array{title: string, description: string, social_title: string, social_description: string}
   *   Plain text; the consumer escapes it.
   */
  public static function texts(array $effective, array $tokens): array {
    $filled = static fn (mixed $template, int $max): string => self::cut(self::fill(is_string($template) ? $template : '', $tokens), $max);
    $token = static fn (string $name, int $max): string => self::cut((string) ($tokens[$name] ?? ''), $max);

    $title = self::trimSeparators($filled($effective['title'] ?? '', 255), (string) ($tokens['sep'] ?? ''));
    $title = $title !== '' ? $title : $token('title', 255);
    $title = $title !== '' ? $title : $token('site', 255);

    $description = $filled($effective['description'] ?? '', 1000);
    $description = $description !== '' ? $description : $token('description', 1000);

    $social_title = $filled($effective['social']['title'] ?? '', 255);
    $social_description = $filled($effective['social']['description'] ?? '', 1000);

    return [
      'title' => $title,
      'description' => $description,
      'social_title' => $social_title !== '' ? $social_title : $token('title', 255),
      'social_description' => $social_description !== '' ? $social_description : $description,
    ];
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
   * Removes a separator word that has nothing to separate.
   *
   * A separator is only ever a whole word equal to $sep. One is dropped when
   * no other word precedes it, when it follows another separator and when no
   * other word follows it.
   */
  private static function trimSeparators(string $text, string $sep): string {
    if ($sep === '') {
      return $text;
    }
    $kept = [];
    foreach (explode(' ', $text) as $word) {
      if ($word !== $sep || ($kept && end($kept) !== $sep)) {
        $kept[] = $word;
      }
    }
    if (end($kept) === $sep) {
      array_pop($kept);
    }
    return implode(' ', $kept);
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
   * Cleans one template. Returns NULL when there is nothing to store.
   *
   * A text that is too long is reported and cut, so that read mode keeps the
   * cut text; an unknown or image token is reported in write mode only.
   */
  private static function text(mixed $value, int $max, ?array $tokens, string $path, array &$errors): ?string {
    if (!is_string($value)) {
      $errors[$path] = self::INVALID;
      return NULL;
    }
    $value = self::strip($value);
    if (self::blank($value)) {
      return NULL;
    }
    if (mb_strlen($value) > $max) {
      $errors[$path] = sprintf('Use at most %d characters.', $max);
      $value = mb_substr($value, 0, $max);
    }
    if ($tokens !== NULL && preg_match_all(self::TOKEN, $value, $matches)) {
      foreach ($matches[1] as $name) {
        if (!isset($tokens[$name])) {
          $errors[$path] = sprintf('"{%s}" is not a value SEO knows. Choose one from the list.', $name);
        }
        elseif ($tokens[$name] === 'image') {
          $errors[$path] = sprintf('"{%s}" is an image and can\'t be used in text.', $name);
        }
      }
    }
    return $value;
  }

  /**
   * A media UUID, or exactly one token (write mode: an image token).
   */
  private static function image(mixed $value, ?array $tokens, string $path, array &$errors): ?string {
    if ($value === '') {
      return NULL;
    }
    $valid = is_string($value) && (Uuid::isValid($value) || (
      preg_match(self::TOKEN, $value, $m) && $m[0] === $value && ($tokens === NULL || ($tokens[$m[1]] ?? '') === 'image')
    ));
    if (!$valid) {
      $errors[$path] = self::IMAGE;
      return NULL;
    }
    return $value;
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
  private static function social(mixed $value, ?array $tokens, array &$errors): array {
    if (!is_array($value)) {
      $errors['social'] = self::INVALID;
      return [];
    }
    $clean = [];
    foreach ($value as $key => $item) {
      $path = "social.$key";
      if (!in_array($key, ['title', 'description', 'image'], TRUE)) {
        $errors[$path] = self::NOT_HERE;
        continue;
      }
      $clean[$key] = match ($key) {
        'title' => self::text($item, 255, $tokens, $path, $errors),
        'description' => self::text($item, 1000, $tokens, $path, $errors),
        'image' => self::image($item, $tokens, $path, $errors),
      };
    }
    return $clean;
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
  private static function schema(mixed $value, ?array $tokens, string $inheritedType, array &$errors): array {
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
        if ($props[$key]['kind'] === 'image') {
          $clean['props'][$key] = self::image($item, $tokens, $path, $errors);
          continue;
        }
        $item = self::text($item, 2000, $tokens, $path, $errors);
        // A literal is checked now; a value with tokens after substitution.
        if ($item !== NULL && !preg_match(self::TOKEN, $item) && !SchemaGraph::validLiteral($type, (string) $key, $item)) {
          $errors[$path] = self::LITERAL[$props[$key]['kind']] ?? match ($props[$key]['pattern'] ?? '') {
            '^[A-Z]{3}$' => 'Enter a three-letter currency code, like EUR.',
            default => 'This value has characters that are not allowed here.',
          };
          continue;
        }
        $clean['props'][$key] = $item;
      }
    }
    if (isset($value['custom'])) {
      $clean['custom'] = self::custom($value['custom'], $errors);
    }
    foreach (array_diff(array_keys($value), ['type', 'props', 'custom']) as $key) {
      $errors["schema.$key"] = self::NOT_HERE;
    }
    return $clean;
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
