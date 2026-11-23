<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag\Plugin\Validation\Constraint;

use Drupal\canvas_metatag\Values;
use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;

/**
 * Validates the CanvasMetatagValue constraint.
 */
final class ValueConstraintValidator extends ConstraintValidator {

  /**
   * {@inheritdoc}
   */
  public function validate(mixed $value, Constraint $constraint): void {
    assert($constraint instanceof ValueConstraint);
    if (!is_array($value)) {
      return;
    }
    if ($constraint->part) {
      if (count($value) !== 1) {
        $this->context->addViolation($constraint->onePart);
      }
      return;
    }
    $keys = array_keys($value);
    // A linked duration keeps the unit its field counts in.
    if (count(array_diff($keys, ['unit'])) !== 1 || (isset($value['unit']) && !isset($value['source']))) {
      $this->context->addViolation($constraint->oneKey);
      return;
    }
    if (!array_key_exists('parts', $value)) {
      return;
    }
    $parts = is_array($value['parts']) ? $value['parts'] : [];
    if ($parts === []) {
      $this->context->addViolation($constraint->noParts);
      return;
    }
    $fields = array_filter($parts, static fn (mixed $part): bool => !is_array($part) || !array_key_exists('text', $part));
    if (count($fields) > Values::MAX_PARTS) {
      $this->context->addViolation($constraint->tooMany, ['@max' => Values::MAX_PARTS]);
    }
  }

}
