<?php

/**
 * @file
 * Installs or resets the complex content fixture on a site.
 *
 * From the Drupal root:
 * @code
 * drush php:script web/modules/contrib/canvas_metatag/tests/fixtures/complex/install.php
 * @endcode
 *
 * Prints the ids and paths of what it made, as JSON. Running it again keeps
 * the content and resets the content templates and their drafts.
 */

declare(strict_types=1);

use Drupal\Tests\canvas_metatag\Fixture\ComplexContent;

require_once __DIR__ . '/../../src/Fixture/ComplexContent.php';

echo json_encode(ComplexContent::install(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), PHP_EOL;
