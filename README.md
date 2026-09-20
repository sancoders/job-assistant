# Job Assistant — AI cover letters & screening answers from any job posting

A Chrome extension + [n8n](https://n8n.io) workflow that turns a job posting into a tailored **cover letter** and **answers to application/screening questions** in ~15 seconds — without leaving the tab. Built to make my own job search faster, and as a demonstration of the exact skill set the roles ask for: API orchestration, LLM integration and production automation.

> **Stack:** Chrome Extension (Manifest V3) · n8n · Claude (Anthropic API) · Supabase (PostgreSQL) · Telegram

---

## Why

Applying to jobs one by one is slow: read the posting, write a custom cover letter, answer the screening questions, repeat. This automates the writing while keeping me in control of the final click.

It also sidesteps a real constraint: **LinkedIn's CSP blocks page scripts from calling external APIs**, and scraping LinkedIn risks your account. A browser **extension** runs with its own permissions, so it reads the posting from the page you're already viewing and talks to the backend cleanly — no scraping, no bans.

## How it works

```
┌─────────────────────┐   job posting (DOM)   ┌────────────────────────────────────┐
│  Chrome Extension   │ ──────────────────▶   │  n8n webhook                       │
│  (reads the page)   │                       │   1. Parse input                   │
│   🎯 Score          │                       │   2. Load profile from Postgres    │
│   ✉️ Apply          │ ◀─── JSON response ── │   3. Screen for blockers ──┐       │
└─────────────────────┘  cover letter+answers │   4. Claude (Sonnet)       │       │
                                              │   5. Validate numbers      │       │
                                              │   6. Save + notify         │       │
                                              │      ◀─────────────────────┘       │
                                              │        blocked → save & reply,     │
                                              │        no model call               │
                                              └────────────────────────────────────┘
```

Two modes, two buttons:

- **🎯 Score** — fast fit evaluation (0–100) + reasons + red flags. Used to triage which jobs are worth applying to.
- **✉️ Apply** — generates a tailored cover letter + an answer for each screening question you paste in. Pushed to Telegram.

Both land in a `job_applications` table in Postgres, so a posting that was screened out stays on record with the reason.

### The profile is data, not prompt text

The prompt does **not** carry a hardcoded CV. On every run, `Load Profile` reads a
`profile_facts` table and takes only the rows where `verified_bool` is true:

```sql
select key, value from public.profile_facts where verified_bool = true
```

Anything unverified simply never reaches the model. Correcting a claim, retiring a
number that no longer has backing, or changing how a role is described is a row
update — not an edit to a prompt buried in a workflow export. The salary reference
comes back through a separate `_mercado` key so the model can't mistake market data
for something the candidate asserted about himself.

### Screening runs before the model does

`Screen Blockers` evaluates the posting against the profile **before** any Claude call:
years of experience demanded vs. available, and other hard blockers. If the posting is
disqualified, the workflow writes the row with its reason and replies to the extension
directly — the model call never happens. A job that was never going to work costs no
tokens, and the reason is on record to audit later.

### The model's numbers get checked

`Validate Numbers` sits between the Claude call and the response. It extracts every
number the model wrote across the cover letter and the answers, and checks each one
against the profile it was given. Anything without backing is returned as
`unverified_numbers` and surfaced at the top of the message, so an invented figure is
visible *before* the text gets pasted into a real application. It discards nothing and
decides nothing — it just refuses to let a fabricated number pass silently.

It also reports the failure mode explicitly when the response isn't usable: a JSON body
truncated by `max_tokens` is named as such, instead of surfacing as a bare parse error.

## Repo contents

- [`extension/`](extension/) — the Manifest V3 Chrome extension (popup UI + content extraction).
- [`workflow/cover-letter-generator.json`](workflow/cover-letter-generator.json) — the n8n workflow (sanitized; import and wire your own credentials).

## Run it yourself

1. **Backend:** import `workflow/cover-letter-generator.json` into n8n, add your Anthropic + Supabase/Postgres + Telegram credentials, and create the `profile_facts` and `job_applications` tables.
2. **Profile:** fill `profile_facts` with your own `key` / `value` rows and mark the ones you can stand behind as `verified_bool = true`. The workflow refuses to run against an empty profile rather than inventing one.
3. **Extension:** in `extension/popup.js`, set `WEBHOOK` to your n8n webhook URL. Then `chrome://extensions` → Developer mode → **Load unpacked** → select `extension/`.
4. Open a job posting, click **Score** or **Apply**.

> The export is sanitized: credential IDs, chat IDs and webhook IDs are `YOUR_*`
> placeholders. Nothing about a real profile is in this file — it lives in the database.

---

*Built by [Santiago Cione](https://github.com/sancoders) — AI Automation Specialist. Companion workflows: [n8n-automations](https://github.com/sancoders/n8n-automations).*
