<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag\Hook;

use Drupal\canvas_metatag\PageText;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\language\ConfigurableLanguageInterface;

/**
 * Keeps the index of the texts Canvas pages offer as their description.
 */
final class PageTextHooks {

  public function __construct(
    private readonly PageText $text,
  ) {}

  /**
   * Implements hook_ENTITY_TYPE_insert() and hook_ENTITY_TYPE_update().
   */
  #[Hook('canvas_page_insert')]
  #[Hook('canvas_page_update')]
  public function save(ContentEntityInterface $page): void {
    $this->text->index($page);
  }

  /**
   * Implements hook_ENTITY_TYPE_delete().
   */
  #[Hook('canvas_page_delete')]
  public function delete(ContentEntityInterface $page): void {
    $this->text->forget($page);
  }

  /**
   * Implements hook_ENTITY_TYPE_delete() for configurable_language.
   */
  #[Hook('configurable_language_delete')]
  public function deleteLanguage(ConfigurableLanguageInterface $language): void {
    $this->text->forgetLanguage((string) $language->id());
  }

}
