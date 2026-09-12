import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Shared shape for every catalog item, regardless of category.
// `tier` and `pricingNote` exist now so a future paid tier doesn't require
// a schema migration — every item defaults to free until that's revisited.
const itemSchema = z.object({
  title: z.string(),
  summary: z.string().max(160),
  status: z.enum(['live', 'coming-soon', 'draft', 'example']).default('draft'),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  tier: z.enum(['free', 'paid']).default('free'),
  pricingNote: z.string().optional(),
  cover: z.string().optional(),
  // A live, embeddable URL rendered as an iframe preview when there's no static `cover` —
  // useful for something that's already hosted and responsive (see stockscreen.md).
  embed: z.string().url().optional(),
  links: z
    .object({
      // Absolute URL for an external demo, or a root-relative path (e.g. "/play/x/")
      // for something self-hosted in this same site's public/ — resolved against
      // BASE_URL at render time so it survives a host/base-path change.
      demo: z.string().optional(),
      repo: z.string().url().optional(),
      other: z.string().url().optional(),
    })
    .default({}),
  featured: z.boolean().default(false),
});

const games = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/games' }),
  schema: itemSchema,
});

const tools = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tools' }),
  schema: itemSchema.extend({
    // e.g. "newsletter", "utility", "automation" — lets /tools group without new collections.
    kind: z.string().default('utility'),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: itemSchema.extend({
    techStack: z.array(z.string()).default([]),
  }),
});

export const collections = { games, tools, projects };
