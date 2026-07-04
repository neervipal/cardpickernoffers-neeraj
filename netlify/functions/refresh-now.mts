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
