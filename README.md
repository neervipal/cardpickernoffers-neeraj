# Card Picker & Offers

Single-page card picker for Neeraj's 11-card stack, with a Netlify-powered Live Offers panel.

## What is included

- `index.html`: category picker, card detail view, curated offers, known data gaps, and Live Offers UI.
- `netlify/functions/get-offers.mts`: reads saved offer results from Netlify Blobs.
- `netlify/functions/refresh-now.mts`: manually scans all cards.
- `netlify/functions/weekly-scan.mts`: refreshes every Monday at 06:00 IST.
- `netlify/functions/_shared.mts`: Tavily search, Gemini structuring, and Blob storage logic.

## Required Netlify environment variables

- `TAVILY_API_KEY`
- `GEMINI_API_KEY`

After adding or changing either key, redeploy the site once so the functions receive the new values.

## Deploy

Create a GitHub repo named `cardpickernoffers-neeraj`, push this folder, then import it in Netlify from GitHub.

Netlify settings:

- Build command: `npm install`
- Publish directory: `.`
- Functions directory: `netlify/functions`

After deployment, open the Offers tab and use `Refresh Now` once. The scheduled function should then run automatically every Monday morning.
