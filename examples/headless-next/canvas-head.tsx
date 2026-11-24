import { serializeJsonForHtml, type PageHead } from '@drupal-canvas/headless';
import { toNextMetadata } from '@drupal-canvas/headless-next';
import type { Metadata } from 'next';

// The CMS head is the page's whole head. A member it leaves out means none,
// never "inherit the layout's": a page without a description or a canonical
// gets an empty description and no alternates, not the layout's.

/** The page's metadata: toNextMetadata() plus the rows it drops. */
export function canvasMetadata(head: PageHead): Metadata {
  const metadata = toNextMetadata(head);
  const images: Record<string, string>[] = [];
  const locales: string[] = [];
  const times: Record<string, string> = {};
  for (const { property = '', content = '' } of head.meta ?? []) {
    if (property === 'og:image' || property === 'og:image:url') {
      images.push({ url: content });
    } else if (property.startsWith('og:image:') && images.length > 0) {
      // og:image:width, height, alt, type and secure_url describe the
      // og:image before them.
      const key = property.slice('og:image:'.length);
      images[images.length - 1][key === 'secure_url' ? 'secureUrl' : key] = content;
    } else if (property === 'og:locale:alternate') {
      locales.push(content);
    } else if (property === 'article:published_time') {
      times.publishedTime = content;
    } else if (property === 'article:modified_time') {
      times.modifiedTime = content;
    }
  }
  return {
    ...metadata,
    description: metadata.description ?? '',
    alternates: metadata.alternates ?? null,
    openGraph: {
      ...metadata.openGraph,
      ...(images.length > 0 ? { images } : {}),
      ...(locales.length > 0 ? { alternateLocale: locales } : {}),
      ...times,
    } as Metadata['openGraph'],
  };
}

/** The page's structured data, serialized so that no value ends the script. */
export function CanvasJsonLd({ head }: { head: PageHead }) {
  return head.script?.map((script, index) => (
    <script
      key={index}
      type={script.type}
      dangerouslySetInnerHTML={{ __html: serializeJsonForHtml(script.textContent) }}
    />
  ));
}
