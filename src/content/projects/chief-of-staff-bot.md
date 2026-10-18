---
title: Chief of Staff Bot
summary: A private Telegram assistant that runs Claude on my own PC, so I can ask it to read files, check mail and file name cards from my phone.
status: live
date: 2026-10-18
tags: [telegram, claude, automation, name cards, phone]
techStack: [Node.js, Telegram Bot API, Claude Code, Gemini, Google People API, Windows Task Scheduler]
---

**The problem:** most of my work happens away from my desk: on site, in meetings,
on the road. The files, the mailbox and the tools are on my PC. I wanted to ask
for something from my phone and get the answer back, without opening a laptop.

**What it does:** I message my own Telegram bot and it answers like a chief of staff
who sits at my computer.

- **Ask anything about my work.** "Summarise the latest JKR minutes", "draft a reply
  to this complaint", "what did we tell the ADUN about the slope works?". It reads
  the files on my PC and replies in the chat, and it remembers the conversation.
- **Name cards, filed automatically.** Send a photo of a card (front and back, or a
  pile at once) and the contact is saved into Google Contacts with a label, filed
  in a folder and logged in a spreadsheet. If the person is already there, the
  existing contact is updated instead of duplicated.
- **Who do I know?** "Who do I know at TNB who is an engineer?" It searches my
  contacts and answers.
- **Brand checker.** `/brand <name>` checks whether the name is free as a domain
  and on the main social networks.

**How it works:** a small Node.js program on my PC listens to the bot. Each message
is handed to Claude Code, which reads the files and answers. Photos skip Claude and
go to Google's Gemini, which reads the card, then the program saves the contact
through the Google Contacts API. A Windows scheduled task starts it at logon and
restarts it if it ever stops, so it just runs.

**Guardrails:** only my own chat can use it. It can read and draft, but it cannot
send or delete mail, run commands or change files. Sending a draft takes an
explicit `/send` from me.

**Try part of it:** the name card reading is available to everyone as the
[Name Card Scanner](/play/name-card-scanner/), including connecting your own
Telegram bot.
