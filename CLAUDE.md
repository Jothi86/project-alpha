# project-alpha

A personal catalog website: games, tools, and projects, organized by type. Astro static
site, deployed to Cloudflare Pages by `.github/workflows/deploy-cloudflare.yml` on
every push to `main` (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo
secrets — see README.md). No base path: the site is served from its host's root, so
self-hosted internal links use root-relative paths (`src/lib/links.ts` resolves these
against `BASE_URL`) rather than a hardcoded domain.

## Publishing behavior

The user wants everything they build — games, tools, personal projects — to have a
clear path to being published here, organized by type. This applies in any Claude Code
session where something is being built, not just this repo.

- **Before starting** a new game, tool, or project, ask whether it's meant to end up
  published here. This doesn't block starting the work — it just tells you whether to
  keep it deployable (a hosted demo, a clean README) while building.
- **When the build is finished and working**, proactively offer to publish it — don't
  wait to be asked. If the user agrees, use the `publish` skill
  (`.claude/skills/publish/SKILL.md`).
- If the user declines either question for a given piece of work, don't ask again for
  that same thing.

## Monetization

Everything on the site is free for now. A $1/month paid tier may be added later, once
the user decides on a milestone to trigger it — nothing to build for that yet. Every
catalog entry already carries a `tier: free|paid` field (defaulted to `free`) so adding
pricing later won't require restructuring existing content. Don't ask the user to make
per-item pricing decisions until they say the milestone has been reached.

## Design language

Dark, Roblox-inspired: near-black canvas (`--bg`), rounded card grid with colorful
gradient "thumbnails" (see `src/lib/gradient.ts` — deterministic per title, since real
cover art isn't always available), bold uppercase section labels, cobalt blue accent
for games, teal for tools, violet for projects, alert red for "coming soon" badges and
CTAs. Keep new pages consistent with `src/styles/global.css` and `ItemCard.astro`
rather than introducing new patterns.
