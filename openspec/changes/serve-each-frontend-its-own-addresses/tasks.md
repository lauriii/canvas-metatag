# Tasks

Test paths: kernel tests in `tests/src/Kernel/`, unit tests in
`tests/src/Unit/`, vitest next to the source in `extension/src/`, Playwright in
`tests/e2e/`. "Two frontends" below means `https://www.example.com` (first,
the default) and `https://shop.example.com`, configured in
`canvas_headless.settings`, plus whatever address settings the case needs.
"Names shop" means `requestUri=/about?canvasFrontend=https://shop.example.com`.
Page cache cases use `PerRequestPageCache` and assert `X-Drupal-Cache`,
`X-Drupal-Dynamic-Cache` and `Cache-Control`. Browser checks run on the farm
site, one browser suite at a time, with screenshots attached to the merge
request.

## 1. Address settings (public-addresses)

- [ ] 1.1 Add `canvas_metatag.addresses` (`frontends[]` with `url`, `public`, `trailing_slash`, `languages[]`, `images`, `previews[]`) to the config schema with validation constraints, install it empty, and add a post-update that creates it and invalidates `rendered`. Prove it with a new `AddressSettingsTest` kernel test: one case per refused value in "Address settings are validated", "An image address can only fill in a path" (including `https://img{path}` and a `{height}` token), "Preview addresses are narrow" (including `https://*.hosting.example` refused and `https://feat-*.hosting.example` accepted) and "Selection is unambiguous" (overlapping patterns of two frontends, a public address equal to another frontend's, one language address on two frontends, a pattern matching an entry's address or language address), including an import refused with the member named. Add a `PostUpdateTest` case for an existing site.
- [ ] 1.2 Add a `Frontends` service that merges `canvas_headless` frontends with the entries that apply to them (by `FrontendUrl` canonical address, public address, or preview pattern as a preview), fills defaults, and re-validates on read so that a refused `settings.php` override is ignored. Prove it with `AddressSettingsTest` cases: a frontend without an entry, an entry that applies to nothing (ignored, reported), an override with credentials (ignored, reported), an entry surviving a reorder of `canvas_headless` frontends, and staging (frontends overridden to `https://staging.example.com`, matched as a preview of the www entry with its image address).

## 2. Selecting the frontend (public-addresses)

- [ ] 2.1 Add the middleware (priority 175, on `CanvasContentApiRequest::API_PATH`, main GET requests only, base path aware). It reads `requestUri` with `query->all()` and a string check, counts `canvasFrontend` only as one literal, undecoded name with a string value, normalizes the value (case, default port, one trailing slash, `FrontendUrl::fromConfig()`), matches it in the spec's order, sets `_canvas_metatag_frontend`, and triggers the page cache kill switch for a preview or a value that selects nothing. Prove it with a new `FrontendSelectionTest` kernel test covering: two frontends; `HTTPS://Shop.Example.com:443/`; an address without a scheme; an unknown address; a public address; a language address; a language address equal to another frontend's address (that frontend wins); a preview match; a look-alike host; a wrong port; a preview path that differs; a duplicate name; `canvasFronten%64`; an array value; an outer `canvasFrontend` (ignored).
- [ ] 2.2 Without a name, select the only frontend, or none when there are several. With none selected, build no page or image address and add no `noindex`. Prove it with `FrontendSelectionTest` cases: one frontend unnamed (its head), two frontends unnamed (no canonical, `og:url`, hreflang, image rows or JSON-LD script; robots the page's own; cacheable), and a misspelled name (the same head, the second request a page cache MISS with `private`).
- [ ] 2.3 Add the `canvas_metatag_frontend` cache context and add it to every head built while frontends exist. Prove cache isolation with `FrontendSelectionTest::testCacheIsolation`: anonymous `/about` naming shop, none, shop, none gives HIT on the third and fourth, each with its own head. Then, with the page cache bypassed by a preview token, each frontend twice gives a dynamic page cache HIT with its own head.
- [ ] 2.4 Prove that forged signals change no page address with `FrontendSelectionTest::testForgedSignals`. With www named, one anonymous request carries `X-Forwarded-Host` (with the reverse proxy trusted), `Origin`, `Referer`, `X-Consumer-ID`, `consumerId`, a header naming shop, and a different `Host` allowed by `trusted_host_patterns`. Its page addresses must equal those of the plain request, and the next plain request naming www must be a page cache HIT with the same head. Run it with an image address set; add a second case without one that documents that Drupal-hosted images follow core's file URL (the stated residual).
- [ ] 2.5 Emit `Canvas-Metatag-Address` (`<base or none>; <named|default|preview|unnamed|unrecognized>`) on content API responses with the module's head. Prove it with `HeadlessHeadTest` cases for each of the five words.
- [ ] 2.6 Add ARCHITECTURE.md §11 rows for the `canvas_headless` internals relied on: `CanvasContentApiRequest::API_PATH`, its request condition, middleware priority 150, attribute copying into the inner request, `requestUri` reaching the middleware intact, and `FrontendUrl::fromConfig()`. Add a contract case in `FrontendSelectionTest` that fails if any of them changes, with HEAD and `/canvas/content-api/` as negative cases on which both middlewares must agree.

## 3. One address builder (public-addresses, head-output, structured-data)

- [ ] 3.1 Replace `Resolver::origin()` and `publicUrl()` with an `Addresses` service. It handles the selection, the default frontend, `canvas_metatag_public_base` as the default frontend's public address, and the request host only for Drupal's own pages without frontends. Prove it with:
  - the existing `ResolverTest`, `CoupledHeadTest` and `HeadlessHeadTest` single-frontend cases, unchanged;
  - new cases for the setting with two frontends (the first on the setting, the second on its own address) and for a site without frontends (request host);
  - an invalid setting (ignored, reported).
- [ ] 3.2 Build page addresses in the frontend's form: language addresses with Drupal's language domain and prefix removed, the trailing slash before the query, the request's query never included, base paths, the front page per language, path overrides on the language's address, and alternates on another frontend in that frontend's form. Build `{home}` as the frontend's front page address. Prove it with a new `AddressesTest` kernel test covering every scenario of "Page addresses follow the frontend's form" and "The home address is the front page's", head-output's "A language with its own address", and structured-data's "A frontend under a path" (the `WebSite` `url` equals the front page canonical, with and without the slash setting). For "A language on its own domain in Drupal too", resolve the French page coupled and through the content API at `fr.cms.example.com`, and assert that the canonical, `og:url`, hreflang, every page `@id` and the linked French page are on `https://fr.example.com` and that no value names `fr.cms.example.com`. Remove the language-domain `ponytail:` comment in `Resolver`. Assert `languages:language_url` among the head's cache contexts in both, and prove cacheability's "A language found by its domain" with the page cache bypassed: a dynamic page cache HIT per host, each with its own language's head.
- [ ] 3.3 Leave out what can't be known: a domain-negotiated language with no frontend address, content API output with no frontend and no setting, a page address on a non-public host while Drupal's own host is production-like (complete-the-headless-frontend's rule, now per frontend, with its `Values::isPublicHost()` and `Values::isDevelopmentHost()`), a page without its own address (no canonical, `og:url` or script). Prove it with `AddressesTest` and `HeadlessHeadTest` cases, the latter fetching at `http://cms.internal:8080`, and keep that change's `HeadlessHeadTest` and `CoupledHeadTest` cases passing.
- [ ] 3.4 Route every address of the audit through the builder: canonical, `og:url`, hreflang, `facts`, linked internal and file values, media and linked images, `{home}`, ids and URLs in `SchemaGraph`, `{url}`, `{image}`. Prove it with `SchemaGraphTest` cases built for shop, and with the scan in 4.4.
- [ ] 3.5 Route the queued changes' producers through it:
  - share cards, photo versions and icons;
  - the theme-logo fallback, by its root-relative path;
  - the derived identity, stored as facts and addressed at head time;
  - component images, and breadcrumb `Link`s via `page()`;
  - `{media.uuid}`;
  - the head alter context, which gains the frontend and the builder.

  Prove it with a case built for shop in the kernel test each of those changes adds, asserting that every address is on `https://shop.example.com`, including a front page identity with a contact link and a logo.
- [ ] 3.6 Keep facts, not addresses, beyond a request, and key the resolver memo and the command-line report cache by frontend. Prove it with an `ApiTest` case (state for www, then shop, each with its own addresses), a describe-the-publisher case (identity saved, then resolved for shop), and a command test case asserting a second frontend never reads the first's entry.

- [ ] 3.7 Keep a hash of what the builder reads from `settings.php` (the public base setting, `file_public_base_url`, and the `$config` overrides of `canvas_headless.settings` and `canvas_metatag.addresses`, never module overrides) in state. Compare it in `hook_cron` and in a main-request subscriber before the dynamic page cache; on a difference, invalidate `config:canvas_metatag.addresses`, store the hash and log one notice. Remove the "cache rebuild" comment in `Resolver::origin()`. Prove it with a new `SettingsFileTest` kernel test using `PerRequestPageCache`, with `/about` page cached before each case:
  - the public base changed, then cron: `/about` a MISS with the new canonical;
  - an image address override changed in `$config`, then an uncached request for another path: `/about` a MISS with the new images;
  - `file_public_base_url` changed, then cron: `/about` a MISS with the new image host;
  - nothing changed, then cron: `/about` a HIT, no notice;
  - a language override of the address settings, requested in English then French: no invalidation;
  - the address settings saved: `/about` a MISS through the config tag alone, before any hash check;
  - every owned output holding a built address (coupled head, headless head, the command-line report cache) carries `config:canvas_metatag.addresses`.

## 4. Image addresses (public-addresses, share-images, headless-head)

- [ ] 4.1 Render the image address with `{base}` (never a language address), `{path}` (without Drupal's base path), `{source}` and `{width}`. Keep the declared type and size, leave out unknown sizes under sized templates, put files that aren't images on `{base}{path}`, and keep `url.site` only where Drupal's file address is used. Prove it with a new `ImageAddressTest` kernel test covering a proxied path on an English and a French (`/fr-fr`) page, an image service, `{source}` encoding, a logo, a made card (1200 × 630 PNG declared), a file without a size, a linked PDF under an image service, Drupal installed under `/cms`, and a file whose address a test module's `hook_file_url_alter()` moves to `https://files.example.net` (its own address, under `{base}{path}` and under an image service).
- [ ] 4.2 On the content API, without an image address or public file address, leave out images on a non-public host. Prove it with a `HeadlessHeadTest` case at `http://cms.internal:8080` (no `og:image`, no JSON-LD image, canonical on the frontend) and one at `https://cms.example.com` (images kept).
- [ ] 4.3 Make the made-image redirect root-relative, and the share route cookie-free. Prove it with cases in strengthen-zero-config-defaults' share route kernel test: rename a page, request the old path through a request whose host differs, and assert a 302 whose `Location` starts with `/` and the same bytes at the new path; and assert no `Set-Cookie` and no `Vary` but `Accept-Encoding`.
- [ ] 4.4 Prove "no Drupal host leaks" with a new `PrivateCmsTest` kernel test. Two frontends, shop with `images: '{base}{path}'`, a French translation on `https://fr.example.com`, and a domain-negotiated German that has an address. Fetch an owned page with every kind of address (image, made card, photo version, logo, derived identity link and logo, breadcrumbs, linked internal page, linked file, linked image, `{media.uuid}`, front page icons, a head alter row) through the content API at `http://cms.internal:8080`, published and as a draft with a preview token. Scan the JSON-encoded `head` and the module's headers for `cms.internal`, the language domains and the public file host: raw, `rawurlencode`, `urlencode`, JSON-escaped and base64 (host and `scheme://host`). The test must state that it scans only what the module adds, and include a negative control: with `{source}` in the template, it must find the encoded host.
- [ ] 4.5 Make a draft head on the content API never name the editor's share preview; leave out an image made from the draft. Prove it with the headless-head "A preview token" scenario in `HeadlessHeadTest`.
- [ ] 4.6 Prove headless and coupled parity for images with `HeadlessHeadTest` "Through the frontend": `og:image` on the frontend's address, equal in coupled HTML built for the same frontend.

## 5. Preview addresses (public-addresses)

- [ ] 5.1 Match preview patterns: anchored host, scheme, port and the pattern's exact path; build the base from the pattern with the declared host filled in. Prove it with `FrontendSelectionTest` cases for a match, a look-alike, a wrong port and another path, and an assertion that the cache context value is built from the pattern.
- [ ] 5.2 Build preview heads on the preview address with `noindex` first, language addresses unused, `max-age 0`, and a private response. Prove it with a new `PreviewAddressTest` kernel test for a branch deployment and an exact staging address: canonical, `og:url`, `@id`s, an image under `{base}{path}`, robots, `private`, and the second identical anonymous request a page cache MISS with no dynamic page cache entry.

## 6. Defaults and commands (public-addresses, command-line)

- [ ] 6.1 Prove that Drupal's own copy uses the default frontend with one canonical and no `noindex` with `CoupledHeadTest` cases for two frontends, and with the setting.
- [ ] 6.2 Add `--frontend` to the commands, refuse `base_unknown` for images on `http://default`, and repeat `--frontend` in `next`. Prove it with cases in make-the-module-agent-ready's command kernel test: shop's addresses, unknown frontend (`choice`, `allowed` listing both), images without a template or file base, and no frontend with no `--uri`.

## 7. Guardrails (public-addresses, seo-checks)

- [ ] 7.1 Replace complete-the-headless-frontend's "SEO public addresses" row with the full status rows, reusing its `Values::isPublicHost()` and `Values::isDevelopmentHost()`: errors (warnings on a development host, nothing for an address on a development host there too), warnings and the listing, with the paths to pass on and the line about Drupal's own pages. A plain http error names the fix: the frontend's public address for this environment, or `$settings['reverse_proxy']` when Drupal itself is reached over plain http behind a proxy that ends TLS. Keep that change's warning for a plain http request address on a production-like host. Prove it by extending its `StatusReportTest` kernel test to cover every bullet of the three status requirements. Include `http://localhost:3000` viewed at `https://cms.example.com`, at `http://cms.internal` and through Drush on `http://default` (errors) and at `https://cms.example.test` (no row); `http://www.example.com` at `https://cms.example.test` (warning); an entry that applies to nothing; a `{source}` template; a domain language without an address on shop (an error naming the language and shop); and a French alternate on a frontend that doesn't build it back.
- [ ] 7.2 Add the Checks rows "Visitors would get the address of a development site" (site administrators only, with the same development-host rule) and "Search engines are sent to an address visitors don't use" (typed addresses on Drupal's or a preview host, for every editor), with the state carrying the language domains and preview patterns to every user who may edit SEO. Prove it with `checks.test.ts` cases for each scenario, and an `ApiTest` case for the state an editor without site settings permissions gets.
- [ ] 7.3 Load the published `og:image` address in the dialog and compare its natural size. Report another size as to fix and a failed load as good to know, without delaying the link preview. Prove it with `checks.test.ts` cases using a stubbed image loader for a match, a mismatch and an error.

## 8. The dialog (site-seo, seo-dialog)

- [ ] 8.1 Accept `frontend` on the state route and every route that resolves a head (`canvas_headless` frontends only). Report `origin` with its source (`frontend`, `preview`, `settings`, `request`, `none`) and the frontend's address. Prove it with `ApiTest` cases for shop, for a preview address that is not a frontend (default used), for a staging frontend matching a preview pattern (`preview`), and for no frontend.
- [ ] 8.2 Send Canvas's active frontend (`drupalSettings.canvas.headless.frontendUrl`) from the extension. Prove it with a `host.test.ts` case, and a `tests/e2e/host-contract.spec.ts` case that fails if Canvas stops setting or updating that value when the editor switches.
- [ ] 8.3 Show the frontend's addresses in the previews, Output, Site and "About addresses" (naming the frontend). Load the link preview image from Drupal, and show no host before the state loads. complete-the-headless-frontend's headless sentences follow the frontend being previewed. Prove it with `Previews` and `Output` vitest cases, and a `model.test.ts` case that address joining never reads `location`.
- [ ] 8.4 Extend `tests/e2e/headless.spec.ts` to two frontends. The content API must give each named frontend its own head and none when unnamed, carry `Canvas-Metatag-Address`, and give a preview address `noindex` and `private`. The dialog must show shop's addresses after switching Canvas to shop. Run complete-the-headless-frontend's `headless-frontend.spec.ts` recipe test once more with heads fetched for a named shop.

## 9. Documentation

- [ ] 9.1 Rewrite the README's address section. Cover:
  - the model, the default frontend, and what a request that names nothing gets;
  - naming a frontend: the request URI that the headless recipe's `fetchPage()` sends names the frontend; the one-line path helper, verified against the core SDK and two framework adapters; one explicit per-environment variable, never a platform's deployment-address variable; the per-request form for an app that serves several hosts;
  - the address settings with per-environment overrides (staging through preview patterns);
  - image addresses: `{base}{path}` as the recommendation with the paths to pass on, the proxy bounds and the `Host` rewrite; other templates with the checklist (fixed format, allowed widths, pinned quality and fit, robots.txt);
  - preview patterns and their breadth rules, preview cache behaviour;
  - private CMS guidance (network or HTTP auth, then a web-server `X-Robots-Tag`; not robots.txt), and the coupled copy with several frontends;
  - the `Canvas-Metatag-Address` `curl` one-liner, the two-request check that an edge cache keys on the selection, the note on edges in front of the frontend, and the post-deploy check (production HTML has no `noindex` and no other host).

  - deployment: a `settings.php` change reaches cached heads at the next cron run or the first request the page cache does not answer, with no cache rebuild.

  Replace ARCHITECTURE.md's "Image URLs always stay on Drupal" and three-source list. Add the cache table to §13/§14. Remove the language-domain and cache-rebuild lines from the README's "Known limitations" and ARCHITECTURE.md's. Verify that `README.md` examples match the `AddressSettingsTest` fixtures and that cspell passes.
- [ ] 9.2 Add the upstream requests U1-U6 from design.md to `ARCHITECTURE.md` "Upstream" as drafts for the human to file. Do not file them.
- [ ] 9.3 Run `openspec validate --all --strict` and the full PHPUnit, vitest and Playwright suites (one browser suite at a time).

## 10. Manual QA on the farm site

- [ ] 10.1 On the farm site, configure two frontends and address settings for the second: an image address `{base}{path}`, a French address and a preview pattern. Then, with `curl`:
  - request `/canvas/content-api?requestUri=/…` naming each frontend, a preview deployment, an unknown address, a duplicate name, and nothing;
  - send a forged `X-Forwarded-Host` and a header naming the second frontend;
  - record `X-Drupal-Cache`, `X-Drupal-Dynamic-Cache`, `Cache-Control`, `Canvas-Metatag-Address`, the canonical, `og:image` and robots for each, and run the README's two-request edge check.

  Confirm that no response names the farm site's host in `head` for the second frontend. Then change the public base in `settings.php`, run cron, and record that a cached page misses with the new canonical; restore `settings.php`.
- [ ] 10.2 View the status report with a `http://localhost:3000` frontend and with the valid configuration. Open the dialog on a page with Canvas switched to each frontend. Screenshot the search preview, the link preview, Output's "About addresses" and Checks for each, and attach them with the curl log. Restore the site's configuration afterwards.
