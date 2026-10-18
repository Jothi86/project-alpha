---
title: Community Event Sign-ups
summary: A registration form in three languages, a printable QR poster and an automatic report after the event, set up in minutes for each new community event.
status: live
date: 2026-09-24
tags: [community, google forms, qr code, automation]
techStack: [Google Apps Script, Google Forms, Google Sheets, Python]
---

**The problem:** our residents' committee runs community events, like the
Mid-Autumn Festival. Every time, someone builds a sign-up form by hand, makes a
poster, then copies the responses into a report afterwards. That's half a day of
work, and the numbers end up scattered across phones and spreadsheets.

**What it does:**

- **A ready-made sign-up form** in English, Chinese and Malay. Residents give their
  name, phone number, address and how many people are coming.
- **A printable QR poster:** an A4 sheet with a QR code that opens the form. Stick it
  on the notice board or share it in the residents' chat group.
- **A report after the event, done automatically.** The morning after, a copy of all
  the registrations and a short summary (how many households, how many people in
  total) are saved into the event's folder, and the links arrive by email.

**How it works:** a Google Apps Script builds the form and its responses sheet in
one go. A small Python script turns the form's link into the QR poster as a Word
document. A one-off timer in Apps Script runs the export the day after the event,
then removes itself, so nothing is left running.

**Reusing it:** for the next event, change the title and date, run the script, and
make the poster from the new link. The whole setup takes a few minutes instead of
an afternoon.

**First use:** the Mid-Autumn Festival on 26 September 2026.
