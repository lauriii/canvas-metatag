<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\Core\File\FileExists;
use Drupal\Core\File\FileSystemInterface;
use Drupal\Core\StreamWrapper\StreamWrapperManagerInterface;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\RequestOptions;

/**
 * The schema.org vocabulary, as the site downloaded it.
 *
 * The module never ships it: schema.org's vocabulary is CC BY-SA 3.0. A site
 * administrator downloads the release the module pins with
 * `drush canvas-metatag:vocabulary`, which keeps only what the dialog's
 * form needs, with its source, release, licence and attribution, in the
 * site's private files (public ones without a private path). The dialog
 * reads it from the module's route, and works without it.
 */
final class Vocabulary {

  /**
   * The release the module is tested with.
   */
  public const RELEASE = '30.1';

  /**
   * Where a release is downloaded from.
   */
  public const SOURCE = 'https://schema.org/version/%s/schemaorg-current-https.jsonld';

  /**
   * The most a release may weigh, in bytes.
   */
  public const MAX_BYTES = 4194304;

  /**
   * How long a download may take, in seconds.
   */
  public const TIMEOUT = 20;

  public function __construct(
    private readonly ClientInterface $httpClient,
    private readonly FileSystemInterface $fileSystem,
    private readonly StreamWrapperManagerInterface $streamWrappers,
  ) {}

  /**
   * Trims a schema.org release to what the form needs.
   *
   * @param array $release
   *   The decoded JSON-LD release (its `@graph`).
   * @param array{source?: string, release?: string} $about
   *   Where it came from.
   *
   * @return array{source: string, release: string, licence: string, attribution: string, types: array, properties: array, members: array}
   *   `types`: name => {parents, about, pending?, superseded?}; `properties`:
   *   name => {domains, ranges, about, pending?, superseded?}; `members`:
   *   enumeration => its members. Datatypes, enumerations and retired terms
   *   are never types; definitions are their first sentence.
   */
  public static function build(array $release, array $about = []): array {
    $name = static fn (mixed $id): ?string => is_string($id) && str_starts_with($id, 'schema:') ? substr($id, 7) : NULL;
    $ids = static fn (mixed $value): array => array_values(array_filter(array_map(
      static fn (mixed $one): ?string => $name(is_array($one) ? $one['@id'] ?? NULL : $one),
      is_array($value) && array_is_list($value) ? $value : [$value],
    )));
    $text = static function (mixed $value): string {
      $value = is_array($value) ? $value['@value'] ?? '' : $value;
      // A line break is a space.
      $marks = ['\\n' => ' ', '[[' => '', ']]' => '', '<br/>' => ' ', '<br />' => ' ', '<br>' => ' '];
      $plain = trim((string) preg_replace('/\s+/', ' ', strip_tags(strtr((string) $value, $marks))));
      // Plain text: a Markdown link reads as its words, a "(source: …)"
      // clause and an address go, parentheses kept in pairs.
      $plain = trim((string) preg_replace([
        '/\[([^\]]+)\]\([^)\s]*\)/',
        '/\s*\(\s*source:[^()]*\)/i',
        '/\(\s*https?:\/\/[^\s)]*\s*\)|\bhttps?:\/\/[^\s)]*[^\s).,;]/',
        '/\s+([.,;])/',
        '/\s+/',
      ], ['$1', '', '', '$1', ' '], $plain));
      // The first sentence: up to a full stop that ends a word, never the
      // one of "e.g." or "i.e.".
      return preg_match('/^.*?[a-z0-9)\]](?<!\be\.g|\bi\.e|\betc|\bvs|\bcf)[.!?](?=\s|$)/u', $plain, $m) ? $m[0] : $plain;
    };
    $classes = $props = $members = [];
    foreach ($release['@graph'] ?? [] as $node) {
      $id = $name($node['@id'] ?? NULL);
      if ($id === NULL) {
        continue;
      }
      $part = $node['schema:isPartOf']['@id'] ?? '';
      if (str_contains($part, 'attic')) {
        continue;
      }
      $types = (array) ($node['@type'] ?? []);
      $entry = array_filter([
        'about' => $text($node['rdfs:comment'] ?? ''),
        'pending' => str_contains($part, 'pending') ?: NULL,
        'superseded' => $ids($node['schema:supersededBy'] ?? NULL)[0] ?? NULL,
      ], static fn (mixed $value): bool => $value !== NULL && $value !== '');
      if (in_array('rdfs:Class', $types, TRUE)) {
        $classes[$id] = [
          'parents' => $ids($node['rdfs:subClassOf'] ?? NULL),
          'datatype' => in_array('schema:DataType', $types, TRUE),
        ] + $entry;
      }
      elseif (in_array('rdf:Property', $types, TRUE)) {
        $props[$id] = [
          'domains' => $ids($node['schema:domainIncludes'] ?? NULL),
          'ranges' => $ids($node['schema:rangeIncludes'] ?? NULL),
        ] + $entry;
      }
      else {
        // An enumeration member: typed with its enumeration.
        foreach ($types as $type) {
          $of = $name($type);
          if ($of !== NULL) {
            $members[$of][] = $id;
          }
        }
      }
    }
    // A datatype, an enumeration, or a kind of either, is not offered as a
    // type of an item.
    $kind = static function (string $type, string $of) use ($classes): bool {
      $seen = [];
      $queue = [$type];
      while ($queue) {
        $one = array_shift($queue);
        if ($one === $of || ($of === 'DataType' && !empty($classes[$one]['datatype']))) {
          return TRUE;
        }
        if (!isset($seen[$one])) {
          $seen[$one] = TRUE;
          array_push($queue, ...$classes[$one]['parents'] ?? []);
        }
      }
      return FALSE;
    };
    $types = [];
    foreach ($classes as $id => $class) {
      if ($id === 'DataType' || $kind($id, 'DataType') || $kind($id, 'Enumeration')) {
        continue;
      }
      $types[$id] = array_diff_key($class, ['datatype' => TRUE]);
    }
    ksort($types);
    ksort($props);
    ksort($members);
    return [
      'source' => $about['source'] ?? '',
      'release' => $about['release'] ?? '',
      'licence' => 'CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/)',
      'attribution' => 'Schema.org vocabulary, https://schema.org, by the schema.org community; trimmed by Canvas Metatag.',
      'types' => $types,
      'properties' => $props,
      'members' => array_intersect_key($members, array_filter($classes, static fn (array $class, string $id): bool => $kind($id, 'Enumeration'), ARRAY_FILTER_USE_BOTH)),
    ];
  }

  /**
   * The installed release, and where its file is.
   *
   * @return array{release: string, uri: string}|null
   *   NULL when none is installed.
   */
  public function installed(): ?array {
    foreach (['private', 'public'] as $scheme) {
      if (!$this->streamWrappers->isValidScheme($scheme)) {
        continue;
      }
      $files = is_dir("$scheme://canvas_metatag") ? scandir("$scheme://canvas_metatag") ?: [] : [];
      rsort($files, SORT_NATURAL);
      foreach ($files as $file) {
        if (preg_match('/^vocabulary-(\d+(?:\.\d+)*)\.json$/D', $file, $m)) {
          return ['release' => $m[1], 'uri' => "$scheme://canvas_metatag/$file"];
        }
      }
    }
    return NULL;
  }

  /**
   * Downloads a release, trims it and writes it to the site's files.
   *
   * @param string $release
   *   The release, like "29.4".
   *
   * @return string
   *   The file's URI.
   *
   * @throws \RuntimeException
   *   When it cannot be downloaded, read or written.
   */
  public function install(string $release = self::RELEASE): string {
    if (!preg_match('/^\d+(\.\d+){0,2}$/D', $release)) {
      throw new \RuntimeException('A release is a version number, like ' . self::RELEASE . '.');
    }
    $source = sprintf(self::SOURCE, $release);
    $response = $this->httpClient->request('GET', $source, [
      RequestOptions::TIMEOUT => self::TIMEOUT,
      RequestOptions::ALLOW_REDIRECTS => ['max' => 3, 'protocols' => ['https']],
      RequestOptions::STREAM => TRUE,
    ]);
    $body = $response->getBody();
    $text = '';
    while (!$body->eof()) {
      $text .= $body->read(65536);
      if (strlen($text) > self::MAX_BYTES) {
        throw new \RuntimeException(sprintf('The release is larger than %d MB.', self::MAX_BYTES / 1048576));
      }
    }
    try {
      $data = json_decode($text, TRUE, 64, JSON_THROW_ON_ERROR);
    }
    catch (\JsonException) {
      throw new \RuntimeException('The release is not JSON-LD.');
    }
    $vocabulary = self::build(is_array($data) ? $data : [], ['source' => $source, 'release' => $release]);
    if (count($vocabulary['types']) < 100) {
      throw new \RuntimeException('The release has no schema.org types.');
    }
    $scheme = $this->streamWrappers->isValidScheme('private') ? 'private' : 'public';
    $directory = "$scheme://canvas_metatag";
    $this->fileSystem->prepareDirectory($directory, FileSystemInterface::CREATE_DIRECTORY | FileSystemInterface::MODIFY_PERMISSIONS);
    $uri = $this->fileSystem->saveData(
      (string) json_encode($vocabulary, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
      "$directory/vocabulary-$release.json",
      FileExists::Replace,
    );
    // One release at a time.
    foreach (scandir($directory) ?: [] as $file) {
      if (str_starts_with($file, 'vocabulary-') && $file !== "vocabulary-$release.json") {
        $this->fileSystem->delete("$directory/$file");
      }
    }
    return $uri;
  }

}
