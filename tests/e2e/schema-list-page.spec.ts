import { COMPLEX, UI, USERS } from './constants';
import { expect, openSeo, openTemplate, tab, test } from './fixture';

/**
 * A page that lists other pages, set up on its content type: its Courses
 * field links five courses, four with a summary. The verdict counts the
 * complete ones. The sandbox is the complex fixture plus courses (project
 * `schema-templates`).
 */

test('a list page of courses can show as a course list, counting the complete ones', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, COMPLEX.courseList.id, 'course_list');
  const frame = await openSeo(page);
  await tab(frame, UI.tab.schema).click();
  const line = frame.locator('.seo-feature', { hasText: 'Course list' });
  await expect(line).toContainText(`Can show: ${COMPLEX.courseList.complete} courses`, { timeout: 30_000 });
  await expect(frame.getByRole('button', { name: `Course list: Can show: ${COMPLEX.courseList.complete} courses` })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('course-list.png') });
});
