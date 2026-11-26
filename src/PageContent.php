<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\canvas\Entity\Component;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Cache\CacheTagsChecksumInterface;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\Core\StringTranslation\TranslationInterface;
use Drupal\Core\Utility\Error;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * What a Canvas page's own components show: its heading, text and image.
 *
 * Reads through the module's one component reader: Sources::tree() and
 * Sources::instances() say what renders, Sources::props() reads values by
 * the account rule. Only the page's own content is read, never its chrome.
 * A personalized part gives its default case, as visitors in no segment
 * (and link previews) get it; only code components give values, while a
 * container that is not one (a personalization switch) is read through.
 * Nothing here ever breaks a head.
 *
 * @internal
 */
final class PageContent {

  /**
   * The label Canvas gives a new page (ApiContentControllers::defaultTitle()).
   *
   * A Canvas internal: CanvasPlaceholderTest pins it.
   */
  public const PLACEHOLDER = 'Untitled @singular_entity_type_label';

  /**
   * The props of the first top-level instance that hold its heading.
   */
  private const HEADING_PROPS = ['title', 'heading', 'headline'];

  /**
   * The kind each field type of a prop is read as: text, markup or image.
   */
  private const KINDS = [
    'string' => 'text',
    'string_long' => 'text',
    'text' => 'html',
    'text_long' => 'html',
    'text_with_summary' => 'html',
    'image' => 'image',
  ];

  /**
   * The shortest text that may describe a page.
   */
  private const TEXT_MIN = 50;

  /**
   * What read() found, by page object, for the request and the tree read.
   *
   * One head build reads a page up to three times (its heading, its text,
   * its image): the tree is read once, and again when anything it read was
   * changed since (a media item unpublished, the anonymous role saved).
   *
   * @var \WeakMap<\Drupal\Core\Entity\ContentEntityInterface, array{request: ?object, tree: array, read: array, cacheability: \Drupal\Core\Cache\CacheableMetadata, checksum: string}>
   */
  private \WeakMap $read;

  public function __construct(
    private readonly Sources $sources,
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly TranslationInterface $translation,
    private readonly LoggerChannelFactoryInterface $loggers,
    private readonly RequestStack $requestStack,
    private readonly CacheTagsChecksumInterface $checksums,
  ) {
    $this->read = new \WeakMap();
  }

  /**
   * The first heading, the texts after it and the images of a page.
   *
   * @param \Drupal\Core\Entity\ContentEntityInterface $page
   *   A Canvas page translation, stored or a draft.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Gets what was read.
   *
   * @return array{heading: string, texts: list<string>, images: list<array{uri: string, alt: string, width: int, height: int}>}
   *   The heading as plain text ('' for none); up to three texts of at least
   *   50 characters after it, as plain text, none starting with a copyright
   *   notice; the images visitors may see, in render order, as
   *   Sources::props() gives them.
   */
  public function read(ContentEntityInterface $page, CacheableMetadata $cacheability): array {
    // Kept for this request and this tree while what was read is unchanged:
    // a page edited in this request reads as edited.
    $request = $this->requestStack->getCurrentRequest();
    $tree = $page->hasField('components') ? $page->get('components')->getValue() : [];
    $kept = $this->read[$page] ?? NULL;
    if ($kept === NULL || $kept['request'] !== $request || $kept['tree'] !== $tree
      || !$this->checksums->isValid($kept['checksum'], $kept['cacheability']->getCacheTags())) {
      $own = new CacheableMetadata();
      $read = $this->sources->reading(fn (): array => $this->walk($page, $own));
      $kept = [
        'request' => $request,
        'tree' => $tree,
        'read' => $read,
        'cacheability' => $own,
        'checksum' => $this->checksums->getCurrentChecksum($own->getCacheTags()),
      ];
      $this->read[$page] = $kept;
    }
    $cacheability->addCacheableDependency($kept['cacheability']);
    return $kept['read'];
  }

  /**
   * The placeholder label of a new page, in a language.
   *
   * Canvas sets it in the language of the editor's interface, so a page may
   * hold it in another language than its own: both count.
   *
   * @return list<string>
   *   The label in the language, and as written.
   */
  public function placeholders(string $langcode): array {
    $singular = $this->entityTypeManager->getDefinition('canvas_page')->getSingularLabel();
    $in = function (string|\Stringable $label, array $arguments = []) use ($langcode): string {
      $source = $label instanceof TranslatableMarkup ? $label->getUntranslatedString() : (string) $label;
      return (string) $this->translation->translate($source, $arguments, ['langcode' => $langcode]);
    };
    $source = $singular instanceof TranslatableMarkup ? $singular->getUntranslatedString() : (string) $singular;
    return array_values(array_unique([
      $in(self::PLACEHOLDER, ['@singular_entity_type_label' => $in($singular)]),
      strtr(self::PLACEHOLDER, ['@singular_entity_type_label' => $source]),
    ]));
  }

  /**
   * Reads the instances of a page's own tree in render order.
   */
  private function walk(ContentEntityInterface $page, CacheableMetadata $cacheability): array {
    $result = ['heading' => '', 'texts' => [], 'images' => []];
    try {
      $own = array_filter($this->sources->tree($page, FALSE, $cacheability), static fn (array $part): bool => $part['owner'] === 'page');
      [$instances] = $this->sources->instances($own);
    }
    catch (\Throwable $e) {
      Error::logException($this->loggers->get('canvas_metatag'), $e, 'The components of a page could not be read: %type: @message in %function (line %line of %file).');
      return $result;
    }
    // Children by parent, in the order stored: the order they render in.
    $children = [];
    foreach ($instances as $instance) {
      $children[$instance['item']->getParentUuid() ?? ''][] = $instance;
    }
    $found = FALSE;
    $visit = function (array $level) use (&$visit, $children, $page, $cacheability, &$found, &$result): void {
      foreach ($level as $instance) {
        $this->take($instance, $page, $cacheability, $found, $result);
        $visit($children[$instance['uuid']] ?? []);
      }
    };
    $visit($children[''] ?? []);
    return $result;
  }

  /**
   * Takes the heading, texts and images an instance gives.
   *
   * @param array $instance
   *   One of Sources::instances().
   * @param \Drupal\Core\Entity\ContentEntityInterface $page
   *   The page.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Gets what was read.
   * @param bool $found
   *   Whether the first heading was found: set here.
   * @param array $result
   *   The result being built.
   */
  private function take(array $instance, ContentEntityInterface $page, CacheableMetadata $cacheability, bool &$found, array &$result): void {
    $component = Component::load($instance['component']);
    // A block's settings are not the page's words; Sources reported a
    // component that cannot be loaded.
    if (!$component instanceof Component || !in_array($component->get('source'), ['js', 'sdc'], TRUE)) {
      return;
    }
    $full = $found && count($result['texts']) >= 3;
    $kinds = [];
    foreach ($component->getSettings($instance['version'])['prop_field_definitions'] ?? [] as $name => $definition) {
      $type = (string) ($definition['field_type'] ?? '');
      $kind = $type === 'entity_reference' && ($definition['field_storage_settings']['target_type'] ?? NULL) === 'media' ? 'image' : self::KINDS[$type] ?? NULL;
      if ($kind !== NULL && (!$full || $kind === 'image')) {
        $kinds[$name] = $kind;
      }
    }
    if ($kinds === []) {
      return;
    }
    [$values] = $this->sources->props($instance, $kinds, $page, $cacheability);
    // A heading component: one named for it, as Canvas's own test and the
    // farm site's code components are.
    $local = substr($component->id(), strrpos($component->id(), '.') + 1);
    $heading = (bool) preg_match('/(?:^|[-_])heading$/', $local);
    $top = $instance['item']->getParentUuid() === NULL;
    foreach ($values as $name => [$status, $value]) {
      if ($status !== 'ok') {
        continue;
      }
      if ($kinds[$name] === 'image') {
        $result['images'][] = $value;
        continue;
      }
      $text = $kinds[$name] === 'html' ? Values::fromHtml((string) $value) : Values::plain((string) $value, PHP_INT_MAX);
      // The heading: a heading component's first text, or a title-like prop
      // of a component at the top of the page.
      if (!$found && ($heading || ($top && in_array(strtolower((string) $name), self::HEADING_PROPS, TRUE)))) {
        if ($text !== '') {
          $result['heading'] = Values::plain($text, 255);
          $found = TRUE;
        }
        continue;
      }
      if ($found && count($result['texts']) < 3 && mb_strlen($text) >= self::TEXT_MIN && !preg_match('/^(?:©|\(c\)|copyright\b)/iu', $text)) {
        $result['texts'][] = $text;
      }
    }
  }

}
