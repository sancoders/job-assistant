# Job Assistant — AI cover letters & screening answers from any job posting

A Chrome extension + [n8n](https://n8n.io) workflow that turns a job posting into a tailored **cover letter** and **answers to application/screening questions** in ~15 seconds — without leaving the tab. Built to make my own job search faster, and as a demonstration of the exact skill set the roles ask for: API orchestration, LLM integration and production automation.

> **Stack:** Chrome Extension (Manifest V3) · n8n · Claude (Anthropic API) · Supabase (PostgreSQL) · Telegram

---

## Why

Applying to jobs one by one is slow: read the posting, write a custom cover letter, answer the screening questions, repeat. This automates the writing while keeping me in control of the final click.

It also sidesteps a real constraint: **LinkedIn's CSP blocks page scripts from calling external APIs**, and scraping LinkedIn risks your account. A browser **extension** runs with its own permissions, so it reads the posting from the page you're already viewing and talks to the backend cleanly — no scraping, no bans.

## How it works

```
┌─────────────────────┐     job posting (DOM)      ┌──────────────────────────────┐
│  Chrome Extension   │ ───────────────────────▶   │  n8n webhook                 │
│  (reads the page)   │                            │   1. Parse input             │
│   🎯 Score          │                            │   2. Build prompt (my CV     │
│   ✉️ Apply          │ ◀───── JSON response ───── │      context, mode-aware)    │
└─────────────────────┘   cover letter + answers   │   3. Claude (Sonnet)         │
                                                    │   4. Save to Supabase        │
                                                    │   5. Notify on Telegram      │
                                                    └──────────────────────────────┘
```

Two modes, two buttons:

- **🎯 Score** — fast fit evaluation (0–100) + reasons + red flags. Saved to a `scores` table. Used to triage which jobs are worth applying to.
- **✉️ Apply** — generates a tailored cover letter + an answer for each screening question you paste in. Saved to an `applications` table and pushed to Telegram.

The LLM prompt is loaded with my real profile and instructed to stay honest (it scores a Lead/5+-years role *low* and flags it, instead of inflating the match).

## Repo contents

- [`extension/`](extension/) — the Manifest V3 Chrome extension (popup UI + content extraction).
- [`workflow/cover-letter-generator.json`](workflow/cover-letter-generator.json) — the n8n workflow (sanitized; import and wire your own credentials).

## Run it yourself

1. **Backend:** import `workflow/cover-letter-generator.json` into n8n, add your Anthropic + Supabase + Telegram credentials, and create the `applications` / `job_applications` tables.
2. **Extension:** in `extension/popup.js`, set `WEBHOOK` to your n8n webhook URL. Then `chrome://extensions` → Developer mode → **Load unpacked** → select `extension/`.
3. Open a job posting, click **Score** or **Apply**.

> Secrets (API keys, tokens, chat IDs, instance URL) are redacted with `REDACTED_*` / `YOUR_*` placeholders.

## Screenshots

_TODO: add screenshots of the popup (score view + apply view) and a Telegram notification._

---

*Built by [Santiago Cione](https://github.com/sancoders) — AI Automation Specialist. Companion workflows: [n8n-automations](https://github.com/sancoders/n8n-automations).*
