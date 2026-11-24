# Canvas SDK: map the whole head in the metadata adapter (items 2 and 4)

**Draft — not posted.** For the Canvas issue queue on drupal.org, component
`packages/headless-next`. Search the queue for an existing issue first. A
person posts it. No agent does.

What the module does once this lands:

- The README recipe shrinks to `toNextMetadata(page.head)` in the metadata
  function and `<CanvasJsonLd head={page.head} />` in the page.
- It deletes `examples/headless-next/canvas-head.tsx` and its README quote,
  and the contract test asserts that the adapter alone loses nothing.
- It removes ARCHITECTURE.md's `UPSTREAM(canvas)` ask 5 and the README line
  under "Notes for Canvas".

```markdown
Title: toNextMetadata(): keep og:image details, article times and the JSON-LD, and stop inheriting the layout's description and canonical

Description:

<h3 id="overview">Overview</h3>

<code>toNextMetadata()</code> keeps only the <code>og:*</code> keys that <code>addSocialValue()</code> lists. Every other <code>property</code> row is dropped on purpose, because <code>Metadata.other</code> would render it as a <code>name</code> tag. The framework's metadata object can represent the rows that are dropped today:

<ul>
<li><code>og:image:width</code>, <code>og:image:height</code>, <code>og:image:alt</code> and <code>og:image:type</code>: <code>openGraph.images</code> takes objects with <code>url</code>, <code>width</code>, <code>height</code>, <code>alt</code> and <code>type</code>;</li>
<li><code>article:published_time</code>, <code>article:modified_time</code>, <code>article:author</code>, <code>article:section</code> and <code>article:tag</code>: <code>openGraph.publishedTime</code>, <code>modifiedTime</code>, <code>authors</code>, <code>section</code> and <code>tags</code>, rendered when <code>openGraph.type</code> is <code>article</code>;</li>
<li><code>og:locale:alternate</code>: <code>openGraph.alternateLocale</code>.</li>
</ul>

So a CMS that sends a complete head loses the image's alt text and size and the article's dates on every page, and each app has to read <code>head.meta</code> again to restore them.

Two more gaps:

<ul>
<li><strong><code>head.script</code> is never rendered.</strong> The metadata object has no member for it, and the README only says to render omitted entries as head elements. <code>headless-tanstack-start</code> and <code>headless-angular</code> render JSON-LD; this adapter leaves every app to write the same loop and to remember <code>serializeJsonForHtml()</code>.</li>
<li><strong>A page without a description inherits the layout's.</strong> The framework merges metadata per top-level key, page over layout, and an absent <code>description</code> keeps the layout's. It then copies that description into <code>openGraph.description</code> and <code>twitter.description</code>. A site with a site-wide description in its root layout shows it on, and shares it from, every page whose CMS head has none. A page that sets <code>description: ''</code> renders no tag and inherits nothing.</li>
<li><strong>A page without a canonical inherits the layout's.</strong> A CMS leaves the canonical out when it can't know the page's public address. An absent <code>alternates</code> then keeps the layout's, and a common layout <code>alternates: { canonical: '/' }</code> points every such page at the home page. A page that sets <code>alternates: null</code> inherits nothing.</li>
</ul>

<h3 id="proposed-resolution">Proposed resolution</h3>

In <code>head.ts</code>:

<ul>
<li>Collect <code>og:image</code> and <code>og:image:url</code> rows as image objects. Attach each following <code>og:image:width</code>, <code>height</code>, <code>alt</code>, <code>type</code> and <code>secure_url</code> row to the last image, as the Open Graph protocol defines structured properties. Numbers stay strings or become numbers as the metadata types require.</li>
<li>Map the <code>article:*</code> rows listed above. Repeated <code>article:author</code> and <code>article:tag</code> rows become lists.</li>
<li>Map repeated <code>og:locale:alternate</code> rows to <code>alternateLocale</code>.</li>
<li>Set <code>description: ''</code> when the head has no description row, and <code>alternates: null</code> when it has neither a canonical nor hreflang links. The CMS head is the page's whole head, so "absent" means "none", not "inherit".</li>
<li>Leave <code>robots</code> as it is, in <code>other</code>. A layout's robots renders beside it, and crawlers apply the more restrictive of the two, so an app's own staging <code>noindex</code> survives.</li>
</ul>

Export a server component, <code>CanvasJsonLd</code>, from the package root:

<pre><code>export function CanvasJsonLd({ head }: { head: PageHead }) {
  return head.script?.map((script, index) =&gt; (
    &lt;script
      key={index}
      type={script.type}
      dangerouslySetInnerHTML={{ __html: serializeJsonForHtml(script.textContent) }}
    /&gt;
  ));
}</code></pre>

Document it next to <code>toNextMetadata()</code> in the README, and update the head matrix there.

Tests in <code>head.test.ts</code>:

<ul>
<li>two images, each with its own width, height and alt, stay two objects with their own details;</li>
<li>a detail row before any <code>og:image</code> is ignored;</li>
<li>an article head gives <code>publishedTime</code> and <code>modifiedTime</code>; a <code>website</code> head with stray <code>article:*</code> rows does not;</li>
<li>a head without a description gives <code>description: ''</code>, and one without a canonical or hreflang gives <code>alternates: null</code>;</li>
<li><code>CanvasJsonLd</code> escapes <code>&lt;/script&gt;</code>, <code>&amp;</code> and U+2028 in a value.</li>
</ul>

<h3 id="ui-changes">User interface changes</h3>

n/a

<h3 id="api-changes">API changes</h3>

<code>toNextMetadata()</code> returns more members, an empty <code>description</code> for a head without one, and null <code>alternates</code> for a head without a canonical. An app that relies on its layout's description or canonical for CMS pages without one must give those pages their own, which is the point. New export: <code>CanvasJsonLd</code>.
```
