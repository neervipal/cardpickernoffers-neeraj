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
