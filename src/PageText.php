<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Cache\CacheTagsInvalidatorInterface;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\EntityPublishedInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\KeyValueStore\KeyValueFactoryInterface;
use Drupal\Core\KeyValueStore\KeyValueStoreInterface;

/**
 * A Canvas page's own text as its description, unless another page offers it.
 *
 * A page's candidates are its first texts after its heading
 * (PageContent::read()).
 * One key-value collection per language maps each candidate of a published
 * page to the pages offering it, and each page to its candidates. A page's
 * head depends on a tag per candidate, which is invalidated only when the
 * candidate moves between one page and several: saving a page does not
 * flush the others.
 *
 * @internal
 */
final class PageText {

  /**
   * The key-value collection, followed by a langcode.
   */
  public const COLLECTION = 'canvas_metatag.page_text.';

  public function __construct(
    private readonly PageContent $content,
    private readonly KeyValueFactoryInterface $keyValue,
    private readonly CacheTagsInvalidatorInterface $invalidator,
    private readonly EntityTypeManagerInterface $entityTypeManager,
  ) {}

  /**
   * Indexes stored pages: on install and update, for pages saved before.
   *
   * @param int $from
   *   The first page id to index.
   * @param int $count
   *   How many pages to index at most.
   *
   * @return int|null
   *   The id to go on from, or NULL when every page is indexed.
   */
  public function indexFrom(int $from, int $count = 25): ?int {
    if (!$this->entityTypeManager->hasDefinition('canvas_page')) {
      return NULL;
    }
    $storage = $this->entityTypeManager->getStorage('canvas_page');
    $ids = $storage->getQuery()->accessCheck(FALSE)->condition('id', $from, '>=')->sort('id')->range(0, $count + 1)->execute();
    $next = count($ids) > $count ? (int) array_pop($ids) : NULL;
    foreach ($storage->loadMultiple($ids) as $page) {
      if ($page instanceof ContentEntityInterface) {
        $this->index($page);
      }
    }
    $storage->resetCache($ids);
    return $next;
  }

  /**
   * The first of a page's candidates that no other published page offers.
   *
   * @param \Drupal\Core\Entity\ContentEntityInterface $page
   *   A Canvas page translation, stored or a draft.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Gets what the choice depends on.
   *
   * @return string
   *   Plain text, '' for none.
   */
  public function description(ContentEntityInterface $page, CacheableMetadata $cacheability): string {
    $langcode = $page->language()->getId();
    $store = $this->store($langcode);
    foreach ($this->content->read($page, $cacheability)['texts'] as $text) {
      $hash = self::hash($text);
      $cacheability->addCacheTags([self::tag($langcode, $hash)]);
      if (array_diff($store->get("text:$hash", []), [(int) $page->id()]) === []) {
        return $text;
      }
    }
    return '';
  }

  /**
   * Records what each translation of a page offers, as it is saved.
   *
   * An unpublished translation, or one that is gone, offers nothing.
   */
  public function index(ContentEntityInterface $page): void {
    if (!$page->isDefaultRevision()) {
      return;
    }
    $languages = array_keys($page->getTranslationLanguages());
    foreach ($languages as $langcode) {
      $translation = $page->getTranslation($langcode);
      $published = !$translation instanceof EntityPublishedInterface || $translation->isPublished();
      $texts = $published ? $this->content->read($translation, new CacheableMetadata())['texts'] : [];
      $this->set($langcode, (int) $page->id(), array_map(self::hash(...), $texts));
    }
    // A deleted translation.
    foreach (array_keys($page->getOriginal()?->getTranslationLanguages() ?? []) as $langcode) {
      if (!in_array($langcode, $languages, TRUE)) {
        $this->set($langcode, (int) $page->id(), []);
      }
    }
  }

  /**
   * Forgets a page in every language it has.
   */
  public function forget(ContentEntityInterface $page): void {
    foreach (array_keys($page->getTranslationLanguages()) as $langcode) {
      $this->set($langcode, (int) $page->id(), []);
    }
  }

  /**
   * Sets the candidates a page offers in a language.
   *
   * @param string $langcode
   *   The language.
   * @param int $id
   *   The page.
   * @param list<string> $hashes
   *   Its candidates' hashes.
   */
  private function set(string $langcode, int $id, array $hashes): void {
    $store = $this->store($langcode);
    $before = $store->get("page:$id", []);
    $tags = [];
    foreach ([[array_diff($before, $hashes), FALSE], [array_diff($hashes, $before), TRUE]] as [$changed, $add]) {
      foreach ($changed as $hash) {
        $ids = $store->get("text:$hash", []);
        $now = $add ? array_values(array_unique([...$ids, $id])) : array_values(array_diff($ids, [$id]));
        // Only a move between one page and several changes a description.
        if ((count($ids) > 1) !== (count($now) > 1)) {
          $tags[] = self::tag($langcode, $hash);
        }
        $now === [] ? $store->delete("text:$hash") : $store->set("text:$hash", $now);
      }
    }
    $hashes === [] ? $store->delete("page:$id") : $store->set("page:$id", array_values($hashes));
    $this->invalidator->invalidateTags($tags);
  }

  /**
   * Forgets every candidate of a language that is deleted.
   *
   * Uninstalling deletes the collections of the languages that exist then.
   */
  public function forgetLanguage(string $langcode): void {
    $this->store($langcode)->deleteAll();
  }

  /**
   * The collection of a language.
   */
  private function store(string $langcode): KeyValueStoreInterface {
    return $this->keyValue->get(self::COLLECTION . $langcode);
  }

  /**
   * A candidate's key.
   */
  private static function hash(string $text): string {
    return substr(hash('sha256', $text), 0, 16);
  }

  /**
   * The cache tag of a candidate in a language.
   */
  private static function tag(string $langcode, string $hash): string {
    return "canvas_metatag_page_text:$langcode:$hash";
  }

}
