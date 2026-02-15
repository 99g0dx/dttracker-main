/**
 * Fire-and-forget trigger for auto-scraping a submission's metrics.
 * Called from webhook handlers after a submission is created/updated with a content URL.
 *
 * This calls the scrape-activation-submission Edge Function internally using the
 * service role key so no user JWT is needed.
 */
export function triggerAutoScrape(
  supabaseUrl: string,
  serviceRoleKey: string,
  submissionId: string,
  label: string,
): void {
  const scrapeUrl = `${supabaseUrl}/functions/v1/scrape-activation-submission`;

  // Fire and forget — don't await, don't block the webhook response
  fetch(scrapeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify({ submissionId }),
  })
    .then(async (res) => {
      if (res.ok) {
        console.log(
          `[${label}] Auto-scrape triggered successfully for submission ${submissionId}`,
        );
      } else {
        const text = await res.text().catch(() => "");
        console.warn(
          `[${label}] Auto-scrape returned ${res.status} for submission ${submissionId}: ${text.substring(0, 200)}`,
        );
      }
    })
    .catch((err) => {
      // Non-fatal: scraping can be retried manually
      console.warn(
        `[${label}] Auto-scrape failed for submission ${submissionId}:`,
        err instanceof Error ? err.message : err,
      );
    });
}
