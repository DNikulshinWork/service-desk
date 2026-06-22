
// This is a mock transport layer. In a real application, this would
// integrate with services like Postmark, SendGrid, or a webhook provider.

export const sentEmails: { to: string; subject: string; body: string }[] = [];

export function sendEmail(to: string, subject: string, body: string) {
  console.log(`--- Sending Email ---`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(body);
  console.log(`---------------------`);

  // Store for test verification
  sentEmails.push({ to, subject, body });

  return Promise.resolve();
}

export function clearSentEmails() {
  sentEmails.length = 0;
}
