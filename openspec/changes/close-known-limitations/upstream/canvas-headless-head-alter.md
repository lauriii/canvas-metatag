# Canvas: an alter hook for the content API head (G2)

**Draft — not posted.** For the Canvas issue queue on drupal.org
(canvas_headless). Search the queue for an existing issue first. A person
posts it. No agent does.

What the module does once this lands:

- It implements the hook in about 15 lines: check that it owns the entity,
  resolve the head, replace it, and add the cacheability.
- It deletes `HeadlessHead`, its service provider branch, the status report
  guard, its rebuild log line and four ARCHITECTURE section 11 rows, and raises the Canvas version
  constraint.

There is no runtime detection and no dual path.

```markdown
Title: Add an alter hook for the content API head

Description:

<h3 id="overview">Overview</h3>

The content API's <code>head</code> is built only by <code>CanvasContentHeadBuilder</code>, from Metatag when it is installed. A module that owns an entity's metadata has no supported way to contribute to it:

<ul>
<li><code>hook_metatags_alter</code> runs only when Metatag is installed, and it alters Metatag's tag values rather than head rows.</li>
<li><code>normalize()</code> then drops every canonical link, which a headless frontend needs on its own domain.</li>
<li><code>CanvasContentHeadBuilder</code> and <code>CanvasContentController</code> are final, and the controller type-hints the concrete builder. That leaves only one option: decorate the controller service, decode its JSON and encode it again.</li>
</ul>

That couples the module to the controller's class, method name, arguments and return type. The route enhancer sets <code>_controller</code> to <code>CanvasContentController::class . '::get'</code>, so renaming <code>get()</code> or adding an argument would turn every uncached content API request into a 500 through the decorator. A response subscriber avoids the 500, but it still has to read the <code>_canvas_use_template_draft</code> route option, <code>CanvasContentRoute</code> and <code>PreviewTokenInspector</code> to find the entity that was actually rendered.

<h3 id="proposed-resolution">Proposed resolution</h3>

Invoke <code>hook_canvas_headless_head_alter(array &$head, array $context)</code> at the end of <code>CanvasContentHeadBuilder::build()</code> and <code>::buildFromRoute()</code>, after <code>normalize()</code>, inside a render context whose bubbled metadata is merged into the returned cacheability. Document it in <code>canvas_headless.api.php</code>.

<code>$head</code> has the public shape: <code>title</code>, <code>meta</code>, <code>link</code>, <code>script</code>. <code>$context</code> carries:

<ul>
<li><code>entity</code>: the entity actually rendered (the auto-save copy in a draft preview, the rendered translation), or <code>NULL</code> for a route head;</li>
<li><code>route_match</code>;</li>
<li><code>view_mode</code>;</li>
<li><code>use_auto_save</code>: whether this response reads drafts;</li>
<li><code>is_entity_preview</code>: preview, revision and latest-version routes;</li>
<li><code>cacheability</code>: a <code>CacheableMetadata</code> merged into the response.</li>
</ul>

The controller already computes the last four, and passes them to <code>build()</code>.

After the alter, Canvas validates the result with the rules of <code>normalize()</code>: scalar attributes, no <code>on*</code> attributes, JSON-LD only for scripts, and the four top-level keys. It keeps canonical links, dropping them only from Metatag's own elements, where they point at Drupal.

A hook rather than a replaceable builder service: it matches <code>hook_canvas_headless_safe_permissions_alter</code> and <code>hook_metatags_alter</code>, several modules can take part, and Metatag keeps working unchanged.

Tests:

<ul>
<li>a unit case in <code>CanvasContentHeadBuilderTest</code>: an altered canonical link survives, and an <code>on*</code> attribute does not;</li>
<li>a kernel case in <code>CanvasContentControllerTest</code>: a test module implements the hook for a draft preview and for a translation, and the test asserts the context entity and that the alter's cache tag is on the response.</li>
</ul>

<h3 id="ui-changes">User interface changes</h3>

n/a
```
