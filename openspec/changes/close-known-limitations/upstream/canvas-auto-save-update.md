# Canvas: atomic auto-save writes (G1)

**Draft — not posted.** For the Canvas issue queue on drupal.org. Search the
queue for an existing issue about auto-save locking first. A person posts it.
No agent does.

What the module does once this lands:

- `Drafts::write()` calls `update()`.
- `SeoAutoSaveManager`, the service provider swap, the "SEO values in Canvas
  drafts" warning, its ARCHITECTURE section 11 row, the dialog's write-again
  after a publish and the README residual line are deleted.
- The Canvas version constraint is raised in the same release.

```markdown
Title: Make auto-save read-modify-write atomic so concurrent writes stop overwriting each other

Description:

<h3 id="overview">Overview</h3>

Every auto-save write in Canvas reads the entry, changes the entity and saves the whole entity back, without a lock. <code>ApiLayoutController::post()</code> and <code>::patch()</code> read the entry when the request starts (memoized by <code>validateAutoSaves()</code>), convert the client data, and save at the end, often hundreds of milliseconds later. <code>ApiContentAutoSaveControllers::patch()</code> (the publish toggle), <code>ApiConfigAutoSaveControllers::patch()</code>, the reconciliation in <code>ApiLayoutController::get()</code> and <code>AutoSaveManager::onCanvasConfigEntitySave()</code> follow the same pattern.

A second write to the same entry that lands between such a read and its save is lost without an error:

<ul>
<li>Canvas itself: toggling "published" while a layout save of the same page is being processed. The layout save writes back the old status.</li>
<li>Publish: <code>ApiAutoSaveController::post()</code> reads every entry, saves the entities, then deletes the entries. A write that lands in between is neither published nor kept.</li>
<li>Contributed modules that keep data on an entity Canvas edits (a base field without a form widget, a config entity's third-party setting) cannot write into the draft safely. The editor's next layout save writes back the copy it read before. Checking <code>canvasLayoutRequestInProgress</code> in the browser does not help: a debounced save that starts afterwards still races.</li>
</ul>

<code>AutoSaveValidateTrait</code> cannot catch this, because by design it skips the hash check when the client id matches.

Steps to reproduce (kernel test): add a test module whose <code>hook_form_canvas_page_form_alter()</code> runs once and unpublishes the page through <code>ApiContentAutoSaveControllers::patch()</code>. The hook fires inside <code>ClientDataToEntityConverter::convert()</code>, between the read and the save in <code>ApiLayoutController::post()</code>. POST a layout with a changed title for that page. Expected: the draft has the new title and is unpublished. Actual: it has the new title and is still published.

<h3 id="proposed-resolution">Proposed resolution</h3>

Add an atomic update to <code>AutoSaveManager</code>:

<code>public function update(EntityInterface $entity, \Closure $change, ?string $clientId = NULL, int $wait = 5): AutoSaveEntity</code>

It holds a lock named after the auto-save key. It reads the entry without the memory cache, or starts from the stored entity, passes that entity to <code>$change</code>, saves it, and releases the lock. If <code>$change</code> throws, nothing is written and the lock is still released. If the lock cannot be taken within <code>$wait</code> seconds, it throws a new <code>AutoSaveBusyException</code>, which the controllers map to 409 with <code>Retry-After: 1</code> and "The draft is being saved; try again." (not 503: proxies replace 503 bodies, and the server is not unavailable). Core's database lock is re-entrant within a process and its <code>release()</code> drops the lock for every nesting level, so <code>update()</code> counts its own nesting per key and releases only at the outermost level.

Move each read-modify-write in Canvas into <code>update()</code>, with validation and conversion inside the closure: layout POST and PATCH, the content and config auto-save PATCHes, the reconciliation in <code>ApiLayoutController::get()</code> and <code>onCanvasConfigEntitySave()</code>.

Publish and discard take the same per-key locks, from reading the entries to deleting them, through <code>AutoSaveManager::withLocks(array $entities, \Closure $fn)</code>. It takes the locks in sorted key order, so it cannot deadlock.

<code>saveEntity()</code> stays for blind writes. Its docblock points to <code>update()</code> for any write that depends on what is stored.

Optionally, in the same direction: expose the client-id and hash check now in <code>AutoSaveValidateTrait::validateAutoSaves()</code> as a public service, so a module's closure can apply Canvas's conflict rule without using an internal trait.

An event carrying the previous entry was considered. It would let modules re-apply their values, but it would not fix the race between Canvas's own writers; a lock around the read-modify-write fixes both. The API changes are additions only: <code>update()</code>, <code>withLocks()</code> and <code>AutoSaveBusyException</code>. There are no data model changes. The cost is one semaphore insert and delete per auto-save write, with the lock held for one conversion of one entity. Tests: the kernel test above, one for a publish against a write, and a change record for <code>update()</code>.

<h3 id="ui-changes">User interface changes</h3>

n/a
```
