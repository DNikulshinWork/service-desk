
// This module contains functions for sending notifications through various transports.

/**
 * Sends an email.
 * NOTE: This is a mock implementation for demonstration purposes.
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<{ ok: boolean }> {
  console.log('--- Sending Email ---');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`${body}`);
  console.log('---------------------');
  return { ok: true };
}
