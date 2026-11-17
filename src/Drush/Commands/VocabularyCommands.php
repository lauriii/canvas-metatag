<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag\Drush\Commands;

use Drupal\canvas_metatag\Vocabulary;
use Drush\Attributes as CLI;
use Drush\Commands\AutowireTrait;
use Drush\Commands\DrushCommands;

/**
 * Downloads the schema.org vocabulary for the hand-added JSON-LD form.
 */
final class VocabularyCommands extends DrushCommands {

  use AutowireTrait;

  public function __construct(
    private readonly Vocabulary $vocabulary,
  ) {
    parent::__construct();
  }

  /**
   * Downloads schema.org's vocabulary into the site's files.
   *
   * The release is fetched over https from schema.org, trimmed to what the
   * form of "Add your own JSON-LD" needs, and kept with its licence (CC BY-SA
   * 3.0) and attribution. The module never ships it.
   */
  #[CLI\Command(name: 'canvas-metatag:vocabulary')]
  #[CLI\Option(name: 'release', description: 'The schema.org release, like 30.1. Defaults to the one the module is tested with.')]
  #[CLI\Usage(name: 'drush canvas-metatag:vocabulary', description: 'Download the release the module pins.')]
  public function download(array $options = ['release' => Vocabulary::RELEASE]): int {
    try {
      $uri = $this->vocabulary->install((string) ($options['release'] ?: Vocabulary::RELEASE));
    }
    catch (\Throwable $e) {
      $this->io()->error('The schema.org vocabulary was not downloaded: ' . $e->getMessage());
      return self::EXIT_FAILURE;
    }
    $this->io()->success("The schema.org vocabulary is in $uri. Schema.org's definitions are CC BY-SA 3.0.");
    return self::EXIT_SUCCESS;
  }

}
