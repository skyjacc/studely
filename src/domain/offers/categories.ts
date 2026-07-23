// Central list of offer categories ("departments").
// Every offer references one of these slugs. Displayed as the card grid on the
// homepage and used to build /category/[slug] pages.
//
// `accent` is a mono warm-grey in the MONOLOG theme — tints stay neutral.

export interface Category {
  slug: string;
  name: string;
  /** Short one-line pitch shown under the name on cards. */
  description: string;
  /** Emoji mascot (legacy — unused; icons come from Lucide via Icon.astro). */
  emoji: string;
  /** Accent colour (hex) used for the card tint and category chips. */
  accent: string;
}

const MONO = '#cfcabf';

export const categories: Category[] = [
  { slug: 'dev-tools', name: 'Developer Tools', description: 'IDEs, APIs, CI and hosting, free for students.', emoji: '🛠️', accent: MONO },
  { slug: 'design', name: 'Design & Creative', description: 'Figma, Canva, Adobe and more, unlocked.', emoji: '🎨', accent: MONO },
  { slug: 'cloud', name: 'Cloud & Hosting', description: 'AWS, Azure and GCP credits with no card.', emoji: '☁️', accent: MONO },
  { slug: 'ai', name: 'AI & Machine Learning', description: 'Copilot, Perplexity and model credits.', emoji: '🤖', accent: MONO },
  { slug: 'learning', name: 'Courses & Learning', description: 'Free courses, certificates and textbooks.', emoji: '📚', accent: MONO },
  { slug: 'domains', name: 'Domains & Web', description: 'Free domains, SSL and CDN for your projects.', emoji: '🌐', accent: MONO },
  { slug: 'productivity', name: 'Productivity', description: 'Notion, note apps and planners with free Pro tiers.', emoji: '⚡', accent: MONO },
  { slug: 'entertainment', name: 'Entertainment', description: 'Spotify, YouTube and streaming student rates.', emoji: '🎧', accent: MONO },
  { slug: 'hardware', name: 'Hardware & Discounts', description: 'Student pricing on laptops and devices.', emoji: '💻', accent: MONO },
  { slug: 'finance', name: 'Finance & Perks', description: 'Student banking, cashback and everyday perks.', emoji: '💳', accent: MONO },
];

export const categorySlugs = categories.map((c) => c.slug) as [string, ...string[]];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
