import { jsonResponse, readAllOffers } from "./_shared.mts";

export default async function handler() {
  try {
    return jsonResponse(await readAllOffers());
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Unable to read offers" }, 500);
  }
}
