<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag\Hook;

use Drupal\canvas_metatag\ShareRenderer;
use Drupal\canvas_metatag\ShareStore;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Entity\RevisionableInterface;
use Drupal\Core\Extension\Requirement\RequirementSeverity;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\file\FileInterface;
use Drupal\media\MediaInterface;
use Drupal\media\Plugin\media\Source\Image;
use Drupal\user\RoleInterface;

/**
 * Made share images: stored ones deleted when visitors lose them; status.
 *
 * A stored image lies in the public files, which anyone can fetch. So it
 * goes as soon as an anonymous visitor may no longer view what it shows.
 */
final class ShareHooks {

  /**
   * The entity types whose cards are stored.
   */
  private const OWNED = ['canvas_page', 'node'];

  public function __construct(
    private readonly ShareStore $store,
    private readonly ShareRenderer $renderer,
    private readonly EntityTypeManagerInterface $entityTypeManager,
  ) {}

  /**
   * Implements hook_entity_delete().
   */
  #[Hook('entity_delete')]
  public function entityDelete(EntityInterface $entity): void {
    if (in_array($entity->getEntityTypeId(), self::OWNED, TRUE)) {
      $this->store->forget($entity);
    }
    elseif ($entity instanceof FileInterface || $entity instanceof MediaInterface) {
      $this->forgetImage($entity);
    }
  }

  /**
   * Implements hook_entity_translation_delete().
   */
  #[Hook('entity_translation_delete')]
  public function translationDelete(EntityInterface $translation): void {
    if (in_array($translation->getEntityTypeId(), self::OWNED, TRUE)) {
      $this->store->forget($translation, $translation->language()->getId());
    }
  }

  /**
   * Implements hook_entity_update().
   *
   * An unpublished translation, or one anonymous visitors lost access to,
   * loses its stored image. An unpublished media item takes the stored
   * share versions of its image with it, and so does a file made temporary:
   * file cron deletes temporary files. Losing access through the anonymous
   * role's permissions loses every stored image: they are made again on
   * request.
   */
  #[Hook('entity_update')]
  public function entityUpdate(EntityInterface $entity): void {
    if ($entity instanceof RoleInterface && $entity->id() === RoleInterface::ANONYMOUS_ID) {
      $this->store->delete('');
      return;
    }
    if ($entity instanceof MediaInterface) {
      if ($entity->getOriginal()?->isPublished() && !$entity->isPublished()) {
        $this->forgetImage($entity);
      }
      return;
    }
    if ($entity instanceof FileInterface) {
      if ($entity->getOriginal()?->isPermanent() && !$entity->isPermanent()) {
        $this->forgetImage($entity);
      }
      return;
    }
    if (!$entity instanceof ContentEntityInterface || !in_array($entity->getEntityTypeId(), self::OWNED, TRUE)) {
      return;
    }
    // A forward draft: what visitors see has not changed.
    if ($entity instanceof RevisionableInterface && !$entity->isDefaultRevision()) {
      return;
    }
    // A result remembered from before the save would be stale.
    $this->entityTypeManager->getAccessControlHandler($entity->getEntityTypeId())->resetCache();
    $anonymous = new AnonymousUserSession();
    foreach (array_keys($entity->getTranslationLanguages()) as $langcode) {
      if (!$entity->getTranslation($langcode)->access('view', $anonymous)) {
        $this->store->forget($entity, $langcode);
      }
    }
  }

  /**
   * Forgets the stored share versions of a media item's or file's image.
   *
   * Only a permanent public image file, or an image media item's, ever has
   * one: a temporary file is never shared.
   */
  private function forgetImage(FileInterface|MediaInterface $entity): void {
    $field = $entity instanceof MediaInterface && $entity->getSource() instanceof Image ? $entity->getSource()->getConfiguration()['source_field'] ?? '' : NULL;
    $file = match (TRUE) {
      $field === NULL => $entity,
      $entity->hasField($field) => $entity->get($field)->entity,
      default => NULL,
    };
    // A file made temporary was permanent before this save.
    if ($file instanceof FileInterface && ($file->isPermanent() || $file->getOriginal()?->isPermanent())
      && str_starts_with((string) $file->getFileUri(), 'public://')
      && str_starts_with((string) $file->getMimeType(), 'image/')) {
      $this->store->forgetPhotos((int) $file->id());
    }
  }

  /**
   * The status report rows of share images.
   *
   * Whether this site makes them: GD with FreeType, public files on local
   * disk, and a card drawn in memory. Part of
   * CanvasMetatagHooks::runtimeRequirements(): a module implements a hook
   * once.
   */
  public function requirements(): array {
    $missing = match ($this->renderer->missing()) {
      'fonts' => new TranslatableMarkup("PHP's GD extension with FreeType is needed to make share images. Until it is installed, pages share their original images, and pages without one share the site's image when it is chosen, else none."),
      'files' => new TranslatableMarkup("The public files are not on this server's disk, so share images cannot be stored. Pages share their original images, and pages without one share the site's image when it is chosen, else none."),
      default => NULL,
    };
    if ($missing === NULL) {
      try {
        $drawn = $this->renderer->card(['title' => 'Sharing works', 'site_name' => 'Site']) !== NULL;
      }
      catch (\Throwable) {
        $drawn = FALSE;
      }
      $missing = $drawn ? NULL : new TranslatableMarkup("A test card could not be drawn with the bundled fonts, so share images are not made and links to them fail.");
    }
    return [
      'canvas_metatag_share' => [
        'title' => new TranslatableMarkup('SEO share images'),
        'value' => $missing === NULL ? new TranslatableMarkup('Made on this site') : new TranslatableMarkup('Not made'),
        'severity' => $missing === NULL ? RequirementSeverity::OK : RequirementSeverity::Warning,
      ] + ($missing === NULL ? [] : ['description' => $missing]),
    ];
  }

}
