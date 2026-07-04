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
