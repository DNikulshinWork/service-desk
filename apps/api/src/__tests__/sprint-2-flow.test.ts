
import { describe, expect, it, beforeEach } from 'vitest';
import { buildApp } from '../server.js';
import { resetInMemoryDb } from '../auth.js';

describe('Sprint 2 full flow', () => {
  beforeEach(() => {
    resetInMemoryDb();
  });

  it('should run through the full ticket lifecycle', async () => {
    const app = await buildApp();
    const email = `sprint-2-user-${Date.now()}@example.com`;

    // 1. Register a new user
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        name: 'Sprint 2 User',
      },
    });

    // 2. Log in and get access token
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email,
        password: 'Password123!',
      },
    });

    const accessToken = loginResponse.json().accessToken;

    // 3. Create a new ticket
    const createTicketResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        subject: 'Full flow test',
        description: 'This is a test of the full ticket lifecycle.',
        priority: 'MEDIUM',
      },
    });

    expect(createTicketResponse.statusCode).toBe(201);
    const ticket = createTicketResponse.json().ticket;
    expect(ticket.subject).toBe('Full flow test');

    // 4. Add a comment to the ticket
    const addCommentResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${ticket.id}/comments`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        text: 'This is a test comment.',
      },
    });

    expect(addCommentResponse.statusCode).toBe(201);
    const comment = addCommentResponse.json().comment;
    expect(comment.text).toBe('This is a test comment.');

    // 5. Get comments for the ticket
    const getCommentsResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/tickets/${ticket.id}/comments`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(getCommentsResponse.statusCode).toBe(200);
    const comments = getCommentsResponse.json().comments;
    expect(comments.length).toBe(1);
    expect(comments[0].text).toBe('This is a test comment.');

    // 6. Add an attachment to the ticket
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const attachmentPayload = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\nHello, world!\r\n--${boundary}--`;

    const addAttachmentResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/tickets/${ticket.id}/attachments`,
        headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: attachmentPayload,
    });

    expect(addAttachmentResponse.statusCode).toBe(201);
    const attachment = addAttachmentResponse.json().attachment;
    expect(attachment.filename).toBe('test.txt');

    // 7. Get attachments for the ticket
    const getAttachmentsResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/tickets/${ticket.id}/attachments`,
        headers: {
            authorization: `Bearer ${accessToken}`,
        },
    });

    expect(getAttachmentsResponse.statusCode).toBe(200);
    const attachments = getAttachmentsResponse.json().attachments;
    expect(attachments.length).toBe(1);
    expect(attachments[0].filename).toBe('test.txt');
  });
});
