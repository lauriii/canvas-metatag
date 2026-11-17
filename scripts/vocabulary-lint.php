<?php

/**
 * @file
 * Checks the module's data against schema.org's vocabulary (a CI job).
 *
 * Usage: php scripts/vocabulary-lint.php <release.jsonld>
 *
 * The release is the one Vocabulary::RELEASE pins, as schema.org publishes
 * it; it is trimmed with Vocabulary::build(), as the site's download is.
 * Every type the registry emits and the rules file judges, every name a
 * search feature needs or recommends, every `expects` type, and every type
 * and name in the shared graph fixtures must be schema.org's (or a pending
 * term). Exits 1 with a list of what isn't.
 */

declare(strict_types=1);

use Drupal\canvas_metatag\Vocabulary;

require __DIR__ . '/../src/Vocabulary.php';

$file = $argv[1] ?? '';
$release = is_file($file) ? json_decode((string) file_get_contents($file), TRUE) : NULL;
if (!is_array($release)) {
  fwrite(STDERR, "Usage: php scripts/vocabulary-lint.php <release.jsonld>\n");
  exit(2);
}
$vocabulary = Vocabulary::build($release, ['release' => Vocabulary::RELEASE]);
// Enumerations and datatypes are types a value may have, too.
$datatypes = ['Text', 'Number', 'Date', 'DateTime', 'Boolean', 'URL', 'Duration', 'Integer', 'Time', 'Thing'];
$known_type = static fn (string $type): bool => isset($vocabulary['types'][$type]) || isset($vocabulary['members'][$type]) || in_array($type, $datatypes, TRUE);
$known_name = static fn (string $name): bool => isset($vocabulary['properties'][$name]);
$problems = [];
$type = static function (string $type, string $where) use ($known_type, &$problems): void {
  if (!$known_type($type)) {
    $problems[] = "$where: “{$type}” is not a schema.org type";
  }
};
$path = static function (string $path, string $where) use ($known_name, &$problems): void {
  foreach (explode('|', $path) as $one) {
    foreach (explode('.', $one) as $name) {
      if ($name !== '' && !str_starts_with($name, '@') && !$known_name($name)) {
        $problems[] = "$where: “{$name}” (in {$one}) is not a schema.org name";
      }
    }
  }
};

$data = dirname(__DIR__) . '/data';
$registry = json_decode((string) file_get_contents("$data/schema-types.json"), TRUE);
foreach ($registry as $id => $entry) {
  if ($id === '$shapes' || !is_array($entry)) {
    continue;
  }
  foreach (['primary_type', 'page_type'] as $key) {
    if (isset($entry[$key])) {
      $type($entry[$key], "schema-types.json $id.$key");
    }
  }
  foreach ($entry['props'] ?? [] as $prop) {
    if (isset($prop['item'])) {
      $type($prop['item'], "schema-types.json $id.{$prop['key']}.item");
    }
    if (($prop['emit'] ?? NULL) === 'type') {
      foreach ($prop['options'] ?? [] as $option) {
        $type($option, "schema-types.json $id.{$prop['key']}.options");
      }
    }
  }
}

$rules = json_decode((string) file_get_contents("$data/search-features.json"), TRUE);
$expects = static function (mixed $spec, string $where) use ($type): void {
  $is = is_array($spec) ? (string) ($spec['is'] ?? '') : (string) $spec;
  $item = FALSE;
  foreach (explode('|', $is) as $token) {
    if (str_starts_with($token, 'item:')) {
      $item = TRUE;
      $token = substr($token, 5);
    }
    elseif (!preg_match('/^[A-Z]/', $token)) {
      $item = FALSE;
      continue;
    }
    if ($item) {
      $type($token, $where);
    }
  }
};
foreach ($rules['features'] ?? [] as $id => $feature) {
  foreach ($feature['on'] ?? [] as $one) {
    $type($one, "search-features.json $id.on");
  }
  foreach ([...$feature['required'] ?? [], ...$feature['recommended'] ?? [], ...$feature['complete'] ?? []] as $entry) {
    foreach ((array) $entry as $one) {
      $path($one, "search-features.json $id");
    }
  }
  foreach ($feature['names'] ?? [] as $name) {
    $path($name, "search-features.json $id.names");
  }
  foreach ($feature['expects'] ?? [] as $name => $spec) {
    $path((string) $name, "search-features.json $id.expects");
    $expects($spec, "search-features.json $id.expects.$name");
  }
}
foreach ($rules['expects'] ?? [] as $name => $spec) {
  $path((string) $name, 'search-features.json expects');
  $expects($spec, "search-features.json expects.$name");
}

// The shared graph fixtures: every type and name they use.
$walk = static function (mixed $value, string $where) use (&$walk, $type, $path): void {
  if (!is_array($value)) {
    return;
  }
  foreach ($value as $key => $one) {
    if ($key === '@type') {
      foreach ((array) $one as $name) {
        $type((string) $name, $where);
      }
    }
    elseif (is_string($key) && !str_starts_with($key, '@')) {
      $path($key, $where);
    }
    $walk($one, $where);
  }
};
foreach (glob(dirname(__DIR__) . '/tests/fixtures/features/*.json') as $fixture) {
  foreach (json_decode((string) file_get_contents($fixture), TRUE) as $case) {
    $walk($case['graph'] ?? [], basename($fixture) . ": {$case['name']}");
  }
}

if ($problems) {
  fwrite(STDERR, implode("\n", array_unique($problems)) . "\n");
  exit(1);
}
printf("Every type and name is schema.org's (release %s).\n", Vocabulary::RELEASE);
