<?php

/**
 * @file
 * Removes the complex content fixture from a site.
 *
 * From the Drupal root:
 * @code
 * drush php:script web/modules/contrib/canvas_metatag/tests/fixtures/complex/teardown.php
 * @endcode
 *
 * Removes only what install.php made; safe to run when nothing is installed.
 */

declare(strict_types=1);

use Drupal\Tests\canvas_metatag\Fixture\ComplexContent;

require_once __DIR__ . '/../../src/Fixture/ComplexContent.php';

ComplexContent::teardown();
echo 'Complex content fixture removed.', PHP_EOL;
