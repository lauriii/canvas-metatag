<?php

/**
 * @file
 * Adds the preview content: what each content template opens with.
 *
 * From the Drupal root:
 * @code
 * drush php:script web/modules/contrib/canvas_metatag/tests/fixtures/complex/preview.php
 * @endcode
 *
 * Run install.php first. Prints the editor path of each content template, as
 * JSON. Safe to run again.
 */

declare(strict_types=1);

use Drupal\Tests\canvas_metatag\Fixture\ComplexContent;

require_once __DIR__ . '/../../src/Fixture/ComplexContent.php';

echo json_encode(ComplexContent::preview(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), PHP_EOL;
