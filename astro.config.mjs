import { defineConfig } from 'astro/config';

// Static output, deployed to Cloudflare Pages (see .github/workflows/deploy-cloudflare.yml).
// Served from the project's root on its own subdomain, so no base path is needed.
// If a custom domain is attached later, set `site` to it (cosmetic only — nothing
// in this codebase depends on it).
export default defineConfig({
  output: 'static',
});
