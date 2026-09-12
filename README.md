# project-alpha

A personal catalog: games, tools, and projects, organized by type. Built with
[Astro](https://astro.build) content collections, styled dark and Roblox-inspired
(rounded thumbnail card grid, colorful gradients, bold accents). Deployed as a static
site to GitHub Pages by `.github/workflows/deploy-site.yml` on every push to `main`.

Live at: https://jothi86.github.io/project-alpha/ (once GitHub Pages is enabled in
repo settings, which requires the repo to be public on the free plan)

## Structure

```
src/content.config.ts     # schema for games / tools / projects
src/content/games/*.md    # one file per published game
src/content/tools/*.md    # one file per tool (a newsletter is `kind: newsletter`)
src/content/projects/*.md # everything else
src/components/ItemCard.astro
src/lib/gradient.ts       # deterministic per-title gradient used as card "thumbnails"
src/pages/                # homepage + per-category listing + detail pages
```

Every entry is one markdown file: YAML frontmatter for structured data, a markdown
body for the human-readable description. `status: live` or `coming-soon` shows up on
the site; `draft` and `example` never do. Every entry also has a `tier: free|paid`
field, defaulted to `free` — a hook for a possible future paid tier, unused for now.

The three `example-*.md` files show the schema for each collection and are never
rendered (`status: example`). Safe to delete once the first real entries exist, or
leave them as reference.

## Adding something new

Don't hand-write entries — use the `publish` Claude Code skill
(`.claude/skills/publish/SKILL.md`), which asks the right questions and writes the
file for you. To do it by hand anyway, copy the shape of the matching `example-*.md`
file.

## Local development

```sh
npm install
npm run dev      # http://localhost:4321/project-alpha/
npm run build    # outputs to dist/
npm run check    # type-checks content against the schema
```

## Hosting

Currently a GitHub Pages project site, so every internal link is prefixed with the
`/project-alpha` base path (see `astro.config.mjs`). If a custom domain is added
later, drop `base` and point `site` at the new domain.
