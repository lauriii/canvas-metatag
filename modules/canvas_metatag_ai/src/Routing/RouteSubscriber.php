<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag_ai\Routing;

use Drupal\Core\Routing\RouteSubscriberBase;
use Symfony\Component\Routing\RouteCollection;

/**
 * Makes the Prompt Library's delete form ask for the prompt's delete access.
 *
 * The AI module checks only its permission there, so the default prompts
 * that AiHooks::promptAccess() protects could still be deleted by URL.
 */
final class RouteSubscriber extends RouteSubscriberBase {

  /**
   * {@inheritdoc}
   */
  protected function alterRoutes(RouteCollection $collection): void {
    $collection->get('entity.ai_prompt.delete_form')?->setRequirement('_entity_access', 'ai_prompt.delete');
  }

}
