# Core: one rule for public file systems (G5, optional)

**Draft — not posted.** For the Drupal core issue queue (file system
component). It is optional and does not block anything: the module's
`Resolver::isPublic()` follows core's current rule. Search the queue for an
existing issue first. A person posts it. No agent does.

What the module does once this lands:

- `Resolver::isPublic()` calls `StreamWrapperManager::isPublic()`, and its own
  copy of the rule goes.
- The `BoundaryTest` case stays, now pointing at the core method.

```markdown
Title: Add StreamWrapperManager::isPublic() and honour file_additional_public_schemes in file access

Description:

<h3 id="overview">Overview</h3>

Core decides in four places whether a file system is public, and the four disagree.

Three of them follow the setting: <code>FileDownloadController</code>, <code>SystemHooks::fileDownload()</code> and <code>ImageStyleDownloadController</code> each read <code>$settings['file_additional_public_schemes']</code> and subtract <code>private</code> and <code>temporary</code>.

<code>FileAccessControlHandler::checkAccess()</code> does not. It compares the scheme with the literal <code>'public'</code>, so a file on a declared public scheme can be viewed only through an entity that references it, even though core serves that file to everyone. The same comparison grants anonymous <code>view</code> on a private file used by published media.

Contributed code that publishes file addresses to third parties (metadata, feeds, sitemaps) needs to know whether a file is public, and today it has to copy the rule a fifth time.

<h3 id="proposed-resolution">Proposed resolution</h3>

Add <code>StreamWrapperManager::isPublic(string $scheme): bool</code>. It returns TRUE for <code>public</code> and for registered schemes listed in <code>file_additional_public_schemes</code>, and never for <code>private</code> or <code>temporary</code>.

Use it in all four places. File access then treats every public scheme the way it treats <code>public</code> today.

For backwards compatibility, add the method to the class first and to <code>StreamWrapperManagerInterface</code> in the next major version.

Tests: unit cases for the method, including an unregistered scheme and <code>private</code> listed in the setting, and a kernel case showing that file access treats a declared scheme like <code>public</code>.

<h3 id="ui-changes">User interface changes</h3>

n/a
```
