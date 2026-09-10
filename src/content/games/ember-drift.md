---
title: Ember Drift
summary: Arcade space shooter — steer through an asteroid field, split rocks, manage fuel, and take on a boss every third wave. Solo or 2-player.
status: live
date: 2026-09-11
tags: [arcade, space, 2-player, offline]
links:
  demo: /play/ember-drift.html
---

Fly a small ship through an asteroid field that keeps getting busier. Big rocks
take two hits and split into mediums, mediums split into smalls. Fuel drains
constantly — faster when you thrust — and shooting or dodging rocks tops it up,
so hiding in a corner won't last.

**Controls:** arrows or WASD to steer, `Space` to fire, `P` to pause, `M` for
sound. On a phone, drag to steer — it fires automatically.

**Two players:** pick "2 Players" on the menu. Player 1 (amber) uses the arrows
and `.` to fire; Player 2 (teal) uses WASD and `Space`. Score and fuel are
shared, shields are separate — if one of you is knocked out, the other can
revive them by grabbing a shield pickup.

**Power-ups:** S shield, T slow-time, I invincible, R rapid fire, F fuel.
Every third wave a boss arrives with a health bar; beat it for 500 points and a
big fuel top-up, or it leaves after 30 seconds.

It's a single self-contained file with all sound generated in the browser, so
once loaded it works offline — save the page and it keeps running.
