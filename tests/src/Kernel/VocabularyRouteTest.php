<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas_metatag\Drush\Commands\VocabularyCommands;
use Drupal\canvas_metatag\Vocabulary;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Kernel\Traits\RequestTrait;
use Drupal\Tests\user\Traits\UserCreationTrait;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response as GuzzleResponse;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Tests the downloaded schema.org vocabulary: the command, route and report.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(Vocabulary::class)]
#[Group('canvas_metatag')]
final class VocabularyRouteTest extends CanvasKernelTestBase {

  use RequestTrait;
  use SeoFixtureTrait;
  use UserCreationTrait;

  private const ROUTE = '/canvas-metatag/api/vocabulary?r=30.1';

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_test_sdc',
    'node',
    'field',
    'canvas_metatag',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->setUpSite();
  }

  /**
   * Absent, then downloaded with a stubbed client, then served.
   */
  public function testVocabulary(): void {
    $this->setUpCurrentUser(permissions: ['access content']);
    try {
      $this->request(Request::create(self::ROUTE));
      self::fail('The vocabulary is open without the dialog\'s permission.');
    }
    catch (AccessDeniedHttpException) {
      // Expected.
    }

    $this->setUpCurrentUser(permissions: ['access content', 'edit canvas metatag']);
    self::assertSame(404, $this->request(Request::create(self::ROUTE))->getStatusCode());
    self::assertNull($this->state()['vocabulary']);
    $requirements = $this->container->get('module_handler')->invoke('canvas_metatag', 'runtime_requirements');
    self::assertSame('Not downloaded', (string) $requirements['canvas_metatag_vocabulary']['value']);

    // The command, with a client that answers the release from a fixture.
    $asked = [];
    $stack = HandlerStack::create(new MockHandler([
      new GuzzleResponse(200, [], self::release()),
    ]));
    $stack->push(Middleware::history($asked));
    $uri = $this->vocabulary(new Client(['handler' => $stack]))->install();
    self::assertSame('https://schema.org/version/' . Vocabulary::RELEASE . '/schemaorg-current-https.jsonld', (string) $asked[0]['request']->getUri());
    self::assertSame(Vocabulary::TIMEOUT, $asked[0]['options']['timeout']);
    self::assertStringEndsWith('://canvas_metatag/vocabulary-' . Vocabulary::RELEASE . '.json', $uri);
    $file = json_decode((string) file_get_contents($uri), TRUE);
    self::assertStringStartsWith('CC BY-SA 3.0', $file['licence']);
    self::assertArrayHasKey('EmployerAggregateRating', $file['types']);

    $response = $this->request(Request::create(self::ROUTE));
    self::assertSame(200, $response->getStatusCode());
    self::assertEqualsCanonicalizing(['immutable', 'max-age=31536000', 'private'], explode(', ', (string) $response->headers->get('Cache-Control')));
    self::assertSame($file, json_decode((string) $response->getContent(), TRUE));
    self::assertSame(['release' => Vocabulary::RELEASE], $this->state()['vocabulary']);
    $requirements = $this->container->get('module_handler')->invoke('canvas_metatag', 'runtime_requirements');
    self::assertSame('Release ' . Vocabulary::RELEASE, (string) $requirements['canvas_metatag_vocabulary']['value']);

    // The command with its option: an older release is installed, and the
    // status report names the newer pinned one.
    $command = new VocabularyCommands($this->vocabulary(new Client(['handler' => HandlerStack::create(new MockHandler([new GuzzleResponse(200, [], self::release())]))])));
    $output = new BufferedOutput();
    $command->setInput(new ArrayInput([]));
    $command->setOutput($output);
    self::assertSame(VocabularyCommands::EXIT_SUCCESS, $command->download(['release' => '29.4']));
    self::assertStringContainsString('vocabulary-29.4.json', $output->fetch());
    $requirements = $this->container->get('module_handler')->invoke('canvas_metatag', 'runtime_requirements');
    self::assertSame('Release 29.4', (string) $requirements['canvas_metatag_vocabulary']['value']);
    self::assertSame('The module is tested with release ' . Vocabulary::RELEASE . '. Run drush canvas-metatag:vocabulary to update.', (string) $requirements['canvas_metatag_vocabulary']['description']);
    // Not a release: refused, and said so.
    self::assertSame(VocabularyCommands::EXIT_FAILURE, $command->download(['release' => 'latest']));
    self::assertStringContainsString('A release is a version number', $output->fetch());

    // Too large: refused, and nothing is written over.
    try {
      $this->vocabulary(new Client(['handler' => HandlerStack::create(new MockHandler([new GuzzleResponse(200, [], str_repeat(' ', Vocabulary::MAX_BYTES + 1))]))]))->install();
      self::fail('A release over the limit was written.');
    }
    catch (\RuntimeException $e) {
      self::assertSame('The release is larger than 4 MB.', $e->getMessage());
    }
  }

  /**
   * The vocabulary service with another HTTP client.
   */
  private function vocabulary(Client $client): Vocabulary {
    return new Vocabulary($client, $this->container->get('file_system'), $this->container->get('stream_wrapper_manager'));
  }

  /**
   * The dialog's state.
   */
  private function state(): array {
    return json_decode((string) $this->request(Request::create('/canvas-metatag/api/state'))->getContent(), TRUE);
  }

  /**
   * A release with enough types to count as one.
   */
  private static function release(): string {
    $release = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/tests/fixtures/vocabulary/release.jsonld'), TRUE);
    for ($n = 0; $n < 100; $n++) {
      $release['@graph'][] = [
        '@id' => "schema:Made$n",
        '@type' => 'rdfs:Class',
        'rdfs:comment' => 'A type.',
        'rdfs:subClassOf' => ['@id' => 'schema:Thing'],
      ];
    }
    return (string) json_encode($release);
  }

}
