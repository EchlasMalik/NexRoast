type LeadNotification = {
  name: string;
  email: string;
  message: string | null;
  roastUrl: string;
  roastLink: string;
  score: number | null;
};

/**
 * Pings a Slack or Discord incoming webhook with the new lead's details.
 * Slack and Discord expect slightly different JSON shapes (`text` vs
 * `content`) for a plain message, so we detect which one from the URL.
 *
 * Best-effort: callers should treat a thrown error here as "the lead was
 * still saved, just didn't get announced" rather than a failed submission.
 */
export async function notifyLead(lead: LeadNotification): Promise<void> {
  const webhookUrl = process.env.LEAD_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn(
      "LEAD_NOTIFICATION_WEBHOOK_URL is not set — skipping lead notification.",
    );
    return;
  }

  const scoreText = lead.score !== null ? ` (scored ${lead.score}/100)` : "";
  const text = [
    `🔥 New "fix it for me" lead`,
    `${lead.name} <${lead.email}>`,
    `Roast: ${lead.roastUrl}${scoreText}`,
    lead.message ? `Message: ${lead.message}` : null,
    `Link: ${lead.roastLink}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const isDiscord = /discord(app)?\.com/.test(webhookUrl);
  const body = isDiscord ? { content: text } : { text };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Lead notification webhook responded with ${response.status}`,
    );
  }
}
