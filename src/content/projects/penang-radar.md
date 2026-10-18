---
title: Penang Radar
summary: A short email at 8.05am every day with the three Penang stories from yesterday that matter most for infrastructure, transport and the state government.
status: live
date: 2026-09-02
tags: [news, penang, email, automation, claude]
techStack: [Claude Code routines, Gmail, web search]
---

**The problem:** a lot of my work starts with something in the news: a landslide,
a flooded road, a burst pipe, a state decision. I need to know before someone asks
me about it, but I don't have time to read every Penang outlet every morning.

**What it does:** at 8.05am every day an email arrives with yesterday's three
biggest Penang stories, a few lines each. It puts infrastructure, transport,
utilities, floods, landslides and state government decisions ahead of general news.
It ends with one line on whether any of it needs action from me. On a quiet day it
says so in one line instead of filling space.

**How it works:** it runs as a scheduled Claude routine in the cloud, so it doesn't
need my PC to be on. Each morning Claude searches the news, picks the three stories,
writes the summary and sends the email. There is no code to maintain: the whole
thing is a set of instructions and a schedule.

**Limits:** some major news sites can't be opened from the cloud, so for those
stories the summary is built from search results rather than the full article.
For a three-line summary that is usually enough. The outlets it reads in full
include Buletin Mutiara, Free Malaysia Today, Malay Mail, Bernama and The Vibes.

**First run:** a ferry and a tanker colliding at Penang Port, council enforcement
against traders, and a fight in Ayer Itam. All three were real stories from the day
before, in the right format.
