import { describe, expect, it } from 'vitest';
import { buildApp } from '../server.js';

describe('oauth endpoints', () => {
  it('redirects to provider login page for github', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oauth/github',
    });

    expect(response.statusCode).toBe(302);
  });

  it('returns bad request for unsupported provider', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oauth/unknown',
    });

    expect(response.statusCode).toBe(400);
  });
});
