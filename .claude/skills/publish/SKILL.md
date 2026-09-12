---
name: publish
description: Publish a finished game, tool, or project to this catalog site (games/tools/projects, organized by type). Use when the user finishes building something and wants it published, or asks to publish/list/add something to the site.
---

# Publish to the catalog site

Content collections are defined in `src/content.config.ts`. Each published thing is
one markdown file under `src/content/<games|tools|projects>/<slug>.md`. This skill
turns a finished build into one of those files.

Everything on the site is free right now. Every entry already has a
`tier: free|paid` field for a possible future paid tier — don't ask the user to decide
pricing per item unless they bring it up; default to `free`.

Cards render a colorful gradient "thumbnail" automatically from the title
(`src/lib/gradient.ts`) — there's no cover-image field to fill in.

## 1. Confirm it's ready

Only run this when the thing actually works — built, and the user has said they're
happy with it. If that's not the case yet, don't publish.

## 2. Ask the questions you need

Ask only what you can't reasonably infer from the conversation or the code itself (you
already know the title, what it does, and its tech stack from having built it — don't
make the user repeat that). Confirm rather than re-ask where you can. What you actually
need to pin down:

1. **Category** — `games`, `tools`, or `projects`. Infer a default from what was built
   (playable → games; a utility, automation, or something like a personal newsletter
   → tools; anything else, including apps/bots/write-ups → projects) and confirm it
   rather than asking blind.
2. **One-line summary** (≤160 chars) — propose one, let the user edit it.
3. **Where does it live?** — a demo/live URL, a repo URL, or both. If it's not deployed
   anywhere yet, that's a blocker: publishing a dead link isn't useful. Either help get
   it hosted somewhere reachable first, or publish with `status: coming-soon` and only
   a repo link.
4. **Tags** — 2-5 short freeform tags, propose some, let the user adjust.
5. **Tools only — kind**: `newsletter`, `utility`, `automation`, or another short word
   describing what flavor of tool it is.
6. **Projects only — tech stack**: short list, you likely already know this.
7. **Status** — `live` (ready now) or `coming-soon` (listed, not usable yet). Never set
   `draft` or `example` here — those are for content not meant to show up at all.
8. **Featured?** — only ask if it's a strong flagship piece; default false.

Don't ask about `tier`/pricing — leave it at the schema default (`free`).

## 3. Write the entry

Slug: kebab-case of the title, unique within its collection directory.

Frontmatter shape (see `src/content.config.ts` for the authoritative schema — tools
add `kind`, projects add `techStack`):

```yaml
---
title: <title>
summary: <one-liner, <=160 chars>
status: live # or coming-soon
date: <today, YYYY-MM-DD>
tags: [<tag>, <tag>]
links:
  demo: <url or omit>
  repo: <url or omit>
---
```

Below the frontmatter, write a short body (a few paragraphs) describing how to
use/play it — pull this from what you already know of the project rather than asking
the user to write it themselves.

## 4. Validate before committing

Run `npm install` (first time only), `npm run check`, and `npm run build`. Fix any
schema/type errors before proceeding — a broken build must never be committed.

## 5. Commit, and ask before pushing

Commit the new content file with a message like `Publish "<title>" to <category>`.
Pushing updates the live site for anyone watching it, so confirm with the user before
pushing — same as any other push — unless they've already told you in this session to
push without asking.
