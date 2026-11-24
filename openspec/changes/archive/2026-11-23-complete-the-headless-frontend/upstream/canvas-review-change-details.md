# Canvas: let modules say what a pending change changes (item 6)

**Draft — not posted.** For the Canvas issue queue on drupal.org. Search the
queue for an existing issue first. A person posts it. No agent does.

What the module does once this lands:

- It implements the hook. For an owned page or template whose draft
  changes SEO values, it adds one detail, "SEO: ‹labels›", by comparing the
  stored SEO values of the draft and the published entity by top-level path.
- The template's draft status goes back to "Draft · goes live when you
  publish the template" (design D6).

```markdown
Title: Let modules add details to a change in "Review changes"

Description:

<h3 id="overview">Overview</h3>

"Review changes" names each pending change by the label its entity had when the draft was written (<code>AutoSaveManager::saveEntity()</code> stores <code>(string) $entity-&gt;label()</code>). <code>getChangeLabel()</code> in <code>ui/src/components/review/utils.ts</code> shows it unchanged, apart from brand kits. For a content template the label is "Article content items — Full content view".

That says which entity changed, but never what changed. An editor who changed a template's layout, and one who changed a setting a module stores on the template, see the same row. A module that stores values on pages or templates (SEO values, for example) has no way to say "this row includes your SEO change":

<ul>
<li>no hook or event fires when an auto-save entry is written or listed;</li>
<li><code>PendingChange</code> has no member for details;</li>
<li>replacing the entity class to change <code>label()</code> renames the entity everywhere.</li>
</ul>

Canvas's own edits have the same gap: a title change and a layout change look alike in the list.

<h3 id="proposed-resolution">Proposed resolution</h3>

Add an optional <code>details</code> member to each entry that <code>ApiAutoSaveController::get()</code> returns: a list of short plain strings, at most five, each at most 80 characters.

Fill it through <code>hook_canvas_pending_change_details_alter(array &amp;$details, array $context)</code>, documented in <code>canvas.api.php</code>. <code>$context</code> carries:

<ul>
<li><code>draft</code>: the auto-save copy of the entity;</li>
<li><code>published</code>: the stored entity, or <code>NULL</code> for an entity never saved;</li>
<li><code>langcode</code>;</li>
<li><code>cacheability</code>: a <code>CacheableMetadata</code> merged into the response.</li>
</ul>

Canvas may fill <code>details</code> for its own changes too ("Layout", "Title").

In the UI, <code>ChangeRow</code> renders the details under the label, joined with " · ", as plain text. <code>getChangeLabel()</code> is unchanged.

Strings are escaped as text, and the response stays cacheable with the alter's metadata. Modules return translated strings.

Tests:

<ul>
<li>a kernel case in <code>ApiAutoSaveControllerTest</code>: a test module adds "Test: one" to a node template's entry, and the list carries it with the module's cache tag;</li>
<li>a kernel case: a sixth detail and an 81-character detail are dropped or cut;</li>
<li>a component test for <code>ChangeRow</code>: details render under the label, and HTML in a detail renders as text.</li>
</ul>

<h3 id="ui-changes">User interface changes</h3>

Each row in "Review changes" can show one quiet line under its label, for example "SEO: Description, Social image".
```
