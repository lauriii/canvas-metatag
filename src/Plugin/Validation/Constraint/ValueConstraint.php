<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag\Plugin\Validation\Constraint;

use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\Core\Validation\Attribute\Constraint;
use Symfony\Component\Validator\Attribute\HasNamedArguments;
use Symfony\Component\Validator\Constraint as SymfonyConstraint;

/**
 * The shape of a stored SEO value, or of one part of a composition.
 *
 * What the config schema's keys alone cannot say: a value has exactly one
 * key (a linked duration's unit aside), a composition holds at least one
 * part and at most Values::MAX_PARTS fields and facts. Configuration import,
 * recipes and Canvas's validation of a template refuse anything else. Which
 * fields a type offers is checked on write (Values::clean()).
 */
#[Constraint(
  id: 'CanvasMetatagValue',
  label: new TranslatableMarkup('SEO value', [], ['context' => 'Validation']),
  type: ['mapping'],
)]
final class ValueConstraint extends SymfonyConstraint {

  /**
   * A value with more or fewer keys than one.
   */
  public string $oneKey = 'A value has exactly one of text, fact, media, source or parts.';

  /**
   * A part of a composition with more or fewer keys than one.
   */
  public string $onePart = 'A part has exactly one of text, fact or source.';

  /**
   * A composition without parts.
   */
  public string $noParts = 'A composition has at least one part.';

  /**
   * A composition with too many fields and facts.
   */
  public string $tooMany = 'A composition has at most @max fields and facts.';

  #[HasNamedArguments]
  public function __construct(
    mixed $options = NULL,
    public bool $part = FALSE,
    ?array $groups = NULL,
    mixed $payload = NULL,
  ) {
    parent::__construct($options, $groups, $payload);
  }

}
