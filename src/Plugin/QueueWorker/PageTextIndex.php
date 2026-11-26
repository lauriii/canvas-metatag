<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag\Plugin\QueueWorker;

use Drupal\canvas_metatag\PageText;
use Drupal\Core\Plugin\ContainerFactoryPluginInterface;
use Drupal\Core\Queue\Attribute\QueueWorker;
use Drupal\Core\Queue\QueueFactory;
use Drupal\Core\Queue\QueueWorkerBase;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Indexes the text of the Canvas pages an install left, 25 pages an item.
 *
 * An item is the page id to go on from; each queues the next.
 *
 * @internal
 */
#[QueueWorker(
  id: self::QUEUE,
  title: new TranslatableMarkup('Index the text of Canvas pages'),
  cron: ['time' => 30],
)]
final class PageTextIndex extends QueueWorkerBase implements ContainerFactoryPluginInterface {

  /**
   * The queue's name.
   */
  public const QUEUE = 'canvas_metatag_page_text';

  public function __construct(
    array $configuration,
    string $plugin_id,
    mixed $plugin_definition,
    private readonly PageText $pageText,
    private readonly QueueFactory $queues,
  ) {
    parent::__construct($configuration, $plugin_id, $plugin_definition);
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container, array $configuration, $plugin_id, $plugin_definition): self {
    return new self($configuration, $plugin_id, $plugin_definition, $container->get(PageText::class), $container->get('queue'));
  }

  /**
   * {@inheritdoc}
   */
  public function processItem($data): void {
    $next = $this->pageText->indexFrom((int) $data);
    if ($next !== NULL) {
      $this->queues->get(self::QUEUE)->createItem($next);
    }
  }

}
