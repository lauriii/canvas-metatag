<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\Tests\canvas_metatag\Fixture\ComplexContent;

/**
 * Installs the complex content fixture in a kernel test.
 *
 * The test class must enable, besides the Canvas minimum: node, field,
 * taxonomy, media and canvas_metatag; and field_test (with entity_test) for
 * the field that visitors cannot view. Call setUpComplexContent() instead of
 * setUpSite().
 *
 * @see \Drupal\Tests\canvas_metatag\Fixture\ComplexContent
 */
trait ComplexContentTrait {

  use SeoFixtureTrait;

  /**
   * Fixture ids: entity type => fixture key => id, and `path` => key => path.
   *
   * @var array<string, array<string, int|string>>
   */
  protected array $complex = [];

  /**
   * Sets up the example site and installs the complex content on it.
   */
  protected function setUpComplexContent(): void {
    $this->setUpSite();
    $this->installEntitySchema('taxonomy_term');
    // Deleting the fixture's author clears its user data.
    $this->installSchema('user', ['users_data']);
    $this->installConfig(['taxonomy']);
    ComplexContent::createComponentDoubles();
    $this->complex = ComplexContent::install();
  }

}
