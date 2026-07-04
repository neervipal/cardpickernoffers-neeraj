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
