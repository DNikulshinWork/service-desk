import { describe, expect, it } from 'vitest';
import { buildApp } from '../server.js';

describe('tickets endpoints', () => {
  it('creates and lists tickets for an authenticated user', async () => {
    const app = await buildApp();
    const email = `ticket-user-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        name: 'Ticket User',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email,
        password: 'Password123!',
      },
    });

    const accessToken = loginResponse.json().accessToken;

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        subject: 'Printer issue',
        description: 'The printer is not responding.',
        priority: 'HIGH',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      ticket: {
        subject: 'Printer issue',
        priority: 'HIGH',
      },
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/tickets',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().tickets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subject: 'Printer issue',
        }),
      ]),
    );
  });
});
