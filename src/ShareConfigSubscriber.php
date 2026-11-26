<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\Core\Config\ConfigCrudEvent;
use Drupal\Core\Config\ConfigEvents;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Deletes stored images that configuration made outdated.
 *
 * The cards once pages without an image no longer share them, the site
 * image's share version once the site's image changes, and the site
 * icons once what they are drawn from changes: the site's name, logo or
 * colour, or the default theme and its logo. Outdated images are never
 * served (their addresses change); this only frees the disk.
 *
 * @internal
 */
final class ShareConfigSubscriber implements EventSubscriberInterface {

  public function __construct(
    private readonly ShareStore $store,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    return [ConfigEvents::SAVE => 'onSave'];
  }

  /**
   * Reacts to a saved configuration object.
   */
  public function onSave(ConfigCrudEvent $event): void {
    $config = $event->getConfig();
    $name = $config->getName();
    if ($name === 'canvas_metatag.site'
      && $config->getOriginal('identity.share_fallback') === 'card'
      && $config->get('identity.share_fallback') !== 'card') {
      $this->store->forgetCards();
    }
    if ($name === 'canvas_metatag.site' && $config->getOriginal('identity.default_image') !== $config->get('identity.default_image')) {
      $this->store->delete('site');
    }
    $icon = match (TRUE) {
      $name === 'canvas_metatag.site' => ['identity.name', 'identity.logo', 'identity.colour'],
      $name === 'system.site' => ['name'],
      $name === 'system.theme' => ['default'],
      $name === 'system.theme.global', str_ends_with($name, '.settings') => ['logo'],
      default => [],
    };
    foreach ($icon as $key) {
      if ($config->getOriginal($key) !== $config->get($key)) {
        $this->store->delete('icon');
        return;
      }
    }
  }

}
