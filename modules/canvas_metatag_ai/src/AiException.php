<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag_ai;

/**
 * A suggestion could not be produced, for a reason this module can name.
 */
final class AiException extends \RuntimeException {

  /**
   * Constructs the exception.
   *
   * @param 'not_configured'|'invalid_response'|'blocked' $reason
   *   Why: no default provider or prompt is set, the answer could not be
   *   used, or the site's guardrails stopped the call.
   */
  // phpcs:ignore Generic.CodeAnalysis.UselessOverridingMethod.Found -- It declares the public property.
  public function __construct(public readonly string $reason) {
    parent::__construct($reason);
  }

}
