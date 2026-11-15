# Canvas: test the editor in Firefox and WebKit (G8 follow-up, optional)

**Draft — not posted.** This is for the Canvas issue queue on drupal.org. It
is optional: the module's own engine runs do not depend on it. It belongs to
the follow-up change `test-in-every-engine-and-language`. Search the
queue for an existing issue first. A person posts it; no agent does.

Related, already open, and not drafted again: Canvas's work item 3546597
(language-prefixed editor addresses). The module's `multilingual` suite pins
the current redirect.

```markdown
Title: Run the Playwright suite in Firefox and WebKit on a schedule

Description:

<h3 id="overview">Overview</h3>

Canvas's <code>playwright.config.ts</code> defines <code>firefox</code> and <code>webkit</code> projects but keeps them commented out, so the editor is tested in Chromium only. Editors use Firefox and WebKit browsers too. Extensions that run inside the editor, such as an extension iframe, cannot tell whether a failure in another engine is theirs or the host's.

<h3 id="proposed-resolution">Proposed resolution</h3>

Uncomment the two projects. Keep the <code>deviceScaleFactor: 1</code> and the 1920 × 1080 viewport already written there.

Add a scheduled CI job, nightly or weekly, that runs a smoke subset in both engines:

<ul>
<li>loading the editor;</li>
<li>adding and editing a component;</li>
<li>the page data form;</li>
<li>publish review;</li>
<li>language select;</li>
<li>an extension iframe: open, postMessage bridge, close.</li>
</ul>

Every merge request stays on Chromium only. A failure in one engine gets its own issue and a <code>test.fixme</code> linking to it, not a retry.

There are no API or data model changes.

<h3 id="ui-changes">User interface changes</h3>

n/a
```
