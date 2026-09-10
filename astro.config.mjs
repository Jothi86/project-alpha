import { defineConfig } from 'astro/config';

// Static output, deployed to GitHub Pages (see .github/workflows/deploy-site.yml).
// This defaults to a project page at https://jothi86.github.io/project-alpha/.
// If a custom domain is added later, drop `base` and set `site` to that domain.
export default defineConfig({
  output: 'static',
  site: 'https://jothi86.github.io',
  base: '/project-alpha',
});
