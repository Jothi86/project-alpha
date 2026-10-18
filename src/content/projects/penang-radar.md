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

## Make your own

Works for any town, state or topic. You need a paid Claude plan (Pro or Max) and a
Gmail account. No code, nothing to install, and your computer can stay off.

**1. Fill in the boxes and copy the instructions.**

<div class="fill" data-src="/kits/routines/news-radar.txt" data-copy="Copy instructions">
<label>Place to watch <input data-key="AREA" placeholder="Penang" data-default="Penang"></label>
<label>Topics to put first <input data-key="TOPICS" placeholder="infrastructure, transport, utilities, floods, landslides, state government decisions" data-default="infrastructure, transport, utilities, floods, landslides, state government decisions"></label>
<label>Your email <input data-key="EMAIL" type="email" placeholder="you@gmail.com"></label>
</div>

**2. Connect Gmail to Claude (once).** Open
[claude.ai/customize/connectors](https://claude.ai/customize/connectors), find
**Gmail**, click **Connect**, and sign in.

**3. Create the routine.** Open [claude.ai/code/routines](https://claude.ai/code/routines)
and click **New routine**. Then:

- **Name:** anything, e.g. "News Radar".
- **Instructions:** paste what you copied in step 1.
- **Repositories:** skip. It doesn't need one.
- **Select a trigger:** choose **Schedule**, then **Daily**, and pick a time a few
  minutes past the hour (e.g. 8:05). Runs set exactly on the hour can start late.
- **Connectors** (bottom of the form): keep **Gmail**, and remove the rest.

Click **Create**. To test it straight away, open the routine and click **Run now**.
The email arrives a few minutes later.

**Change it later** by editing the instructions in the routine, for example to make
it five stories instead of three.
