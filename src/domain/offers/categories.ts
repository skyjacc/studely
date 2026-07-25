// Central list of offer categories.
// Every offer references one of these slugs. Rendered on the homepage explorer,
// the /categories index and the /offers filter rail.
//
// Descriptions describe the DEPARTMENT, never its current contents. Naming a
// brand ("Figma, Canva, Adobe") or asserting an access fact ("with no card")
// makes this file a second, silently drifting source of truth: those strings
// claimed Adobe, AWS, Copilot and YouTube offers we have never listed, and
// promised "no card" for a category whose Google Cloud offer is scored
// card_required. Per-offer facts belong on the offer, where the data backs them.
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
  { slug: 'dev-tools', name: 'Developer Tools', description: 'IDEs, editors and the big student tool bundles.', emoji: '🛠️', accent: MONO },
  { slug: 'design', name: 'Design & Creative', description: 'Design, illustration and creative software.', emoji: '🎨', accent: MONO },
  { slug: 'cloud', name: 'Cloud & Hosting', description: 'Compute credits and hosting for student projects.', emoji: '☁️', accent: MONO },
  { slug: 'ai', name: 'AI & Machine Learning', description: 'Assistants, model access and AI tooling.', emoji: '🤖', accent: MONO },
  { slug: 'learning', name: 'Courses & Learning', description: 'Courses, certificates and academic software licences.', emoji: '📚', accent: MONO },
  { slug: 'domains', name: 'Domains & Web', description: 'Domains and SSL for your own projects.', emoji: '🌐', accent: MONO },
  { slug: 'productivity', name: 'Productivity', description: 'Notes, docs and planning apps.', emoji: '⚡', accent: MONO },
  { slug: 'entertainment', name: 'Entertainment', description: 'Music and streaming at student rates.', emoji: '🎧', accent: MONO },
  { slug: 'hardware', name: 'Hardware & Discounts', description: 'Education-store pricing on computers and tablets.', emoji: '💻', accent: MONO },
  { slug: 'finance', name: 'Finance & Perks', description: 'Memberships that unlock everyday student discounts.', emoji: '💳', accent: MONO },
];

export const categorySlugs = categories.map((c) => c.slug) as [string, ...string[]];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
