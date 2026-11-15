# Canvas: edit and publish config entities without overrides (G6)

**Draft — not posted.** This is for the Canvas issue queue on drupal.org.
Before posting, search the queue for an existing issue. A person posts it; no
agent does.

What the module does once this lands:

- The `content_template_presave` guard becomes a no-op. The module deletes it
  together with its ARCHITECTURE section 11 row (UPSTREAM ask 8).
- `Drafts::keep()` takes the module's value from Canvas's now override-free
  unchanged copy, so the module has one starting point for every draft, in
  the same commit.
- A dialog edit under an override no longer leaves a draft that never
  matches, and the README's G6 line goes.
- The test "Publishing under an override" stays as it is and must still
  pass. A scenario "An unchanged dialog write under an override leaves no
  draft" is added back.

```markdown
Title: Load config entities without configuration overrides when Canvas edits and publishes them

Description:

<h3 id="overview">Overview</h3>

Canvas's editing routes for config entities convert <code>{entity}</code> with core's <code>EntityConverter</code>, because they are not admin routes. Content templates, patterns and page regions therefore arrive with configuration overrides applied, whether those come from <code>settings.php</code>, from modules or from language overrides. Three things follow:

<ul>
<li><code>ApiLayoutController::post()</code> and <code>::patch()</code> start from that entity when no auto-save exists, and <code>AutoSaveManager::saveEntity()</code> normalizes it. The auto-save entry then holds the overridden values.</li>
<li>Publishing (<code>ApiAutoSaveController::post()</code>) saves that entity. This writes per-environment values, such as a staging-only setting, into active configuration, and config export then carries them to every environment.</li>
<li><code>getUnchangedHash()</code> compares against <code>loadUnchanged()</code>, which also applies overrides. A draft built from stored values therefore never equals the unchanged copy, and Canvas keeps reporting a change.</li>
</ul>

Core avoids this for admin routes with <code>AdminPathConfigEntityConverter</code>.

Steps to reproduce:

<ol>
<li>In <code>settings.php</code>, add <code>$config['canvas.content_template.node.article.full']['status'] = FALSE;</code>, or override any third-party setting of that template.</li>
<li>Open the Article template in Canvas, move a component, and publish.</li>
<li>Run <code>drush config:get canvas.content_template.node.article.full</code>. It shows the overridden value as stored.</li>
</ol>

<h3 id="proposed-resolution">Proposed resolution</h3>

Load config entities override-free on every Canvas route that edits or publishes them. This is not specific to content templates: patterns and page regions leak the same way, so the fix belongs where Canvas loads any config entity for editing. There are two ways to do this:

<ul>
<li>A parameter converter that calls <code>loadOverrideFree()</code>, used by the layout GET, PATCH and POST routes for content templates, patterns and page regions, and by the auto-save publish route.</li>
<li>A reload with <code>loadOverrideFree()</code> at the top of those controller methods.</li>
</ul>

In <code>AutoSaveManager</code>, use override-free loading for config entities in <code>getUnchangedHash()</code> and wherever the stored copy is compared or rebuilt. Keep rendering with overrides where Canvas shows what visitors get, and document that choice.

No public API changes. Optionally, add a route option <code>_canvas_config_override_free: TRUE</code> that contributed routes can opt into. There are no data model changes.

Tests: a kernel test that sets a <code>settings.php</code> override on a content template, makes a layout POST and publishes. It asserts that the stored configuration is unchanged, and that an edit that changes nothing leaves no auto-save entry.

<h3 id="ui-changes">User interface changes</h3>

n/a
```
