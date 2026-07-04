# Card Picker & Offers - Complete Portable Handoff

Last updated: 2026-07-05 IST

This document is designed to be given to any AI engine or developer so they can understand, maintain, edit, redeploy, or rebuild the `cardpickernoffers-neeraj` app without needing this chat history.

## Live Project

- Live site: https://cardpickernoffers-neeraj.netlify.app
- GitHub repo: https://github.com/neervipal/cardpickernoffers-neeraj
- Netlify project: https://app.netlify.com/projects/cardpickernoffers-neeraj
- Netlify site ID: `cbfee9ad-ea96-40ba-8ef1-50ee685ed6e5`
- Production branch: `main`

## What The App Does

This is a single-page HTML app for Neeraj/Raj credit-card strategy. It contains:

- Category-first card picker: ranks cards by BRR/MRR for spend categories.
- Card-first detail view: card profile, milestones, exclusions, lounge, forex, insurance, redemption.
- Curated offers/codes section: static reference offers and milestone reminders.
- Live Offers panel: fetches current promotional offers using Tavily search + Gemini structuring.
- Netlify Blobs storage: stores one saved offer result per card plus scan metadata.
- Manual refresh: Refresh Now button refreshes all 11 cards one by one.
- Weekly refresh: Netlify scheduled function refreshes every Monday at 06:00 IST.

## Source Research Context

The app was created from two source documents in `D:\Codex-Cowork Projects\Credit Card Strategy`:

1. `Card_Stack_Omnibus_Reference.md`
   - Canonical reference for the 11-card stack.
   - Contains fee status, benefits, milestones, BRR/MRR matrix, card details, exclusions, lounge terms, forex, insurance, redemption, and known data gaps.
   - Verified as July 2026 research.

2. `HANDOFF_live_offers_job.md`
   - Described the desired Live Offers tab and backend architecture.
   - Selected Tavily for search, Gemini Flash for structuring, Netlify Functions for backend, and Netlify Blobs for storage.
   - Required source transparency, confidence labels, weekly Monday refresh, and manual refresh.

## Architecture

- Frontend: vanilla `index.html`, no framework.
- Hosting: Netlify.
- Functions: Netlify Functions, TypeScript/ESM `.mts` files.
- Storage: `@netlify/blobs`, store name `live-card-offers`.
- Search API: Tavily.
- Structuring API: Gemini `gemini-2.5-flash`.
- Build command: `npm install`.
- Publish directory: `.`
- Functions directory: `netlify/functions`.

## Required Environment Variables

Set these in Netlify as secret variables, same value for all deploy contexts:

- `TAVILY_API_KEY`
- `GEMINI_API_KEY`

Do not commit these keys. They are stored only in Netlify environment variables.

## Netlify Functions

- `get-offers`: Reads saved offer data from Netlify Blobs. Fast read-only endpoint.
- `refresh-card`: Refreshes one card by `cardId`, saves that card result, updates metadata. This is what the frontend now uses for manual refresh.
- `refresh-now`: Older all-card refresh endpoint retained, but it may time out in live Netlify because all 11 card scans can exceed sync limits. Prefer `refresh-card` loop.
- `weekly-scan`: Scheduled function, cron `30 0 * * 1`, runs Monday 00:30 UTC / 06:00 IST.
- `_shared`: Card list, Tavily search, Gemini parsing, Blob read/write helpers, scan orchestration.

## Important Runtime Fix

The first live test of `refresh-now` timed out with an inactivity timeout. The fix was to add `refresh-card` and update the frontend `Refresh Now` button to refresh all 11 cards sequentially, one function call per card. This avoids Netlify synchronous function timeout limits and gives progress text like `Refreshing card 3 of 11...`.

## Verified Working

As of final verification:

- Live site loads.
- `get-offers` returns all 11 card records.
- `refresh-card?cardId=hsbc` returns real structured HSBC offers.
- Tavily and Gemini keys are picked up by Netlify Functions.
- Netlify Blobs write/read works.
- `weekly-scan` schedule is registered in Netlify: `30 0 * * 1`.
- Latest good commit containing timeout fix: `f807168d390b7b5f4c8ae07d5dec0dcff4f2892a`.

## Card IDs

These IDs must stay stable because they are used in Blob keys and frontend refresh calls:

`amex_pt`, `amex_mrcc`, `regalia`, `tata_neu`, `swiggy`, `au_xcite`, `onecard`, `amazon`, `sbi`, `atlas`, `hsbc`

Blob keys are `offer:<cardId>` plus `meta:last-scan`.

## Data Shape

````ts
type Offer = {
  title: string;
  description: string;
  discountText: string;
  cap: string | null;
  validTill: string | null;
  sourceUrl: string;
  confidence: "high" | "medium" | "low";
};

type CardOfferResult = {
  cardId: string;
  cardName: string;
  offers: Offer[];
  lastScanned: string;
  status: "ok" | "empty" | "error" | "never-scanned";
  errorMessage?: string;
};
````

## Maintenance Notes

- If changing the card list, update both frontend `LIVE_OFFER_CARD_IDS` and backend `CARDS`.
- If manual refresh gets slow, keep the per-card architecture; do not revert to all 11 cards in one request unless Netlify function limits are changed.
- `refresh-now` is retained for compatibility/background use, but frontend should use `refresh-card`.
- Gemini must remain a Flash/free-tier model unless intentionally changed.
- Tavily search depth was changed to `basic` and `max_results` to `3` to reduce latency.
- The app is currently single-file frontend, so HTML/CSS/JS changes all happen in `index.html`.
- The original static card data has some mojibake/encoding artifacts inherited from the source file. Functional behavior is fine, but a future polish pass could normalize rupee symbols/dashes/emojis.

## Troubleshooting

- If Live Offers says keys are missing, check Netlify environment variables and redeploy.
- If a card returns `error`, inspect Netlify function logs for `refresh-card`.
- If all cards are `never-scanned`, click Refresh Now or wait for Monday scan.
- If scheduled function does not run, verify Netlify deploy details show `weekly-scan` under function schedules.
- If deploy fails, confirm build command is `npm install` and publish directory is `.`.

## Full Current Source Code

### `index.html`

``html

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Card Picker &amp; Offers â€” Raj's Stack</title>
<style>
  :root{
    --bg:#0f1115;
    --panel:#171a21;
    --panel-2:#1e222b;
    --border:#2a2f3a;
    --text:#e8e9ec;
    --muted:#9398a6;
    --accent:#4fd1a5;
    --accent-2:#f2b84b;
    --danger:#e8695f;
    --ltf:#4fd1a5;
    --fee:#f2b84b;
    --radius:12px;
  }
  *{box-sizing:border-box;}
  body{
    margin:0;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    background:var(--bg);
    color:var(--text);
    line-height:1.5;
  }
  header{
    padding:28px 20px 18px;
    text-align:center;
    border-bottom:1px solid var(--border);
    background:linear-gradient(180deg,#151822,#0f1115);
  }
  header h1{
    margin:0 0 6px;
    font-size:1.6rem;
    letter-spacing:-0.02em;
  }
  header p{
    margin:0;
    color:var(--muted);
    font-size:0.9rem;
  }
  nav.tabs{
    display:flex;
    justify-content:center;
    gap:6px;
    flex-wrap:wrap;
    padding:14px 12px;
    position:sticky;
    top:0;
    background:var(--bg);
    z-index:10;
    border-bottom:1px solid var(--border);
  }
  nav.tabs button{
    background:var(--panel);
    color:var(--muted);
    border:1px solid var(--border);
    padding:9px 16px;
    border-radius:999px;
    font-size:0.88rem;
    cursor:pointer;
    transition:all .15s ease;
  }
  nav.tabs button:hover{ color:var(--text); border-color:#3a4152; }
  nav.tabs button.active{
    background:var(--accent);
    color:#0b0f0d;
    border-color:var(--accent);
    font-weight:600;
  }
  main{
    max-width:980px;
    margin:0 auto;
    padding:20px 16px 80px;
  }
  .view{ display:none; }
  .view.active{ display:block; }

  .cat-grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
    gap:8px;
    margin-bottom:22px;
  }
  .cat-btn{
    background:var(--panel);
    border:1px solid var(--border);
    color:var(--text);
    border-radius:var(--radius);
    padding:14px 10px;
    cursor:pointer;
    text-align:center;
    font-size:0.88rem;
    transition:all .15s ease;
  }
  .cat-btn:hover{ border-color:var(--accent); transform:translateY(-1px); }
  .cat-btn.active{ background:var(--accent); color:#0b0f0d; border-color:var(--accent); font-weight:600; }
  .cat-btn .emoji{ display:block; font-size:1.4rem; margin-bottom:4px; }

  .panel{
    background:var(--panel);
    border:1px solid var(--border);
    border-radius:var(--radius);
    padding:18px;
    margin-bottom:18px;
  }
  .panel h2{ margin-top:0; font-size:1.15rem; }
  .panel h3{ font-size:0.95rem; color:var(--accent); margin:18px 0 8px; text-transform:uppercase; letter-spacing:.04em; }
  .panel h3:first-of-type{ margin-top:4px; }

  .sort-row{ display:flex; gap:8px; align-items:center; margin-bottom:10px; font-size:0.85rem; color:var(--muted); }
  .sort-row select{
    background:var(--panel-2); color:var(--text); border:1px solid var(--border);
    border-radius:6px; padding:4px 8px; font-size:0.85rem;
  }

  table{ width:100%; border-collapse:collapse; font-size:0.86rem; }
  th,td{ text-align:left; padding:9px 8px; border-bottom:1px solid var(--border); vertical-align:top; }
  th{ color:var(--muted); font-weight:600; font-size:0.76rem; text-transform:uppercase; letter-spacing:.03em; }
  tr.best td{ background:rgba(79,209,165,0.08); }
  tr.best td:first-child{ border-left:2px solid var(--accent); }
  td.num{ white-space:nowrap; font-variant-numeric:tabular-nums; }
  .note{ color:var(--muted); font-size:0.82rem; }
  .neg{ color:var(--danger); }
  .pos{ color:var(--accent); }

  .card-picker{
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    margin-bottom:20px;
  }
  .card-chip{
    background:var(--panel);
    border:1px solid var(--border);
    color:var(--text);
    padding:8px 14px;
    border-radius:999px;
    cursor:pointer;
    font-size:0.85rem;
    display:flex;
    align-items:center;
    gap:6px;
  }
  .card-chip:hover{ border-color:var(--accent); }
  .card-chip.active{ background:var(--accent); color:#0b0f0d; border-color:var(--accent); font-weight:600; }
  .dot{ width:7px; height:7px; border-radius:50%; display:inline-block; }
  .dot.ltf{ background:var(--ltf); }
  .dot.fee{ background:var(--fee); }

  .badge{
    display:inline-block;
    font-size:0.72rem;
    padding:2px 8px;
    border-radius:999px;
    font-weight:600;
  }
  .badge.ltf{ background:rgba(79,209,165,0.15); color:var(--ltf); }
  .badge.fee{ background:rgba(242,184,75,0.15); color:var(--fee); }

  ul.clean{ margin:0; padding-left:18px; }
  ul.clean li{ margin-bottom:6px; font-size:0.9rem; }
  .warn{ color:var(--accent-2); }

  .grid-2{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media (max-width:640px){ .grid-2{ grid-template-columns:1fr; } }

  .offer-code{
    background:var(--panel-2);
    border:1px solid var(--border);
    border-radius:8px;
    padding:4px 8px;
    font-family:ui-monospace,Menlo,Consolas,monospace;
    font-size:0.8rem;
    color:var(--accent-2);
  }

  details{
    background:var(--panel-2);
    border:1px solid var(--border);
    border-radius:8px;
    padding:10px 14px;
    margin-bottom:8px;
  }
  details summary{
    cursor:pointer;
    font-weight:600;
    font-size:0.9rem;
  }
  details[open] summary{ margin-bottom:8px; }

  .gap-item{
    border-bottom:1px solid var(--border);
    padding:12px 0;
    font-size:0.88rem;
  }
  .gap-item:last-child{ border-bottom:none; }
  .gap-item b{ color:var(--accent-2); }

  footer{
    text-align:center;
    color:var(--muted);
    font-size:0.78rem;
    padding:24px 16px 40px;
  }

  .search-box{
    width:100%;
    padding:10px 14px;
    border-radius:999px;
    border:1px solid var(--border);
    background:var(--panel);
    color:var(--text);
    font-size:0.9rem;
    margin-bottom:16px;
  }
  .search-box:focus{ outline:none; border-color:var(--accent); }

  .live-offers-head{
    display:flex;
    justify-content:space-between;
    gap:12px;
    align-items:flex-start;
    margin-bottom:14px;
  }
  .live-offers-head h2{ margin-bottom:4px; }
  .refresh-btn{
    background:var(--accent);
    color:#0b0f0d;
    border:1px solid var(--accent);
    border-radius:999px;
    padding:9px 14px;
    font-weight:700;
    cursor:pointer;
    white-space:nowrap;
  }
  .refresh-btn:disabled{
    cursor:wait;
    opacity:.7;
  }
  .offer-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
    gap:10px;
  }
  .offer-card{
    background:var(--panel-2);
    border:1px solid var(--border);
    border-radius:8px;
    padding:12px;
  }
  .offer-card h3{
    margin:0 0 4px;
    color:var(--text);
    text-transform:none;
    letter-spacing:0;
    font-size:.98rem;
  }
  .offer-meta{
    display:flex;
    flex-wrap:wrap;
    gap:6px;
    margin:8px 0;
  }
  .pill{
    border:1px solid var(--border);
    border-radius:999px;
    padding:2px 8px;
    color:var(--muted);
    font-size:.74rem;
  }
  .pill.high{ color:var(--accent); border-color:rgba(79,209,165,.45); }
  .pill.medium{ color:var(--accent-2); border-color:rgba(242,184,75,.45); }
  .pill.low{ color:var(--danger); border-color:rgba(232,105,95,.45); }
  .status-line{
    color:var(--muted);
    font-size:.84rem;
    margin:4px 0 0;
  }
  .offer-source-toggle summary{
    color:var(--accent);
    font-size:.8rem;
  }
  .offer-source-toggle a{
    color:var(--text);
    word-break:break-word;
    font-size:.8rem;
  }
  @media (max-width:640px){
    .live-offers-head{ flex-direction:column; }
    .refresh-btn{ width:100%; }
  }

  .empty-state{ color:var(--muted); text-align:center; padding:40px 0; }
</style>
</head>
<body>

<header>
  <h1>ðŸ’³ Card Picker &amp; Offers</h1>
  <p>Raj's 11-card stack â€” verified July 2026 Â· BRR = realistic redemption Â· MRR = best achievable redemption</p>
</header>

<nav class="tabs">
  <button data-view="category" class="active">Pick by Category</button>
  <button data-view="card">Pick by Card</button>
  <button data-view="offers">Offers &amp; Codes</button>
  <button data-view="gaps">Data Gaps</button>
</nav>

<main>

  <!-- CATEGORY PICKER VIEW -->
  <section id="view-category" class="view active">
    <input type="text" id="catSearch" class="search-box" placeholder="Search categoriesâ€¦ (e.g. hotels, fuel, forex)">
    <div class="cat-grid" id="catGrid"></div>
    <div class="panel" id="catResult">
      <div class="empty-state">Pick a category above to see every card ranked by reward rate.</div>
    </div>
  </section>

  <!-- CARD DETAIL VIEW -->
  <section id="view-card" class="view">
    <div class="card-picker" id="cardPicker"></div>
    <div class="panel" id="cardResult">
      <div class="empty-state">Pick a card above to see its full profile and category rankings.</div>
    </div>
  </section>

  <!-- OFFERS VIEW -->
  <section id="view-offers" class="view">

    <div class="panel" id="liveOffersPanel">
      <div class="live-offers-head">
        <div>
          <h2>Live Offers</h2>
          <p class="note" id="liveOffersMeta">Not scanned yet. Deploy on Netlify, add the two API keys, then refresh.</p>
        </div>
        <button class="refresh-btn" id="refreshOffersBtn" type="button">Refresh Now</button>
      </div>
      <div id="liveOffersBody" class="empty-state">Live offers will appear here after the first scan.</div>
    </div>

    <div class="panel">
      <h2>âœˆï¸ HSBC TravelOne â€” Aggregator Discount Codes</h2>
      <p class="note">Stack these instant discounts with Track A points (4 RP/â‚¹100) on the discounted amount, transferred to Accor. Usage limits vary by platform â€” several are unpublished by HSBC, so re-verify before relying on repeat use.</p>
      <div style="overflow-x:auto;">
      <table>
        <thead><tr><th>Platform</th><th>Code</th><th>Domestic</th><th>International</th><th>Hotels</th><th>Valid Till</th><th>Frequency</th></tr></thead>
        <tbody id="hsbcOffersBody"></tbody>
      </table>
      </div>
    </div>

    <div class="panel">
      <h2>â›½ AmEx MRCC â€” Fuel Milestone Boost</h2>
      <p>Structure fuel spend as <b>exactly 4 separate transactions of â‚¹1,500</b> (â‚¹6,000 total) in one calendar month. This triggers the monthly milestone of 1,000 bonus MR points, worth â‚¹250 (BRR) or â‚¹500 (MRR via Marriott) on that â‚¹6,000 â€” an effective <span class="pos">4.17% BRR / 8.33% MRR</span> on that specific spend pattern only.</p>
      <p class="note warn">âš  Must be exactly 4 separate â‚¹1,500 transactions â€” fewer or larger swipes don't trigger it. Fuel itself still earns 0 points; this is purely the milestone bonus.</p>
    </div>

    <div class="panel">
      <h2>ðŸŽ¬ HDFC Swiggy â€” Cleartrip Instant Discounts</h2>
      <ul class="clean">
        <li>Flights: flat 6% instant discount + 5% cashback on the discounted amount (added 17 Apr 2026) â†’ 10.70% effective</li>
        <li>Hotels: flat 19% instant discount + 5% cashback on the discounted amount (added 17 Apr 2026) â†’ 23.05% effective, the single highest return in the entire stack outside HSBC's Hopper portal</li>
      </ul>
      <p class="note">Both capped at â‚¹1,500/billing cycle combined with the rest of the Swiggy 10%/5% buckets.</p>
    </div>

    <div class="panel">
      <h2>ðŸŽŸï¸ HSBC TravelOne â€” Movies</h2>
      <p>Buy 1 Get 1 free movie ticket (up to â‚¹200 off), twice a month, via the District by Zomato app, promo code <span class="offer-code">HSBCTOMOV</span>.</p>
    </div>

    <div class="panel">
      <h2>ðŸ’° Fee Waiver &amp; Milestone Thresholds</h2>
      <div style="overflow-x:auto;">
      <table>
        <thead><tr><th>Card</th><th>Fee</th><th>Waiver / Key Milestone</th></tr></thead>
        <tbody id="feeWaiverBody"></tbody>
      </table>
      </div>
    </div>

    <div class="panel">
      <h2>ðŸŽ¯ Milestone Targets, Per Card</h2>
      <div id="milestoneAccordion"></div>
    </div>

  </section>

  <!-- DATA GAPS VIEW -->
  <section id="view-gaps" class="view">
    <div class="panel">
      <h2>âš ï¸ Known Data Gaps &amp; Unresolved Conflicts</h2>
      <p class="note">Flagged explicitly rather than silently resolved. Treat anything marked [low confidence] or [medium confidence] as directional, not gospel.</p>
      <div id="gapsList"></div>
    </div>
    <div class="panel">
      <h2>ðŸ“š Source Provenance</h2>
      <ul class="clean">
        <li>BRR/MRR figures originate from <code>card_picker_final_1.html</code>, the canonical source for this stack, carried forward unchanged through every later revision.</li>
        <li>HSBC TravelOne's reward/cap structure was cross-checked against a personal Notion reference, with the Track A/Track B cap split independently confirmed.</li>
        <li>Axis Atlas figures were independently verified from official Axis Bank sources and review sites â€” the Notion reference was deliberately excluded here since it predates the April 2026 Accor/Marriott/Qatar transfer-partner removal.</li>
        <li>All other figures sourced from official bank pages (HDFC, ICICI, SBI, AU Small Finance Bank, American Express India, HSBC India), cross-verified against CardInsider, CardExpert, Magnify, PickMyWork, BankBazaar, and Paisabazaar, current as of July 2026.</li>
      </ul>
    </div>
  </section>

</main>

<footer>Personal reference tool â€” verified July 2026. Rates, caps, and offers change often; re-check with the issuing bank before relying on any figure for a large purchase.</footer>

<script>
/* =========================================================
   DATA
   ========================================================= */

const CARDS = {
  "amex-mrcc": {
    name: "AmEx MRCC", role: "Everyday Rewards", fee: "Lifetime Free", feeClass:"ltf",
    milestones: [
      "1,000 bonus MR points on 4 transactions of â‚¹1,500+ in a calendar month (needs one-time enrolment)",
      "1,000 bonus MR points on â‚¹20,000+ spend in the same month â€” stack both for up to 2,000 MR/month"
    ],
    benefits: [
      "Base: 1 MR point per â‚¹50 spent",
      "2X MR points via the Amex Reward Multiplier portal on eligible online purchases",
      "Wallet loads earn points too â€” unusual, most cards exclude this category entirely",
      "0% convenience fee on fuel at HPCL for transactions under â‚¹5,000 (fuel itself earns no points, but the waiver applies)"
    ],
    lounge: ["None."],
    forex: "3.5%",
    insurance: ["âš  Not prominently documented for this specific card â€” treat as none/minimal, low confidence."],
    exclusions: [
      "No points on fuel, insurance, or utilities",
      "Excluded categories still count toward monthly milestone and annual fee-waiver spend totals"
    ],
    redemption: [
      "18K / 24K Gold Collection: Amazon Pay, Flipkart, Myntra, Tanishq, Taj hotel vouchers",
      "Marriott Bonvoy â€” Amex is the exclusive Indian transfer partner, ~1 MR : 1 Marriott point",
      "Pay-with-points / statement credit: ~â‚¹0.25 per point â€” poor value, avoid",
      "Points never expire"
    ],
    other: ["Nothing notable beyond the standard structure."]
  },
  "regalia-gold": {
    name: "HDFC Regalia Gold", role: "Travel + Lifestyle", fee: "Lifetime Free", feeClass:"ltf",
    milestones: [
      "â‚¹1,500 Myntra / M&S / Reliance Digital / Marriott voucher every quarter on â‚¹1.5L quarterly spend",
      "â‚¹5,000 flight voucher at â‚¹5L annual spend, plus another â‚¹5,000 at â‚¹7.5L annual spend",
      "The two â‚¹5,000 flight vouchers cannot be combined into a single booking"
    ],
    benefits: [
      "Base: 5 RP per â‚¹200 (~1.625% effective), earned even on insurance, utilities, and education spend",
      "5X accelerated rewards (25 RP/â‚¹200) at Nykaa, Myntra, M&S, Reliance Digital â€” capped at 5,000 pts/month across all four brands combined",
      "SmartBuy portal: up to 10X on hotel bookings, 5X on flights, 5X on instant vouchers",
      "Complimentary Swiggy One + MMT Black Gold membership on â‚¹1L spend within 90 days",
      "Good Food Trail dining program â€” up to 10% off via Swiggy Dineout",
      "New Boarding Edge Program (from 15 May 2026): upload boarding pass on SmartBuy, choose any 2 benefits/quarter from spa session, 5-star buffet, room upgrade, or airport transfer (destination city only, 6-day window, add-on cardholders excluded)"
    ],
    lounge: [
      "Domestic: 3 visits/quarter â€” requires â‚¹60,000 spend in the preceding calendar quarter, effective the Julâ€“Sep 2026 quarter onward",
      "International: 6 visits/year via Priority Pass â€” unconditional, no spend requirement",
      "âš  No free guest visits on either domestic or international lounges â€” Priority Pass guests are charged US$27+GST per visit regardless of the cardholder's own quota, and domestic HDFC lounge vouchers are for the cardholder only."
    ],
    forex: "Base 2% (DCC 1.75% from 15 May 2026). With HDFC Global Value Program (GVP) enrolled: effective ~1% â€” GVP gives 1% cashback on all intl/forex spend, capped â‚¹1,000/cycle. Costs â‚¹199+GST/yr, auto-renews. Also unlocks a â‚¹2,000 travel voucher on â‚¹1.5L+ intl spend/year. Excludes gaming/betting merchants and ATM withdrawals; not retroactive. âš  Enroll via HDFC customer care 1800 1600 / 1800 2600 or customerservices.cards@hdfcbank.com â€” 3â€“5 business days to activate.",
    insurance: [
      "â‚¹1 crore air accident cover",
      "â‚¹15 lakh emergency overseas hospitalization",
      "â‚¹9 lakh credit/card liability cover",
      "Insurance premium spend counts toward both quarterly and annual milestones"
    ],
    exclusions: [
      "No points on rent, wallet loads, fuel, or EMI conversion",
      "Tax payments capped: only first 2 Income Tax + first 2 GST transactions per billing cycle earn points"
    ],
    redemption: [
      "SmartBuy: 1 RP = â‚¹0.50 on flights/hotels",
      "Gold Catalogue: Apple, Fitbit, Bose and other lifestyle products",
      "Air miles/hotel transfer at 2 RP : 1 partner point, including Accor ALL (2 RP â†’ 1 Accor pt â†’ â‚¹2, i.e. 1 RP â‰ˆ â‚¹1.00 via Accor â€” the best redemption route on this card)"
    ],
    other: ["â‚¹199 card reissuance fee (new)"]
  },
  "tata-neu": {
    name: "HDFC Tata Neu Infinity", role: "Tata Ecosystem", fee: "Lifetime Free", feeClass:"ltf",
    milestones: ["None beyond the standard tiered reward structure â€” no separate spend-tier milestone bonuses."],
    benefits: [
      "5% NeuCoins on Tata Neu app + partner Tata brand spends (non-EMI); additional 5% via NeuPass on select categories, up to 10% combined",
      "1.5% NeuCoins on all other retail spends and merchant EMI spends",
      "RuPay variant: 0.5% NeuCoins on any UPI spend + 1% extra via the Tata Neu UPI ID specifically = 1.5% combined, capped at 500 NeuCoins/month",
      "5% NeuCoins on utility bill payments, capped at 2,000 NeuCoins/month",
      "Grocery, telecom & cable, and insurance spends are each separately capped at 2,000 NeuCoins/month â€” independent pools, not a shared cap"
    ],
    lounge: [
      "Domestic: 8/year (2/quarter), requires â‚¹50,000 spend in the preceding calendar quarter",
      "International: 4/year (1/quarter) via Priority Pass â€” no spend condition",
      "âš  No free guest visits â€” Priority Pass guests charged US$27+GST per visit; domestic lounge vouchers are for the cardholder only."
    ],
    forex: "2%",
    insurance: [
      "â‚¹1 crore air accident cover",
      "â‚¹15 lakh emergency hospitalization",
      "Up to â‚¹9 lakh lost-card liability"
    ],
    exclusions: [
      "No NeuCoins on fuel, rent, government, wallet reloads, or post-transaction EMI conversion",
      "No NeuCoins on online skill-based gaming (MCC 5816, from Jul 2025)",
      "Education via third-party apps (CRED/Cheq/MobiKwik) excluded â€” direct school/college payment earns"
    ],
    redemption: [
      "1 NeuCoin = â‚¹1, redeemable on Tata Neu app + partner brands",
      "Not redeemable on Air India, Tata Play, or Bill Payment",
      "Expires 12 months from end of credit month"
    ],
    other: ["Nothing notable beyond the standard structure."]
  },
  "swiggy": {
    name: "HDFC Swiggy", role: "Food & Online", fee: "Lifetime Free", feeClass:"ltf",
    milestones: ["No spend-tier milestones â€” pure category cashback structure."],
    benefits: [
      "10% cashback on Swiggy app (Food Ordering, Instamart, Dineout, Genie), capped â‚¹1,500/billing cycle, minimum â‚¹249/transaction (effective 17 Apr 2026)",
      "5% cashback on select online categories (apparel, electronics, dept stores, local cabs, etc.), including 5% on Cleartrip flights/hotels, capped â‚¹1,500/cycle, min â‚¹100/transaction",
      "1% cashback on all other spends, capped â‚¹500/cycle, min â‚¹100/transaction",
      "Mastercard World golf: 4 complimentary green-fee rounds/year (1/month) + 12 free lessons/year (1/month); 50% off green fees beyond the complimentary quota"
    ],
    lounge: ["None."],
    forex: "~3.5% (not a travel-focused card)",
    insurance: ["None documented."],
    exclusions: ["Fuel, rent, EMI, jewellery, government, Swiggy Money wallet, Swiggy Minis, Swiggy Liquor"],
    redemption: ["Cashback auto-credited as statement credit, settled the following month"],
    other: ["1% fuel surcharge waiver, â‚¹400â€“5,000 range"]
  },
  "onecard": {
    name: "OneCard", role: "Forex + Everyday", fee: "Lifetime Free", feeClass:"ltf",
    milestones: ["None â€” the card is already structurally free, with no tier-upgrade mechanics."],
    benefits: [
      "Base: 1 Reward Point per â‚¹50 (â‰ˆ0.2% effective at â‚¹0.10/RP)",
      "5X on your top 2 spend categories of the month â€” needs spend across â‰¥3 categories with a minimum â‚¹750 in each; concentrating spend in only 1â€“2 categories disqualifies the bonus entirely for that month",
      "Education/bills/insurance capped at 25,000 RP/month when eligible for the 5X bonus",
      "BBPS in-app utility bill payments now carry zero convenience fee, effective April 2026",
      "100% fuel surcharge waiver up to â‚¹400/month"
    ],
    lounge: ["None."],
    forex: "1% â€” the lowest in your entire stack (â‰ˆ1.18% effective with GST)",
    insurance: ["None â€” confirmed explicitly across multiple 2026 sources: no purchase protection, no air accident cover, no travel medical, no baggage cover."],
    exclusions: ["No rewards on rent or wallet loads (a staggered 1â€“2% surcharge on these is rolling out across partner-bank issuers through 2026)"],
    redemption: [
      "1 Reward Point = â‚¹0.10 (not â‚¹1, despite what some aggregator sites claim)",
      "No transfer partners â€” closed-loop currency, cannot move to any airline or hotel program",
      "Redeem via \"swipe right\" against a specific transaction in-app, within a 2-month window"
    ],
    other: ["Nothing notable beyond the standard structure."]
  },
  "amazon-pay": {
    name: "ICICI Amazon Pay", role: "Amazon Ecosystem", fee: "Lifetime Free", feeClass:"ltf",
    milestones: ["None â€” flat cashback structure with no spend-based tiers."],
    benefits: [
      "5% cashback on Amazon.in for Prime members, 3% for non-Prime",
      "2% cashback at 100+ Amazon Pay partner merchants (via \"Login with Amazon\")",
      "1% cashback on all other spends, uncapped, no expiry",
      "iShop: up to 12X points / instant discounts on flights and hotels"
    ],
    lounge: ["None."],
    forex: "1.99%",
    insurance: ["None."],
    exclusions: [
      "No cashback on fuel, rent, taxes, education, EMI (including post-facto EMI conversion), Amazon Business orders, physical/digital gold on Amazon, or utilities/international spend done outside Amazon.in",
      "A mixed cart containing any excluded-category item forfeits cashback on the entire order",
      "âš  New fees effective 15 January 2026: 1% fee on wallet loads â‰¥â‚¹5,000; 2% fee on skill-based gaming; 1% fee on utility payments exceeding â‚¹50,000/month"
    ],
    redemption: [
      "Cashback auto-credited to Amazon Pay balance, uncapped, no expiry",
      "Cannot convert to statement credit or cash"
    ],
    other: ["1% fuel surcharge waiver, â‚¹400â€“â‚¹4,000 range, max â‚¹400/cycle"]
  },
  "au-xcite": {
    name: "AU Xcite Ultra", role: "Offline/Online/Intl Rewards", fee: "Lifetime Free", feeClass:"ltf",
    milestones: [
      "500 bonus RP on â‚¹5,000+ spend between the 1stâ€“5th of each month (excl. rent/wallet/fuel)",
      "5,000 bonus RP on â‚¹2.5L retail spend in the card anniversary year"
    ],
    benefits: [
      "4 RP per â‚¹100 offline, 8 RP per â‚¹100 online, 12 RP per â‚¹100 international",
      "Utility/Telecom & Insurance spend earns a reduced 1 RP/â‚¹100 (not zero)",
      "Complimentary device protection plan + 1-year extended warranty on mobiles/tablets/laptops/white goods",
      "Concierge services for travel, entertainment, leisure bookings, and golf"
    ],
    lounge: [
      "Domestic: 2/quarter â€” requires â‚¹50,000 spend in the preceding quarter (raised from â‚¹20,000, effective 10 Apr 2026)",
      "Railway: 8/year (2/quarter) via Dreamfolks",
      "International: none.",
      "âš  No free guest visits documented for domestic or railway lounges."
    ],
    forex: "3.49% + GST (â‰ˆ4.12% effective)",
    insurance: [
      "Air accident cover: â‚¹20 lakh per the official AU Bank page (several review sites incorrectly repeat â‚¹50 lakh â€” official page is authoritative)",
      "â‚¹25,000 purchase protection",
      "â‚¹2 lakh credit shield",
      "Travel covers: baggage loss/delay, flight delay, passport loss, hijack"
    ],
    exclusions: ["No RP on rent, wallet, or fuel"],
    redemption: ["1 RP = â‚¹0.25 via AU Rewardz", "â‚¹99 + GST fee per redemption"],
    other: [
      "BRR/MRR not modeled â€” this card was added to the stack after the original category-rate model was built",
      "1% fuel surcharge waiver, â‚¹400â€“5,000, monthly cap â‚¹200â€“250 (sources vary)"
    ]
  },
  "amex-platinum": {
    name: "AmEx Platinum Travel", role: "Travel Rewards", fee: "â‚¹5,000 + GST (~â‚¹5,900)", feeClass:"fee",
    milestones: [
      "â‚¹1.9L annual spend â†’ 7,500 bonus MR points",
      "â‚¹4L annual spend â†’ 10,000 bonus MR points",
      "â‚¹7L annual spend â†’ 22,500 bonus MR points + â‚¹10,000 Taj Experiences e-Gift Card (restructured 9 Mar 2026)",
      "Only the first tranche of points auto-credits at each tier; the remainder needs a call/chat to Amex to claim manually",
      "âš  No formal spend-based fee waiver exists. Discretionary retention offers are sometimes available by calling Amex close to renewal â€” more commonly reported around â‚¹7L+ annual spend, never guaranteed."
    ],
    benefits: [
      "Base: 1 MR point per â‚¹50 spent",
      "Up to 20% dining discounts at partner restaurants",
      "0% convenience fee on fuel at HPCL under â‚¹5,000"
    ],
    lounge: [
      "8 domestic visits/year, max 2/quarter, primary cardholder only",
      "No complimentary international lounge access â€” Priority Pass membership fee (US$99) is waived, but each visit still costs a US$27â€“35 usage fee",
      "âš  No free guest visits â€” Priority Pass guests are charged in addition to the per-visit usage fee, regardless of the cardholder's own quota."
    ],
    forex: "3.5%",
    insurance: ["âš  Not prominently documented for this specific card (distinct from the Platinum Charge card) â€” treat as minimal/undocumented, low confidence."],
    exclusions: ["No points on fuel, insurance, utilities, cash, or POS EMI conversion â€” but these still count toward milestone spend"],
    redemption: [
      "MR points transfer to Marriott Bonvoy, Hilton Honors, KrisFlyer, British Airways, Emirates, Qatar, Finnair, Asia Miles, Virgin, and others, mostly ~1:1",
      "Cannot pool MR points with Gold/Platinum Charge collections"
    ],
    other: ["MR points never expire", "âš  Currently paused for new applications in India (2026)."]
  },
  "sbi-simplysave": {
    name: "SBI SimplySave", role: "Dining / Groceries", fee: "â‚¹499 + GST", feeClass:"fee",
    milestones: ["âš  Fee waiver: reverses from year 2 onward on â‚¹1L annual spend in the preceding year."],
    benefits: [
      "10X accelerated Reward Points (10 RP per â‚¹150, â‰ˆ1.67% effective at â‚¹0.25/RP) on dining, movies, groceries, and departmental stores â€” this accelerated tier is the core value of the card",
      "1 RP per â‚¹150 (â‰ˆ0.17% effective) on all other spends"
    ],
    lounge: ["None â€” confirmed, no domestic or international lounge access on this card."],
    forex: "3.5%",
    insurance: ["None documented."],
    exclusions: ["No points on fuel, rent, wallet loads, government payments, or cash advances"],
    redemption: ["1 RP = â‚¹0.25, against outstanding balance or gift catalogue", "Valid 24 months", "â‚¹99 redemption fee applies"],
    other: ["1% fuel surcharge waiver, â‚¹500â€“3,000 range, max â‚¹100/cycle", "RuPay/UPI variant available", "Flexipay EMI on spends over â‚¹2,500"]
  },
  "axis-atlas": {
    name: "Axis Atlas", role: "Travel (Premium)", fee: "â‚¹5,000 + GST", feeClass:"fee",
    milestones: [
      "2,500 EDGE Miles at â‚¹3L annual spend",
      "+2,500 at â‚¹7.5L",
      "+5,000 at â‚¹15L",
      "âš  No formal fee-waiver mechanism exists â€” the â‚¹5,000+GST fee applies every renewal year regardless of spend."
    ],
    benefits: [
      "5 EDGE Miles per â‚¹100 on travel (direct airline/hotel bookings, or the Travel EDGE portal), capped at â‚¹2L cumulative travel spend/month; accelerated travel miles further capped at 10,000/statement cycle per some sources",
      "2 EDGE Miles per â‚¹100 on everything else, and on travel spend beyond the â‚¹2L/month cap",
      "25% off up to â‚¹800 via EazyDiner (min â‚¹2,000, twice/month)",
      "1% fuel surcharge waiver"
    ],
    lounge: [
      "Silver (base): 8 domestic + 4 international lounge visits/year",
      "Gold (â‚¹7.5L annual spend): 12 domestic + 6 international, plus 2,500 bonus EDGE Miles",
      "Platinum (â‚¹15L annual spend): 18 domestic + 12 international, plus 5,000 bonus EDGE Miles",
      "Tier spend excludes gold/jewellery, rent, wallet, government, insurance, fuel, utilities/telecom",
      "âš  Guest access: the tier quota (e.g. 4 intl visits at Silver) covers the primary cardholder AND guests TOGETHER from the same shared pool â€” no separate free-guest allowance on top of it. Better than HDFC/Amex in one sense (guests never billed extra) but worse in another (guests eat into your own quota)."
    ],
    forex: "3.5% + GST (â‰ˆ4.13% effective)",
    insurance: ["âš  Sources conflict â€” CardInsider states no insurance; BankBazaar cites air accident + baggage cover. Unresolved; likely minimal or discontinued."],
    exclusions: ["No EDGE Miles on gold/jewellery, rent, wallet, government, insurance, fuel, or utilities/telecom"],
    redemption: [
      "REMOVED (2 Apr 2026, zero notice): Accor Live Limitless, Marriott Bonvoy, Qatar Airways Privilege Club",
      "ADDED at a devalued 2 EDGE Miles : 1 partner mile ratio: British Airways Avios, Vietnam Airlines LotusMiles, Finnair Plus",
      "UNCHANGED at 1 EDGE Mile : 2 partner miles (Group A): Singapore KrisFlyer, Aeroplan (Air Canada), JAL Mileage Bank",
      "Group B (intact): Flying Blue, Air India Maharaja Club, ITC Hotels, IHG One Rewards, Wyndham",
      "âš  For Accor specifically, no workaround remains on Axis â€” HSBC TravelOne is now the best Accor route in India (1:1, instant transfer).",
      "Transfer caps: Group A 30,000 EDGE Miles/year; Group B 1,20,000/year; combined annual cap resets 1 January; â‚¹199+GST transfer fee per transfer"
    ],
    other: ["âš  Not accepting new applications as of 2026 â€” existing cardholders retain full benefits."]
  },
  "hsbc-travelone": {
    name: "HSBC TravelOne", role: "Travel + Hopper", fee: "â‚¹4,999 + GST (~â‚¹5,899)", feeClass:"fee",
    milestones: [
      "3,000 bonus RP on â‚¹1L spend within first 90 days",
      "10,000 bonus RP on â‚¹12L annual spend (no category exclusions apply to this specific milestone calc)",
      "âš  Fee waiver: â‚¹8L annual spend."
    ],
    benefits: [
      "Base: 2 RP per â‚¹100 on everything else, no cap",
      "Track A â€” direct accelerated spend on flights, travel aggregators, and forex: 4 RP per â‚¹100, capped at 50,000 RP/month",
      "Track B â€” HSBC \"Travel with Points\" portal bookings only (Hopper): Hotels 6X = 24 RP/â‚¹100 â†’ 24 Accor pts (1:1); Flights 4X = 16 RP/â‚¹100 â†’ 16 Accor pts (1:1); Car Rentals 2X = 4 RP/â‚¹100 â†’ 4 Accor pts. All three share a separate 18,000 RP/month cap, portal-specific only",
      "Forex sits in Track A (50,000 RP/mo cap), not Track B",
      "Up to 20% off duty-free at Adani airports, via the AdaniOne app/website",
      "BOGO movie tickets (up to â‚¹200 off, 2Ã—/month) via District by Zomato, promo HSBCTOMOV",
      "Aggregator & partner discount codes â€” see Offers & Codes tab"
    ],
    lounge: [
      "6 domestic + 4 international (LoungeKey) visits/year, no spend condition",
      "New: 4 complimentary domestic chauffeur airport transfers/year (1/quarter), via Ecos Mobility, valid through Dec 2026",
      "âš  No free guest visits â€” HSBC TravelOne's lounge program does not include guest access at all, complimentary or paid."
    ],
    forex: "3.5% (DCC also 3.5%); foreign-currency spend earns the accelerated 4 RP/â‚¹100 under Track A",
    insurance: ["Purchase protection up to USD 20,000/year (Tata AIG / Mastercard)"],
    exclusions: ["No points on fuel, rent, utilities, insurance, education, government/tax, gold/jewellery, e-wallet loads, money transfers, cash advances â€” most still count toward the â‚¹8L fee-waiver threshold"],
    redemption: [
      "~20 partners, mostly 1:1 â€” Air India, KrisFlyer, British Airways, Qatar, Etihad, Air France-KLM, JAL, Thai, Turkish, United, Qantas, Vietnam Airlines, EVA Air, Hainan (AirAsia is the exception at 1:3)",
      "Hotels: Accor ALL retained at 1:1 (now the best Accor route in India post-Atlas devaluation), IHG, Marriott Bonvoy, Wyndham, Shangri-La (5:1)"
    ],
    other: ["Nothing notable beyond the standard structure."]
  }
};

const CARD_ORDER = ["amex-mrcc","regalia-gold","tata-neu","swiggy","onecard","amazon-pay","au-xcite","amex-platinum","sbi-simplysave","axis-atlas","hsbc-travelone"];

const CATEGORIES = [
  {key:"groceries", label:"Groceries", emoji:"ðŸ›’"},
  {key:"food-delivery", label:"Food Delivery", emoji:"ðŸ±"},
  {key:"dining", label:"Dining", emoji:"ðŸ½ï¸"},
  {key:"online-shopping", label:"Online Shopping", emoji:"ðŸ›ï¸"},
  {key:"lifestyle", label:"Lifestyle Brands", emoji:"ðŸ‘—"},
  {key:"utilities", label:"Utilities / Bills", emoji:"âš¡"},
  {key:"fuel", label:"Fuel", emoji:"â›½"},
  {key:"upi", label:"UPI Payments", emoji:"ðŸ“²"},
  {key:"flights", label:"Flights", emoji:"âœˆï¸"},
  {key:"hotels", label:"Hotels", emoji:"ðŸ¨"},
  {key:"forex", label:"International / Forex", emoji:"ðŸ’±"},
  {key:"insurance", label:"Insurance", emoji:"ðŸ›¡ï¸"},
  {key:"rent", label:"Rent", emoji:"ðŸ "},
  {key:"movies", label:"Movies / Entertainment", emoji:"ðŸŽ¬"},
  {key:"tata", label:"Tata Outlets", emoji:"ðŸ”µ"}
];

// row: [cardKey, variant, brrStr, mrrStr, cap, note]
const CATEGORY_DATA = {
  groceries: [
    ["tata-neu","via Tata Neu app","10.00%","10.00%","2,000 NeuCoins/mo (grocery-specific cap)","5% card + 5% NeuPass stacked"],
    ["swiggy","via Instamart","10.00%","10.00%","â‚¹1,500/mo; min â‚¹249/txn (from 17-Apr-2026)","10% CB"],
    ["axis-atlas","â€”","4.30%","7.60%","â€”","2 Edge Miles/â‚¹100 general retail. For Asia/Qatar-adjacent trips, JAL Mileage Bank may do better (~13.2% MRR) â€” single worked example, verify availability. [medium confidence]"],
    ["amazon-pay","via Amazon.in","5.00%","5.00%","â€”","5% CB"],
    ["hsbc-travelone","â€”","0.50%","4.00%","â€”","2 RP/â‚¹100; MRR via Accor (1:1)"],
    ["regalia-gold","â€”","1.25%","2.50%","â€”","2.5 RP/â‚¹100 base (post 15-May-2026 cut); MRR via Accor (2RPâ†’1 Accor ptâ†’â‚¹2)"],
    ["sbi-simplysave","â€”","1.67%","1.67%","â€”","6.67 RP/â‚¹100 on groceries"],
    ["amex-platinum","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["amex-mrcc","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["onecard","â€”","0.20%","0.20%","â€”","2 RP/â‚¹100 Ã— â‚¹0.10 â€” no transfer"]
  ],
  "food-delivery": [
    ["swiggy","Food orders + Genie","10.00%","10.00%","â‚¹1,500/mo; min â‚¹249/txn","10% CB"],
    ["axis-atlas","â€”","4.30%","7.60%","â€”","2 Edge Miles/â‚¹100. For Asia/Qatar-adjacent trips, JAL Mileage Bank may do better (~13.2% MRR) â€” single worked example, verify availability. [medium confidence]"],
    ["hsbc-travelone","â€”","0.50%","4.00%","â€”","2 RP/â‚¹100; MRR via Accor (1:1)"],
    ["regalia-gold","â€”","1.25%","2.50%","â€”","2.5 RP/â‚¹100 base (post 15-May-2026 cut); MRR via Accor (2RPâ†’1 Accor ptâ†’â‚¹2)"],
    ["amazon-pay","via Amazon Pay partners","2.00%","2.00%","â€”","2% CB (Swiggy/Zomato as Amazon Pay partner)"],
    ["tata-neu","â€”","1.50%","1.50%","â€”","1.5% CB â€” direct, no transfer"],
    ["amex-platinum","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["amex-mrcc","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["onecard","â€”","0.20%","0.20%","â€”","2 RP/â‚¹100 Ã— â‚¹0.10 â€” no transfer"],
    ["sbi-simplysave","â€”","0.17%","0.17%","â€”","0.67 RP/â‚¹100"]
  ],
  dining: [
    ["swiggy","via Dineout","10.00%","10.00%","â‚¹1,500/mo; min â‚¹249/txn","10% CB â€” Dineout is part of the main Swiggy 10% bucket"],
    ["axis-atlas","â€”","4.30%","7.60%","â€”","2 Edge Miles/â‚¹100. For Asia/Qatar-adjacent trips, JAL Mileage Bank may do better (~13.2% MRR) â€” single worked example, verify availability. [medium confidence]"],
    ["hsbc-travelone","â€”","0.50%","4.00%","â€”","2 RP/â‚¹100; MRR via Accor (1:1)"],
    ["regalia-gold","â€”","1.25%","2.50%","â€”","2.5 RP/â‚¹100 base (post 15-May-2026 cut); MRR via Accor (2RPâ†’1 Accor ptâ†’â‚¹2)"],
    ["sbi-simplysave","â€”","1.67%","1.67%","â€”","6.67 RP/â‚¹100 â€” dining"],
    ["tata-neu","â€”","1.50%","1.50%","â€”","1.5% CB â€” direct, no transfer"],
    ["amazon-pay","â€”","1.00%","1.00%","â€”","1% CB on other spends"],
    ["amex-platinum","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["amex-mrcc","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["onecard","â€”","0.20%","0.20%","â€”","2 RP/â‚¹100 Ã— â‚¹0.10 â€” no transfer"]
  ],
  "online-shopping": [
    ["axis-atlas","â€”","4.30%","7.60%","â€”","2 Edge Miles/â‚¹100. For Asia/Qatar-adjacent trips, JAL Mileage Bank may do better (~13.2% MRR) â€” single worked example, verify availability. [medium confidence]"],
    ["swiggy","â€”","5.00%","5.00%","â‚¹1,500/mo; min â‚¹100/txn","Amazon, Flipkart, Myntra, Nykaa, Ajio, Cleartrip, BookMyShow, Uber, PharmEasy, Croma, Vijay Sales, Reliance Digital, Netflix, SonyLiv, Paytm Travel, Ixigo, Yatra, EaseMyTrip, Goibibo, Ola, Zoom"],
    ["hsbc-travelone","â€”","0.50%","4.00%","â€”","2 RP/â‚¹100; MRR via Accor (1:1)"],
    ["regalia-gold","â€”","1.25%","2.50%","â€”","2.5 RP/â‚¹100 base (post 15-May-2026 cut); MRR via Accor (2RPâ†’1 Accor ptâ†’â‚¹2)"],
    ["tata-neu","â€”","1.50%","1.50%","â€”","1.5% CB â€” direct, no transfer"],
    ["amazon-pay","â€”","1.00%","1.00%","â€”","1% CB on other spends"],
    ["amex-platinum","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["amex-mrcc","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["onecard","â€”","0.20%","0.20%","â€”","2 RP/â‚¹100 Ã— â‚¹0.10 â€” no transfer"],
    ["sbi-simplysave","â€”","0.17%","0.17%","â€”","0.67 RP/â‚¹100"]
  ],
  lifestyle: [
    ["regalia-gold","â€”","6.67%","13.33%","5,000 pts/mo across all 4 brands","Myntra, M&S, Reliance Digital, Nykaa (5X) â€” unaffected by May-2026 base-rate cut"],
    ["axis-atlas","â€”","4.30%","7.60%","â€”","2 Edge Miles/â‚¹100. For Asia/Qatar-adjacent trips, JAL Mileage Bank may do better (~13.2% MRR) â€” single worked example, verify availability. [medium confidence]"],
    ["swiggy","â€”","5.00%","5.00%","â‚¹1,500/mo","Same 5% bucket as Online Shopping (Myntra, Nykaa overlap)"],
    ["hsbc-travelone","â€”","0.50%","4.00%","â€”","2 RP/â‚¹100; MRR via Accor (1:1)"],
    ["tata-neu","â€”","1.50%","1.50%","â€”","1.5% CB â€” direct, no transfer"],
    ["amazon-pay","â€”","1.00%","1.00%","â€”","1% CB on other spends"],
    ["amex-platinum","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["amex-mrcc","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["onecard","â€”","0.20%","0.20%","â€”","2 RP/â‚¹100 Ã— â‚¹0.10 â€” no transfer"],
    ["sbi-simplysave","â€”","0.17%","0.17%","â€”","0.67 RP/â‚¹100"]
  ],
  utilities: [
    ["tata-neu","â€”","5.00%","5.00%","2,000 NeuCoins/mo","5% NeuCoins on utility bill payments"],
    ["regalia-gold","â€”","1.25%","2.50%","â€”","2.5 RP/â‚¹100 base (post 15-May-2026 cut); MRR via Accor (2RPâ†’1 Accor ptâ†’â‚¹2) â€” utilities not excluded"],
    ["amazon-pay","via Amazon Pay partner","2.00%","2.00%","â€”","2% CB"],
    ["swiggy","â€”","1.00%","1.00%","â‚¹500/month cap","1% CB on other spends"],
    ["onecard","â€”","0.20%","0.20%","â€”","2 RP/â‚¹100 Ã— â‚¹0.10 â€” no transfer"],
    ["sbi-simplysave","â€”","0.17%","0.17%","â€”","0.67 RP/â‚¹100"],
    ["amex-platinum","â€”","Excluded","Excluded","â€”","Excluded â€” no points, but counts toward milestone"],
    ["amex-mrcc","â€”","Excluded","Excluded","â€”","Excluded â€” no points, but counts toward milestone"],
    ["axis-atlas","â€”","Excluded","Excluded","â€”","Excluded â€” Utilities & Telecom (1% fee applies above â‚¹25,000/mo)"],
    ["hsbc-travelone","â€”","Excluded","Excluded","â€”","Excluded â€” no reward points on utilities"]
  ],
  fuel: [
    ["amex-platinum","â€”","0.00%","0.00%","â€”","0% conv. fee at HPCL <â‚¹5,000/txn (1% â‰¥â‚¹5,000) â€” no points, but counts toward the â‚¹1.9L/â‚¹4L/â‚¹7L annual milestone"],
    ["amex-mrcc","â€”","0.00%","0.00%","â€”","0% conv. fee at HPCL up to â‚¹25,000/txn. Boost trick: exactly 4 transactions of â‚¹1,500 (â‚¹6,000 total) in a month triggers the milestone â†’ effective 4.17% BRR / 8.33% MRR on that spend pattern only."],
    ["sbi-simplysave","â€”","0.00%","0.00%","â€”","1% surcharge waived (â‚¹500â€“â‚¹3,000 txns), cap â‚¹100/mo â€” no RP earned"],
    ["tata-neu","â€”","0.00%","0.00%","â€”","1% surcharge waived (â‚¹400â€“â‚¹5,000 txns), cap â‚¹500/cycle â€” no NeuCoins (explicitly excluded)"],
    ["hsbc-travelone","â€”","0.00%","0.00%","â€”","1% surcharge waived up to â‚¹250 (â‚¹400â€“â‚¹5,000 txns) â€” no RP earned"],
    ["regalia-gold","â€”","âˆ’1.00%","âˆ’1.00%","â€”","No waiver found â€” standard ~1% surcharge likely applies, no points [medium confidence]"],
    ["amazon-pay","â€”","âˆ’1.00%","âˆ’1.00%","â€”","No waiver found â€” standard ~1% surcharge likely applies, no CB [medium confidence]"],
    ["swiggy","â€”","âˆ’1.00%","âˆ’1.00%","â€”","Explicitly excluded from rewards; no waiver found â€” standard ~1% surcharge likely applies [medium confidence]"],
    ["onecard","â€”","âˆ’1.00%","âˆ’1.00%","â€”","Confirmed: 1% surcharge applies, no waiver, no RP â€” genuine net loss"],
    ["axis-atlas","â€”","Excluded","Excluded","â€”","Unconfirmed â€” terms reference a fuel surcharge waiver (implying one exists) but exact %/cap not verifiable. Treat as ~0% pending confirmation, not negative. [low confidence]"]
  ],
  upi: [
    ["tata-neu","â€”","1.50%","1.50%","500 NeuCoins/mo combined â€” does NOT apply to fuel","0.5% on any UPI (RuPay variant) + 1% extra via Tata Neu UPI ID = 1.5% combined"],
    ["amex-platinum","â€”","Excluded","Excluded","â€”","AmEx network â€” not RuPay/UPI-linked"],
    ["amex-mrcc","â€”","Excluded","Excluded","â€”","AmEx network â€” not RuPay/UPI-linked"],
    ["regalia-gold","â€”","Excluded","Excluded","â€”","Visa/Mastercard â€” verify if your specific card is RuPay-linked"],
    ["swiggy","â€”","Excluded","Excluded","â€”","Verify if your specific card is RuPay-linked"],
    ["onecard","â€”","Excluded","Excluded","â€”","Verify if your specific card is RuPay-linked"],
    ["sbi-simplysave","â€”","Excluded","Excluded","â€”","Verify if your specific card is RuPay-linked"],
    ["axis-atlas","â€”","Excluded","Excluded","â€”","Visa/Mastercard â€” not RuPay-linked"],
    ["hsbc-travelone","â€”","Excluded","Excluded","â€”","Mastercard World â€” not RuPay-linked"],
    ["amazon-pay","â€”","Excluded","Excluded","â€”","Verify if your specific card is RuPay-linked"]
  ],
  flights: [
    ["hsbc-travelone","Hopper portal","4.00%","32.00%","18,000 RP/mo Hopper-specific (~â‚¹1.12L/mo)","4X base = 16 RP/â‚¹100, transfer to Accor"],
    ["hsbc-travelone","Aggregator + cash discount","15.85%","21.80%","50,000 RP/mo shared accelerated cap","~15% instant discount (Yatra/EMT/Goibibo/Cleartrip/MMT/Paytm) + 4RP/â‚¹100 on the discounted amount â†’ Accor. Emirates is 10%, capped per-partner (typically â‚¹3,000â€“5,000)"],
    ["axis-atlas","Direct / Edge Portal","10.75%","19.00%","â‚¹2L/month earn cap","5 Edge Miles/â‚¹100 â€” direct airline booking or Axis Edge portal (NOT aggregators). For Asia/Qatar-adjacent trips, JAL Mileage Bank may do better (~33.1% MRR) â€” single worked example, verify availability. [medium confidence]"],
    ["regalia-gold","SmartBuy (5X)","6.25%","12.50%","2,000 pts/day, 4,000 pts/month SmartBuy cap","12.5 RP/â‚¹100 (5X of 2.5 base), transfer to Accor"],
    ["swiggy","via Cleartrip","10.70%","10.70%","â‚¹1,500/billing cycle","Flat 6% instant discount + 5% cashback on the discounted amount"],
    ["axis-atlas","Aggregator (no 5X)","4.30%","7.60%","â€”","Aggregator bookings do NOT qualify for Atlas 5X â€” base 2 Edge Miles/â‚¹100 only. [medium confidence]"],
    ["tata-neu","â€”","1.50%","1.50%","â€”","1.5% CB â€” direct, no transfer"],
    ["amex-platinum","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["amex-mrcc","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["amazon-pay","â€”","1.00%","1.00%","â€”","1% CB on other spends"],
    ["onecard","â€”","0.20%","0.20%","â€”","2 RP/â‚¹100 Ã— â‚¹0.10 â€” no transfer"],
    ["sbi-simplysave","â€”","0.17%","0.17%","â€”","0.67 RP/â‚¹100"]
  ],
  hotels: [
    ["hsbc-travelone","Hopper portal","6.00%","48.00%","18,000 RP/mo Hopper-specific (~â‚¹1.12L/mo)","6X base = 24 RP/â‚¹100, transfer to Accor â€” PEAK RETURN IN ENTIRE STACK"],
    ["regalia-gold","SmartBuy (10X)","12.50%","25.00%","2,000 pts/day, 4,000 pts/month SmartBuy cap","25 RP/â‚¹100 (10X of 2.5 base), transfer to Accor"],
    ["swiggy","via Cleartrip","23.05%","23.05%","â‚¹1,500/billing cycle","Flat 19% instant discount + 5% cashback on the discounted amount"],
    ["hsbc-travelone","Aggregator/OTA + cash discount","15.85%","21.80%","50,000 RP/mo shared accelerated cap","~15% instant discount (most OTAs) + 4RP/â‚¹100 on the discounted amount â†’ Accor. StayVista specifically is 11% discount, hotel-only, max 2 bookings/yr"],
    ["axis-atlas","Direct / Edge Portal","10.75%","19.00%","â‚¹2L/month earn cap","5 Edge Miles/â‚¹100 â€” direct hotel booking or Axis Edge portal. [medium confidence]"],
    ["axis-atlas","OTA (no 5X)","4.30%","7.60%","â€”","OTA bookings do NOT qualify for Atlas 5X â€” base 2 Edge Miles/â‚¹100 only. [medium confidence]"],
    ["tata-neu","â€”","1.50%","1.50%","â€”","1.5% CB â€” direct, no transfer"],
    ["amex-platinum","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["amex-mrcc","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["amazon-pay","â€”","1.00%","1.00%","â€”","1% CB on other spends"],
    ["onecard","â€”","0.20%","0.20%","â€”","2 RP/â‚¹100 Ã— â‚¹0.10 â€” no transfer"],
    ["sbi-simplysave","â€”","0.17%","0.17%","â€”","0.67 RP/â‚¹100"]
  ],
  forex: [
    ["hsbc-travelone","â€”","âˆ’2.50%","4.50%","50,000 RP/mo accelerated cap shared with general","4 RP/â‚¹100 forex (8% MRR via Accor) net of 3.5% markup. Promo forex-cashback (SMS HSBCFX) assumed NOT active â€” verify if running."],
    ["axis-atlas","KrisFlyer/Aeroplan avg","0.80%","4.10%","â€”","2 Edge Miles/â‚¹100 (avg KrisFlyer/Aeroplan) net of 3.5% forex markup. [medium confidence]"],
    ["regalia-gold","â€”","0.25%","1.50%","â€”","2.5 RP/â‚¹100 (MRR via Accor) net of 1% effective markup â€” GVP active"],
    ["tata-neu","â€”","âˆ’0.50%","âˆ’0.50%","â€”","1.5% CB net of 2% markup â€” GVP also available on this HDFC card if activated"],
    ["onecard","â€”","âˆ’0.80%","âˆ’0.80%","â€”","0.2% reward net of 1% markup â€” lowest gross markup in stack but still a net cost"],
    ["amazon-pay","â€”","âˆ’0.99%","âˆ’0.99%","â€”","1% CB net of ~1.99% markup"],
    ["swiggy","â€”","âˆ’2.50%","âˆ’2.50%","â€”","1% CB net of 3.5% markup"],
    ["amex-mrcc","â€”","âˆ’3.00%","âˆ’2.50%","â€”","Net of 3.5% markup"],
    ["amex-platinum","â€”","âˆ’3.00%","âˆ’2.50%","â€”","Net of 3.5% markup"],
    ["sbi-simplysave","â€”","âˆ’3.33%","âˆ’3.33%","â€”","0.67 RP/â‚¹100 net of 3.5% markup â€” worst in stack"]
  ],
  insurance: [
    ["tata-neu","â€”","5.00%","5.00%","2,000 NeuCoins/month","5% NeuCoins â€” note HDFC T&Cs are internally inconsistent here; verify from actual postings"],
    ["regalia-gold","â€”","1.25%","2.50%","â€”","2.5 RP/â‚¹100 base (post 15-May-2026 cut); MRR via Accor â€” insurance not excluded"],
    ["amazon-pay","â€”","1.00%","1.00%","â€”","1% CB on other spends"],
    ["swiggy","â€”","1.00%","1.00%","â‚¹500/month cap","1% CB on other spends"],
    ["onecard","â€”","0.20%","0.20%","â€”","2 RP/â‚¹100 Ã— â‚¹0.10 â€” no transfer"],
    ["sbi-simplysave","â€”","0.17%","0.17%","â€”","0.67 RP/â‚¹100"],
    ["amex-platinum","â€”","Excluded","Excluded","â€”","Excluded â€” no points, but counts toward milestone"],
    ["amex-mrcc","â€”","Excluded","Excluded","â€”","Excluded â€” no points, but counts toward milestone"],
    ["axis-atlas","â€”","Excluded","Excluded","â€”","Excluded"],
    ["hsbc-travelone","â€”","Excluded","Excluded","â€”","Confirmed excluded â€” no reward points on insurance"]
  ],
  rent: [
    ["amex-platinum","â€”","Excluded","Excluded","â€”","Excluded"],
    ["amex-mrcc","â€”","Excluded","Excluded","â€”","Excluded"],
    ["regalia-gold","â€”","Excluded","Excluded","â€”","Excluded"],
    ["tata-neu","â€”","Excluded","Excluded","â€”","Excluded"],
    ["swiggy","â€”","Excluded","Excluded","â€”","Excluded"],
    ["onecard","â€”","Excluded","Excluded","â€”","Excluded (quasi-cash)"],
    ["sbi-simplysave","â€”","Excluded","Excluded","â€”","Excluded"],
    ["axis-atlas","â€”","Excluded","Excluded","â€”","Excluded"],
    ["hsbc-travelone","â€”","Excluded","Excluded","â€”","Excluded"],
    ["amazon-pay","â€”","Excluded","Excluded","â€”","Excluded"]
  ],
  movies: [
    ["axis-atlas","â€”","4.30%","7.60%","â€”","2 Edge Miles/â‚¹100. [medium confidence]"],
    ["swiggy","â€”","5.00%","5.00%","â‚¹1,500/mo","BookMyShow via the Online Shopping 5% bucket"],
    ["hsbc-travelone","â€”","0.50%","4.00%","â€”","2 RP/â‚¹100 base. Plus: BOGO movie ticket up to â‚¹200 off, 2x/month, via District app, promo HSBCTOMOV"],
    ["regalia-gold","â€”","1.25%","2.50%","â€”","2.5 RP/â‚¹100 base (post 15-May-2026 cut); MRR via Accor"],
    ["amazon-pay","via Amazon Pay partner","2.00%","2.00%","â€”","2% CB (BookMyShow)"],
    ["sbi-simplysave","â€”","1.67%","1.67%","â€”","6.67 RP/â‚¹100 â€” movies"],
    ["tata-neu","â€”","1.50%","1.50%","â€”","1.5% CB â€” direct, no transfer"],
    ["amex-platinum","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["amex-mrcc","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["onecard","â€”","0.20%","0.20%","â€”","2 RP/â‚¹100 Ã— â‚¹0.10 â€” no transfer"]
  ],
  tata: [
    ["tata-neu","via Tata Neu app + NeuPass","10.00%","10.00%","No explicit cap found for this bucket specifically â€” verify","5% card + 5% NeuPass stacked"],
    ["axis-atlas","â€”","4.30%","7.60%","â€”","2 Edge Miles/â‚¹100. [medium confidence]"],
    ["tata-neu","Offline at Tata stores","5.00%","5.00%","â€”","5% card rate only â€” NeuPass boost requires the app"],
    ["swiggy","â€”","5.00%","5.00%","â‚¹1,500/mo","Croma, Westside etc. via Online Shopping bucket"],
    ["hsbc-travelone","â€”","0.50%","4.00%","â€”","2 RP/â‚¹100; MRR via Accor (1:1)"],
    ["regalia-gold","â€”","1.25%","2.50%","â€”","2.5 RP/â‚¹100 base (post 15-May-2026 cut); MRR via Accor"],
    ["amazon-pay","â€”","1.00%","1.00%","â€”","1% CB on other spends"],
    ["amex-platinum","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["amex-mrcc","â€”","0.50%","1.00%","â€”","2 MR/â‚¹100; MRR via Marriott Bonvoy (1:1)"],
    ["onecard","â€”","0.20%","0.20%","â€”","2 RP/â‚¹100 Ã— â‚¹0.10 â€” no transfer"],
    ["sbi-simplysave","â€”","0.17%","0.17%","â€”","0.67 RP/â‚¹100"]
  ]
};

// AU Xcite Ultra intentionally has no category rows (not modeled in source data).

const HSBC_OFFERS = [
  ["Yatra","YATRAHSBC","15% off (max â‚¹3,000)","15% off (max â‚¹5,000)","12% off domestic (max â‚¹7,500); no intl hotel discount","31 Mar 2026","Once per card/category/month"],
  ["EaseMyTrip","EMTHSBCT1","15% off flights & hotels (max â‚¹3,000 total)","15% off (max â‚¹5,000)","Included in domestic combo","31 Dec 2026","Twice per card/product/year"],
  ["Goibibo","GOHSBCTRAVEL1","15% off (max â‚¹3,000)","15% off (max â‚¹5,000)","Flights, hotels & homestays","31 Mar 2026","Not published â€” verify"],
  ["Cleartrip","CTHSBCTRAVELONE","15% off (max â‚¹3,000)","15% off (max â‚¹5,000)","â€”","Ongoing â€” verify","Not published â€” verify"],
  ["MakeMyTrip","No code needed","15% off (max â‚¹3,000)","15% off (max â‚¹5,000)","â€”","31 Mar 2026","Not published â€” verify"],
  ["Paytm","HSBCTRAVEL1","15% off flights (max â‚¹5,000 total)","included","No hotel discount","31 Mar 2026","Not published â€” verify"],
  ["Emirates","INHSBC1","â€”","10% off intl flights only (max â‚¹12,000)","â€”","30 Apr 2026","Not published â€” verify"],
  ["StayVista","No code needed","â€”","â€”","11% off (max â‚¹3,000/booking)","Ongoing","Max 2 bookings/card/year"]
];

const FEE_WAIVERS = [
  ["AU Xcite Ultra","Lifetime Free (stack status)","Official bank page: â‚¹749+GST with â‚¹2L spend waiver from year 2 â€” but treated as LTF for this stack per confirmed actual status."],
  ["AmEx Platinum Travel","â‚¹5,000 + GST","No formal spend-based waiver. Discretionary retention offers sometimes available near renewal, more common around â‚¹7L+ annual spend â€” never guaranteed."],
  ["SBI SimplySave","â‚¹499 + GST","Waiver reverses from year 2 onward on â‚¹1L annual spend in the preceding year."],
  ["Axis Atlas","â‚¹5,000 + GST","No waiver mechanism exists â€” fee applies every renewal year regardless of spend."],
  ["HSBC TravelOne","â‚¹4,999 + GST","Waived on â‚¹8L annual spend."]
];

const GAPS = [
  ["AU Xcite Ultra fee status","Official AU Bank page states â‚¹749+GST annual fee with a â‚¹2L spend waiver from year 2. Treated as Lifetime Free throughout this document per confirmed actual status for this cardholder, not the published bank terms."],
  ["AU Xcite Ultra insurance","Official AU page states â‚¹20 lakh air accident cover; several review sites (CardInsider, Pluto Money) repeat â‚¹50 lakh instead. Official page treated as authoritative."],
  ["AU Xcite Ultra monthly RP cap","A figure of 25,000 RP/month appeared only in an unverified review comment thread and was deliberately dropped rather than included as fact."],
  ["AU Xcite Ultra BRR/MRR","Not modeled in the original category-rate data at all (card was added to the stack after that model was built)."],
  ["AmEx MRCC & AmEx Platinum Travel insurance","Not prominently documented for either card specifically (distinct from the Amex Platinum Charge card, which has extensive published cover). Treated as minimal/undocumented, low confidence."],
  ["AmEx Platinum Travel fee waiver","No formal spend-based waiver exists. Discretionary retention offers sometimes available by calling customer care close to renewal â€” more commonly reported around â‚¹7L+ annual spend, but never guaranteed."],
  ["Axis Atlas insurance","Sources conflict: CardInsider states no insurance exists; BankBazaar cites air accident + baggage cover. Unresolved; likely minimal or discontinued."],
  ["Axis Atlas guest lounge access","The tier-based visit quota covers the primary cardholder AND accompanying guests TOGETHER, from the same shared pool â€” no separate free-guest allowance on top. Differs from HDFC/Amex's Priority Pass model, where guests are always billed separately. Some sites conflate this with Axis Reserve/Magnus, which do carry a separate guest program â€” that figure does not apply to Atlas."],
  ["HSBC TravelOne accelerated points cap","Resolved as two separate tracks. Track A (direct spend on flights/aggregators/forex, 4 RP/â‚¹100) is capped at 50,000 RP/month. Track B (Hopper portal only, 6X hotels/4X flights) is capped separately at 18,000 RP/month, portal-specific only. Forex sits in Track A, not Track B â€” confirmed correct by the cardholder."],
  ["HSBC TravelOne aggregator usage frequency","Yatra (once/card/category/month) and EaseMyTrip (twice/card/product/year) have confirmed limits from HSBC's own terms. Goibibo, Cleartrip, MakeMyTrip, Paytm, and Emirates do not have a published frequency limit â€” flagged as 'check current T&Cs' rather than assumed unlimited."],
  ["HDFC Swiggy minimum transaction for 10% cashback","â‚¹249 (effective 17 April 2026) is used throughout, sourced from a dedicated update article specific to this legacy card variant. HDFC's own general product page still showed â‚¹100 as of a 1 July 2026 refresh â€” the â‚¹249 figure was confirmed correct by the cardholder."],
  ["No card in this stack offers free/complimentary guest lounge visits.","Priority Pass-based cards (Amex Platinum Travel, Regalia Gold, Tata Neu Infinity) charge guests US$27+GST per visit regardless of the cardholder's own quota. HSBC TravelOne has no guest access at all. Axis Atlas guests draw from the shared tier quota rather than being charged separately â€” the closest thing to a 'guest benefit' in the stack, but not a free additional allowance."],
  ["HDFC Regalia Gold Global Value Program (GVP)","Confirmed active as of 2026 (some older 2025 articles incorrectly flagged it as discontinued). â‚¹199+GST/year, gives 1% cashback on international/forex spend capped at â‚¹1,000/statement cycle, bringing the effective forex markup down from 2% to ~1%. Not retroactive â€” must be active before spending."]
];

/* =========================================================
   HELPERS
   ========================================================= */

function parsePct(str){
  if(!str || str.indexOf("Excluded") !== -1) return null;
  const cleaned = str.replace(/âˆ’/g,"-").replace("%","").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function fmtPct(str){
  if(!str || str.indexOf("Excluded") !== -1) return '<span class="note">Excluded</span>';
  const n = parsePct(str);
  const cls = n < 0 ? "neg" : (n > 0 ? "pos" : "");
  return '<span class="'+cls+'">'+str+'</span>';
}

/* =========================================================
   RENDER: CATEGORY PICKER
   ========================================================= */

let currentCategory = null;
let currentCardCatSort = "mrr";

function renderCatGrid(filter){
  const grid = document.getElementById("catGrid");
  grid.innerHTML = "";
  CATEGORIES.filter(c => !filter || c.label.toLowerCase().includes(filter.toLowerCase())).forEach(c => {
    const btn = document.createElement("div");
    btn.className = "cat-btn" + (currentCategory === c.key ? " active" : "");
    btn.innerHTML = '<span class="emoji">'+c.emoji+'</span>'+c.label;
    btn.onclick = () => { currentCategory = c.key; renderCatGrid(document.getElementById("catSearch").value); renderCatResult(); };
    grid.appendChild(btn);
  });
}

function renderCatResult(){
  const el = document.getElementById("catResult");
  if(!currentCategory){
    el.innerHTML = '<div class="empty-state">Pick a category above to see every card ranked by reward rate.</div>';
    return;
  }
  const cat = CATEGORIES.find(c => c.key === currentCategory);
  let rows = CATEGORY_DATA[currentCategory].slice();
  rows.sort((a,b) => {
    const av = parsePct(a[currentCardCatSort === "mrr" ? 3 : 2]);
    const bv = parsePct(b[currentCardCatSort === "mrr" ? 3 : 2]);
    if(av === null) return 1;
    if(bv === null) return -1;
    return bv - av;
  });
  const bestVal = rows.length ? parsePct(rows[0][currentCardCatSort === "mrr" ? 3 : 2]) : null;

  let html = '<h2>'+cat.emoji+' '+cat.label+'</h2>';
  html += '<div class="sort-row">Sort by: <select id="catSortSelect"><option value="mrr"'+(currentCardCatSort==="mrr"?" selected":"")+'>MRR (best achievable)</option><option value="brr"'+(currentCardCatSort==="brr"?" selected":"")+'>BRR (realistic)</option></select></div>';
  html += '<div style="overflow-x:auto;"><table><thead><tr><th>Card</th><th>Variant</th><th>BRR</th><th>MRR</th><th>Cap</th><th>Note</th></tr></thead><tbody>';
  rows.forEach(r => {
    const [cardKey, variant, brr, mrr, cap, note] = r;
    const val = parsePct(currentCardCatSort === "mrr" ? mrr : brr);
    const isBest = bestVal !== null && val === bestVal;
    html += '<tr class="'+(isBest?"best":"")+'">';
    html += '<td>'+CARDS[cardKey].name+'</td>';
    html += '<td class="note">'+variant+'</td>';
    html += '<td class="num">'+fmtPct(brr)+'</td>';
    html += '<td class="num">'+fmtPct(mrr)+'</td>';
    html += '<td class="note">'+cap+'</td>';
    html += '<td class="note">'+note+'</td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  if(currentCategory === "tata"){
    html += '<p class="note" style="margin-top:12px;">AU Xcite Ultra has no category-rate data available â€” added to the stack after the original model was built.</p>';
  }
  el.innerHTML = html;

  document.getElementById("catSortSelect").onchange = (e) => {
    currentCardCatSort = e.target.value;
    renderCatResult();
  };
}

document.getElementById("catSearch").addEventListener("input", (e) => renderCatGrid(e.target.value));

/* =========================================================
   RENDER: CARD DETAIL
   ========================================================= */

let currentCard = null;

function renderCardPicker(){
  const wrap = document.getElementById("cardPicker");
  wrap.innerHTML = "";
  CARD_ORDER.forEach(key => {
    const c = CARDS[key];
    const chip = document.createElement("div");
    chip.className = "card-chip" + (currentCard === key ? " active" : "");
    chip.innerHTML = '<span class="dot '+c.feeClass+'"></span>'+c.name;
    chip.onclick = () => { currentCard = key; renderCardPicker(); renderCardResult(); };
    wrap.appendChild(chip);
  });
}

function listSection(title, arr){
  if(!arr || !arr.length) return "";
  return '<h3>'+title+'</h3><ul class="clean">'+arr.map(x=>'<li>'+x+'</li>').join("")+'</ul>';
}

function renderCardResult(){
  const el = document.getElementById("cardResult");
  if(!currentCard){
    el.innerHTML = '<div class="empty-state">Pick a card above to see its full profile and category rankings.</div>';
    return;
  }
  const c = CARDS[currentCard];
  let html = '<h2>'+c.name+' <span class="badge '+c.feeClass+'">'+c.fee+'</span></h2>';
  html += '<p class="note">Role: '+c.role+'</p>';
  html += listSection("Milestones", c.milestones);
  html += listSection("Benefits", c.benefits);
  html += listSection("Lounge Access", c.lounge);
  html += '<h3>Forex Markup</h3><p style="font-size:0.9rem;">'+c.forex+'</p>';
  html += listSection("Insurance", c.insurance);
  html += listSection("Category Exclusions", c.exclusions);
  html += listSection("Redemption & Transfer", c.redemption);
  html += listSection("Other Notable Terms", c.other);

  // Build category ranking for this card
  const catRows = [];
  CATEGORIES.forEach(cat => {
    const rows = CATEGORY_DATA[cat.key] || [];
    rows.filter(r => r[0] === currentCard).forEach(r => {
      catRows.push({cat, variant:r[1], brr:r[2], mrr:r[3], cap:r[4], note:r[5]});
    });
  });
  catRows.sort((a,b) => {
    const av = parsePct(a.mrr), bv = parsePct(b.mrr);
    if(av === null) return 1;
    if(bv === null) return -1;
    return bv - av;
  });

  html += '<h3>BRR / MRR by Category</h3>';
  if(!catRows.length){
    html += '<p class="note">No BRR/MRR category data available for this card â€” not modeled in the original data set.</p>';
  } else {
    html += '<div style="overflow-x:auto;"><table><thead><tr><th>Category</th><th>Variant</th><th>BRR</th><th>MRR</th><th>Cap</th><th>Note</th></tr></thead><tbody>';
    catRows.forEach(r => {
      html += '<tr>';
      html += '<td>'+r.cat.emoji+' '+r.cat.label+'</td>';
      html += '<td class="note">'+r.variant+'</td>';
      html += '<td class="num">'+fmtPct(r.brr)+'</td>';
      html += '<td class="num">'+fmtPct(r.mrr)+'</td>';
      html += '<td class="note">'+r.cap+'</td>';
      html += '<td class="note">'+r.note+'</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  }

  el.innerHTML = html;
}

/* =========================================================
   RENDER: OFFERS
   ========================================================= */

let liveOffersLoaded = false;
let liveOffersLoading = false;
let liveOffersCache = null;
const LIVE_OFFER_CARD_IDS = [
  "amex_pt",
  "amex_mrcc",
  "regalia",
  "tata_neu",
  "swiggy",
  "au_xcite",
  "onecard",
  "amazon",
  "sbi",
  "atlas",
  "hsbc"
];

function escapeHtml(value){
  return String(value == null ? "" : value)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function formatScanTime(value){
  if(!value) return "Not scanned yet.";
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return value;
  return "Last scanned: " + date.toLocaleString("en-IN", {
    dateStyle:"medium",
    timeStyle:"short"
  });
}

function renderLiveOffers(data, message){
  const body = document.getElementById("liveOffersBody");
  const meta = document.getElementById("liveOffersMeta");
  const refreshBtn = document.getElementById("refreshOffersBtn");
  if(!body || !meta || !refreshBtn) return;

  refreshBtn.disabled = liveOffersLoading;
  refreshBtn.textContent = liveOffersLoading ? "Refreshing..." : "Refresh Now";

  if(message){
    meta.textContent = message;
  } else {
    meta.textContent = formatScanTime(data && data.meta && data.meta.scannedAt);
  }

  if(liveOffersLoading && !data){
    body.className = "empty-state";
    body.innerHTML = "Checking the latest saved offers...";
    return;
  }

  const results = data && data.results ? data.results : [];
  if(!results.length){
    body.className = "empty-state";
    body.innerHTML = "No saved scan results yet. Use Refresh Now after deploying with API keys.";
    return;
  }

  body.className = "offer-grid";
  body.innerHTML = results.map(result => {
    const offers = result.offers || [];
    const status = result.status === "error"
      ? '<p class="status-line">Scan error: '+escapeHtml(result.errorMessage || "Unknown error")+'</p>'
      : '<p class="status-line">'+escapeHtml(offers.length ? offers.length + " current offer(s)" : "No current offers found")+'</p>';

    const offerHtml = offers.map(offer => {
      const confidence = escapeHtml(offer.confidence || "low");
      const metaBits = [
        offer.discountText ? '<span class="pill">'+escapeHtml(offer.discountText)+'</span>' : "",
        offer.cap ? '<span class="pill">Cap: '+escapeHtml(offer.cap)+'</span>' : "",
        offer.validTill ? '<span class="pill">Valid: '+escapeHtml(offer.validTill)+'</span>' : "",
        '<span class="pill '+confidence+'">'+confidence+' confidence</span>'
      ].join("");
      return '<div style="margin-top:10px;">'
        + '<h3>'+escapeHtml(offer.title)+'</h3>'
        + '<p class="note">'+escapeHtml(offer.description)+'</p>'
        + '<div class="offer-meta">'+metaBits+'</div>'
        + '<details class="offer-source-toggle"><summary>Show source</summary><a href="'+escapeHtml(offer.sourceUrl)+'" target="_blank" rel="noopener">'+escapeHtml(offer.sourceUrl)+'</a></details>'
        + '</div>';
    }).join("");

    return '<article class="offer-card">'
      + '<h3>'+escapeHtml(result.cardName)+'</h3>'
      + status
      + offerHtml
      + '</article>';
  }).join("");
}

async function loadLiveOffers(force){
  if(liveOffersLoading) return;
  if(liveOffersLoaded && !force){
    renderLiveOffers(liveOffersCache);
    return;
  }

  liveOffersLoading = true;
  renderLiveOffers(liveOffersCache);
  try{
    const response = await fetch("/.netlify/functions/get-offers", { cache:"no-store" });
    if(!response.ok) throw new Error("Netlify function returned " + response.status);
    liveOffersCache = await response.json();
    liveOffersLoaded = true;
    renderLiveOffers(liveOffersCache);
  } catch(error){
    renderLiveOffers(liveOffersCache, "Live functions are not available in this local/static preview yet.");
  } finally {
    liveOffersLoading = false;
    renderLiveOffers(liveOffersCache);
  }
}

async function refreshLiveOffers(){
  if(liveOffersLoading) return;
  liveOffersLoading = true;
  renderLiveOffers(liveOffersCache, "Refreshing 11 cards one by one. This can take about a minute.");
  try{
    const working = liveOffersCache && liveOffersCache.results
      ? { results: liveOffersCache.results.slice(), meta: liveOffersCache.meta || null }
      : { results: [], meta: null };

    for(let i = 0; i < LIVE_OFFER_CARD_IDS.length; i++){
      const cardId = LIVE_OFFER_CARD_IDS[i];
      renderLiveOffers(working, "Refreshing card " + (i + 1) + " of " + LIVE_OFFER_CARD_IDS.length + "...");
      const response = await fetch("/.netlify/functions/refresh-card?cardId=" + encodeURIComponent(cardId), {
        method:"POST",
        cache:"no-store"
      });
      if(!response.ok) throw new Error("Netlify function returned " + response.status);
      const fresh = await response.json();
      const idx = working.results.findIndex(item => item.cardId === cardId);
      if(idx === -1){
        working.results.push(fresh.result);
      } else {
        working.results[idx] = fresh.result;
      }
      working.meta = fresh.meta || working.meta;
      liveOffersCache = working;
    }

    liveOffersLoaded = true;
    renderLiveOffers(liveOffersCache);
  } catch(error){
    renderLiveOffers(liveOffersCache, "Refresh needs the deployed Netlify site plus valid Tavily and Gemini keys.");
  } finally {
    liveOffersLoading = false;
    renderLiveOffers(liveOffersCache);
  }
}

function renderOffers(){
  const refreshBtn = document.getElementById("refreshOffersBtn");
  if(refreshBtn){
    refreshBtn.onclick = refreshLiveOffers;
  }
  renderLiveOffers(liveOffersCache);

  const body = document.getElementById("hsbcOffersBody");
  body.innerHTML = HSBC_OFFERS.map(o =>
    '<tr><td>'+o[0]+'</td><td><span class="offer-code">'+o[1]+'</span></td><td class="note">'+o[2]+'</td><td class="note">'+o[3]+'</td><td class="note">'+o[4]+'</td><td class="note">'+o[5]+'</td><td class="note">'+o[6]+'</td></tr>'
  ).join("");

  const feeBody = document.getElementById("feeWaiverBody");
  feeBody.innerHTML = FEE_WAIVERS.map(f =>
    '<tr><td>'+f[0]+'</td><td class="note">'+f[1]+'</td><td class="note">'+f[2]+'</td></tr>'
  ).join("");

  const acc = document.getElementById("milestoneAccordion");
  acc.innerHTML = CARD_ORDER.map(key => {
    const c = CARDS[key];
    return '<details><summary>'+c.name+'</summary><ul class="clean">'+c.milestones.map(m=>'<li>'+m+'</li>').join("")+'</ul></details>';
  }).join("");
}

/* =========================================================
   RENDER: GAPS
   ========================================================= */

function renderGaps(){
  const el = document.getElementById("gapsList");
  el.innerHTML = GAPS.map(g =>
    '<div class="gap-item"><b>'+g[0]+'</b><br>'+g[1]+'</div>'
  ).join("");
}

/* =========================================================
   TAB SWITCHING
   ========================================================= */

document.querySelectorAll("nav.tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav.tabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const view = btn.dataset.view;
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById("view-"+view).classList.add("active");
    if(view === "offers") loadLiveOffers(false);
  });
});

/* =========================================================
   INIT
   ========================================================= */

renderCatGrid();
renderCardPicker();
renderOffers();
renderGaps();
</script>

</body>
</html>

````

### `netlify.toml`

``toml
[build]
  functions = "netlify/functions"
  publish = "."

[functions]
  node_bundler = "esbuild"

````

### `package.json`

``json
{
  "name": "cardpickernoffers-neeraj",
  "private": true,
  "type": "module",
  "dependencies": {
    "@netlify/blobs": "^8.1.0"
  },
  "devDependencies": {
    "@netlify/functions": "^2.8.1"
  }
}

````

### `netlify/functions/_shared.mts`

``ts
import { getStore } from "@netlify/blobs";

export type Offer = {
  title: string;
  description: string;
  discountText: string;
  cap: string | null;
  validTill: string | null;
  sourceUrl: string;
  confidence: "high" | "medium" | "low";
};

export type CardOfferResult = {
  cardId: string;
  cardName: string;
  offers: Offer[];
  lastScanned: string;
  status: "ok" | "empty" | "error" | "never-scanned";
  errorMessage?: string;
};

export const CARDS: Record<string, { name: string; searchName: string }> = {
  amex_pt: { name: "AmEx Platinum Travel", searchName: "American Express Platinum Travel India credit card offers" },
  amex_mrcc: { name: "AmEx MRCC", searchName: "American Express Membership Rewards Credit Card India offers" },
  regalia: { name: "HDFC Regalia Gold", searchName: "HDFC Regalia Gold credit card offers" },
  tata_neu: { name: "HDFC Tata Neu Infinity", searchName: "HDFC Tata Neu Infinity credit card offers" },
  swiggy: { name: "HDFC Swiggy", searchName: "HDFC Swiggy credit card offers" },
  au_xcite: { name: "AU Xcite Ultra", searchName: "AU Bank Xcite Ultra credit card offers" },
  onecard: { name: "OneCard", searchName: "OneCard credit card offers India" },
  amazon: { name: "ICICI Amazon Pay", searchName: "ICICI Amazon Pay credit card offers" },
  sbi: { name: "SBI SimplySave", searchName: "SBI SimplySave credit card offers" },
  atlas: { name: "Axis Atlas", searchName: "Axis Atlas credit card offers" },
  hsbc: { name: "HSBC TravelOne", searchName: "HSBC TravelOne credit card offers India" }
};

const STORE_NAME = "live-card-offers";
const META_KEY = "meta:last-scan";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export async function readAllOffers() {
  const store = getStore(STORE_NAME);
  const results = await Promise.all(
    Object.entries(CARDS).map(async ([cardId, card]) => {
      const saved = await store.get(`offer:${cardId}`, { type: "json" });
      return saved || {
        cardId,
        cardName: card.name,
        offers: [],
        lastScanned: "",
        status: "never-scanned"
      };
    })
  );
  const meta = await store.get(META_KEY, { type: "json" });
  return { results, meta };
}

async function tavilySearch(card: { name: string; searchName: string }) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is not set");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: `${card.searchName} current credit card promotional offers coupons discounts valid India 2026`,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
      max_results: 3
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return (data.results || []).map((item: any) => ({
    title: String(item.title || ""),
    url: String(item.url || ""),
    content: String(item.content || item.snippet || "")
  })).filter((item: any) => item.url && item.content);
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Gemini returned no JSON object");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function structureOffers(card: { name: string }, searchResults: Array<{ title: string; url: string; content: string }>) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  if (!searchResults.length) return [];

  const prompt = `You extract currently-running Indian credit-card promotional offers.

Card: ${card.name}
Today's date: ${new Date().toISOString().slice(0, 10)}

Rules:
- Return only valid JSON. No markdown.
- Use only the supplied search results. Never invent a URL, merchant, cap, validity, or offer.
- Prefer bank/issuer pages and offer T&C pages over blogs.
- Exclude expired offers when the validity is clearly in the past.
- If an offer looks stale, unclear, or not card-specific, omit it.
- Keep at most 5 useful offers.
- confidence must be "high", "medium", or "low".
- sourceUrl must be one of the exact URLs from the search results.

Schema:
{
  "offers": [
    {
      "title": "short title",
      "description": "plain-English summary",
      "discountText": "e.g. 15% off, capped at Rs 3000",
      "cap": "cap text or null",
      "validTill": "date/validity text or null",
      "sourceUrl": "exact supplied URL",
      "confidence": "high"
    }
  ]
}

Search results:
${JSON.stringify(searchResults, null, 2)}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini structuring failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
  const parsed = extractJson(text);
  const allowedUrls = new Set(searchResults.map((result) => result.url));
  return (parsed.offers || []).filter((offer: any) => allowedUrls.has(offer.sourceUrl)).map((offer: any) => ({
    title: String(offer.title || "Current offer"),
    description: String(offer.description || ""),
    discountText: String(offer.discountText || ""),
    cap: offer.cap ? String(offer.cap) : null,
    validTill: offer.validTill ? String(offer.validTill) : null,
    sourceUrl: String(offer.sourceUrl),
    confidence: ["high", "medium", "low"].includes(offer.confidence) ? offer.confidence : "low"
  }));
}

async function scanCard(cardId: string, card: { name: string; searchName: string }): Promise<CardOfferResult> {
  const lastScanned = new Date().toISOString();
  try {
    const searchResults = await tavilySearch(card);
    const offers = await structureOffers(card, searchResults);
    return {
      cardId,
      cardName: card.name,
      offers,
      lastScanned,
      status: offers.length ? "ok" : "empty"
    };
  } catch (error: any) {
    return {
      cardId,
      cardName: card.name,
      offers: [],
      lastScanned,
      status: "error",
      errorMessage: error?.message || "Unknown scan error"
    };
  }
}

export async function scanAndSaveCard(cardId: string) {
  const card = CARDS[cardId];
  if (!card) throw new Error(`Unknown cardId: ${cardId}`);

  const result = await scanCard(cardId, card);
  const store = getStore(STORE_NAME);
  await store.setJSON(`offer:${cardId}`, result);

  const { results } = await readAllOffers();
  const meta = {
    scannedAt: new Date().toISOString(),
    cardCount: results.length,
    okCount: results.filter((item: any) => item.status === "ok" || item.status === "empty").length,
    errorCount: results.filter((item: any) => item.status === "error").length
  };
  await store.setJSON(META_KEY, meta);

  return { result, meta };
}

export async function runFullScan() {
  const scannedAt = new Date().toISOString();
  const results = await Promise.all(
    Object.entries(CARDS).map(([cardId, card]) => scanCard(cardId, card))
  );

  const store = getStore(STORE_NAME);
  await Promise.all(results.map((result) => store.setJSON(`offer:${result.cardId}`, result)));

  const meta = {
    scannedAt,
    cardCount: results.length,
    okCount: results.filter((result) => result.status === "ok" || result.status === "empty").length,
    errorCount: results.filter((result) => result.status === "error").length
  };
  await store.setJSON(META_KEY, meta);

  return { scannedAt, results };
}

````

### `netlify/functions/get-offers.mts`

``ts
import { jsonResponse, readAllOffers } from "./_shared.mts";

export default async function handler() {
  try {
    return jsonResponse(await readAllOffers());
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Unable to read offers" }, 500);
  }
}

````

### `netlify/functions/refresh-now.mts`

``ts
import { jsonResponse, runFullScan } from "./_shared.mts";

export default async function handler(request: Request) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST to refresh offers" }, 405);
  }

  try {
    return jsonResponse(await runFullScan());
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Unable to refresh offers" }, 500);
  }
}

````

### `netlify/functions/refresh-card.mts`

``ts
import { CARDS, jsonResponse, scanAndSaveCard } from "./_shared.mts";

export default async function handler(request: Request) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST to refresh a card" }, 405);
  }

  const url = new URL(request.url);
  const cardId = url.searchParams.get("cardId") || "";
  if (!CARDS[cardId]) {
    return jsonResponse({ error: "Unknown or missing cardId" }, 400);
  }

  try {
    return jsonResponse(await scanAndSaveCard(cardId));
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Unable to refresh card" }, 500);
  }
}

````

### `netlify/functions/weekly-scan.mts`

``ts
import { schedule } from "@netlify/functions";
import { runFullScan } from "./_shared.mts";

export const handler = schedule("30 0 * * 1", async () => {
  const result = await runFullScan();
  console.log("Weekly card-offer scan complete", {
    scannedAt: result.scannedAt,
    cards: result.results.length,
    errors: result.results.filter((item) => item.status === "error").length
  });
});

````

### `.gitignore`

``
node_modules/
.netlify/

````

### `README.md`

``md
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

````

