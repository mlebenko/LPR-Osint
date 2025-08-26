
# OSINT LPR/LVPR Wizard (Next.js on Vercel)

A minimal 3-step wizard:
1) Identify company (by name or INN) → candidates list with INN/region/OKVED + sources.
2) Find LPR/LVPR → shortlist with sources.
3) Build Markdown customer profiles for selected people (no JSON by default).

The backend uses OpenAI **Responses API** with the **web_search** tool enabled.
You must set `OPENAI_API_KEY` in the environment.

## Quick start (local)
```bash
npm i
cp .env.example .env.local  # then edit and paste your API key
npm run dev
```
Go to http://localhost:3000

## Deploy to Vercel
- Import this repo to GitHub and then to Vercel, or upload the zip directly.
- Set Environment Variable: `OPENAI_API_KEY`.
- Deploy.

## Notes
- Web search uses OpenAI's built-in tool; results depend on availability and may be rate limited.
- Only public information is used. Respect ToS/robots and local privacy laws.
