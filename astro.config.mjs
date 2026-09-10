import { defineConfig } from 'astro/config';

// Static output, deployed to Cloudflare Pages with `npm run deploy`.
// Cloudflare serves from the domain root, so there is no `base` path.
// If a custom domain is added later, point `site` at it.
export default defineConfig({
  output: 'static',
  site: 'https://project-alpha-dlz.pages.dev',
});
