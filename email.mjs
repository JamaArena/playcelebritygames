// Sends sign-in codes through Resend (RESEND_API_KEY + EMAIL_FROM). Without a key the game falls back
// to the fixed code 123456 (see service.mjs) until email is configured.
export function resendSender(apiKey, from) {
  if (!apiKey) return null;
  return async ({ to, subject, text }) => {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: from || 'Celebrity Games <onboarding@resend.dev>', to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Email provider rejected the message (${response.status}).`);
  };
}