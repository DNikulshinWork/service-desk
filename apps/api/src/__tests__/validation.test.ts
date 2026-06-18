import { describe, expect, it } from 'vitest';
import { buildApp } from '../server.js';

describe('validation and error handling', () => {
  it('returns 400 for invalid register payload', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'not-an-email',
        password: '123',
        name: '',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 401 for missing auth token', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
    });

    expect(response.statusCode).toBe(401);
  });
});
