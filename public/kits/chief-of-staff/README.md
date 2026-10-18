# Chief of Staff bot

A private Telegram bot that answers you by running [Claude Code](https://claude.com/claude-code)
on your own Windows PC. Ask it about your files from your phone, send it a photo of a
name card to save the contact, or check whether a brand name is free.

Only you can use it: it answers one Telegram chat (yours) and turns everyone else away.
Nothing runs in the cloud except Telegram, Claude and, for name cards, Google's Gemini.

## What you need

- A Windows 10 or 11 PC that stays on while you want to use the bot.
- A Claude plan that includes Claude Code (Pro or Max), or an Anthropic API key.
- Telegram on your phone.
- Optional: a free Gemini key from [Google AI Studio](https://aistudio.google.com/apikey), to read name cards.

## Install

Open **PowerShell** (Start menu, type "PowerShell") and paste:

```powershell
irm https://project-alpha-dlz.pages.dev/kits/chief-of-staff/install.ps1 | iex
```

The installer:

1. Installs Node.js and Claude Code if they are missing, and has you sign in to Claude once.
2. Opens @BotFather in Telegram so you can make your bot (send `/newbot`), then asks you to paste its token.
3. Asks for a Gemini key (optional) and which folder Claude may read (your Documents folder by default).
4. Sets the bot to start by itself whenever you log in, and restart if it ever stops.
5. Opens your bot in Telegram. Press **Start**, and the bot is paired with you.

Run the same line again any time to update the bot. Your settings are kept.

## Using it

Just message your bot.

- **Ask anything** about the files in your folder: "summarise the latest minutes", "draft a
  reply to this letter", "what did we agree with the contractor?". It remembers the conversation.
- **Name cards:** send a photo (front and back, or several cards at once). Add a caption to note
  where you met. You get a contact file back: tap it to save. Each card is also filed in
  `Name Cards` inside your folder, with a spreadsheet log (`name-cards.csv`).
- **Find people:** "who do I know at the bank who works in IT?" It searches the cards it filed.
- **`/brand <name>`:** checks whether the name is free as a .com / .my domain and on the main
  social networks. A clickable version is at http://localhost:8787 on the PC.
- `/reset` starts a fresh conversation. `/id` shows your chat id.

## What it can and cannot do

Claude can **read** the files in your folder and search the web. It **cannot** change or delete
files, run commands, or send or delete email. If you have connected Gmail to your Claude account,
it can read mail and prepare drafts; it only sends a draft when you reply `/send`.

To give it a smaller window into your files, run the installer again and pick a narrower folder,
or change `COS_WORK_DIR` in the `.env` file.

## Settings

Everything lives in `%USERPROFILE%\ChiefOfStaff\.env`:

| Setting | What it does |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Your bot's token from @BotFather. |
| `COS_ALLOWED_CHAT` | The one chat the bot answers. Filled in when you press Start. |
| `COS_WORK_DIR` | The folder Claude can read. |
| `GEMINI_API_KEY` | Turns on name card reading. |
| `COS_CARDS_DIR` | Optional: where name cards are filed (default: `Name Cards` inside `COS_WORK_DIR`). |
| `COS_BRAND_PORT` | Optional: port for the brand checker page (default 8787). |

After changing `.env`, restart the bot: `Stop-ScheduledTask ChiefOfStaffBot; Start-ScheduledTask ChiefOfStaffBot`.

## Optional: save name cards straight into Google Contacts

Without this, you get a contact file to tap and save, which works on any phone. To have cards
saved into Google Contacts automatically (and searchable by the bot), you need your own Google
Cloud app. It takes about 15 minutes:

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project and enable the **People API**.
2. Set up the OAuth consent screen (External, add yourself as a test user).
3. Create an OAuth client ID of type **Desktop app**.
4. Put its ID and secret in `.env` as `GOOGLE_CLIENT_ID=` and `GOOGLE_CLIENT_SECRET=`.
5. Run `node task\contacts-auth.mjs` in the bot's folder and sign in. Then restart the bot.

Cards then go into Google Contacts under a "Name Cards" label, an existing contact is updated
instead of duplicated, and `/undo` removes the contacts the last photo created.

## Checking on it

```powershell
Get-Content "$env:USERPROFILE\ChiefOfStaff\logs\bot.log" -Tail 30 -Wait   # watch it work
Get-ScheduledTask ChiefOfStaffBot                                         # is it running
```

## Uninstall

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\ChiefOfStaff\uninstall.ps1"
```

This stops the bot and deletes its folder. Your own files and filed name cards stay.

## Files

| File | What it is |
|---|---|
| `chief-of-staff.mjs` | The bot: listens to Telegram, hands messages to Claude Code, sends the answers back. |
| `cardread.mjs` | Reads name cards from a photo with Gemini, and joins a card's front and back. |
| `contacts.mjs` | Optional Google Contacts saving. |
| `brandcheck.mjs`, `brandserver.mjs`, `brand.html` | The brand name checker. |
| `run.ps1` | Keeps the bot running; restarts it if it stops. |
| `install.ps1`, `uninstall.ps1` | Setup and removal. |
| `task\register-task.ps1` | Registers the scheduled task (the installer runs it). |
| `task\contacts-auth.mjs` | One-time Google sign-in for Contacts saving. |

Plain Node.js, no packages to install. Personal use licence: see `LICENSE`.
