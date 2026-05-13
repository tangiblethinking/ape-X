# UX Leadership Job Board
### Built for Christopher Kenreigh · uxapex.com

A full-stack Next.js web application that finds, audits, and ranks real open UX leadership roles — and generates tailored resumes and cover letters using the Anthropic Claude API.

---

## What It Does

- **Live job search** via Serper (Google Search API) + Claude AI with triple-layer audit
- **Job board** with filterable, sortable cards showing verified roles only
- **Resume & cover letter generation** tailored per job using your own templates
- **Application tracker** with additive status history (Applied → Interview → Offer → Rejected)
- **Settings panel** for editing instruction sets and API keys

---

## Setup Guide — Step by Step

### Step 1 — Get Your Anthropic API Key

1. Go to **https://console.anthropic.com/settings/keys**
2. Sign in or create an account
3. Click **"Create Key"**
4. Name it `ux-job-board`
5. Copy the key — it starts with `sk-ant-`
6. Store it somewhere safe (password manager) — you won't see it again

### Step 2 — Get Your Serper API Key

1. Go to **https://serper.dev**
2. Click **"Get Started"** and sign up (free tier = 2,500 searches/month)
3. After signup, go to **https://serper.dev/api-key**
4. Copy your API key

### Step 3 — Create a GitHub Repository

1. Go to **https://github.com/new**
2. Name it `ux-job-board` (or any name)
3. Set to **Private**
4. Click **Create repository**
5. Follow GitHub's instructions to push this code:

```bash
cd /path/to/this/folder
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ux-job-board.git
git push -u origin main
```

### Step 4 — Deploy on Vercel

1. Go to **https://vercel.com/new**
2. Click **"Import Git Repository"**
3. Connect your GitHub account if not already connected
4. Select your `ux-job-board` repository
5. Click **"Deploy"** — Vercel auto-detects Next.js

### Step 5 — Add Environment Variables in Vercel

1. After deploy, go to your project on **https://vercel.com/dashboard**
2. Click **Settings** → **Environment Variables**
3. Add these two variables:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-your-key-here` |
| `SERPER_API_KEY` | `your-serper-key-here` |

4. Set **Environment** to `Production`, `Preview`, and `Development`
5. Click **Save**
6. Go to **Deployments** → click the three dots on your latest deploy → **Redeploy**

Your app is now live at `your-project-name.vercel.app`.

### Step 6 — Local Development (Optional)

```bash
# Install dependencies
npm install

# Create local env file
cp .env.example .env.local
# Edit .env.local and paste your real keys

# Run dev server
npm run dev
# App runs at http://localhost:3000
```

---

## How to Update Instructions

1. Go to the **Settings tab** in the app
2. Edit any instruction set (Job Search, Resume, Cover Letter)
3. Click **Save** (saves to browser localStorage immediately)
4. Click **Download File** to get the updated `.txt` file
5. Replace the corresponding section in `lib/instructions.ts` with the new content
6. Commit and push to GitHub — Vercel auto-redeploys

---

## Updating Your API Key

**Option A — Quick (no redeploy):**
Settings tab → paste new key → Save Keys

**Option B — Permanent (survives browser clear):**
Vercel Dashboard → Settings → Environment Variables → update value → Redeploy

---

## File Structure

```
/pages
  index.tsx          — Main app (all tabs)
  /api
    search.ts        — Job search: Serper + Claude
    generate.ts      — Resume/cover letter generation
/lib
  instructions.ts    — Three instruction sets (edit to update)
  storage.ts         — localStorage helpers
/public
  resume-template.html       — Resume HTML template
  coverletter-template.html  — Cover letter HTML template
/styles
  globals.css        — Global styles
```

---

## Technology

- **Next.js 14** — React framework with API routes
- **Anthropic Claude API** — `claude-opus-4-5` for search processing and document generation
- **Serper API** — Google search results for live job discovery
- **localStorage** — All state persistence (no database needed)
- **Vercel** — Deployment platform

---

## Security Notes

- API keys stored in Vercel env vars are **server-side only** — never exposed to the browser
- localStorage keys in the UI are convenient fallbacks but are readable in browser devtools
- `.env.local` is in `.gitignore` — never committed to repo
- All API calls route through Vercel serverless functions (`/pages/api/`)

---

*Christopher Kenreigh · uxapex.com · linkedin.com/in/kenreigh/*
