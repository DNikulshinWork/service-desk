import { describe, expect, it } from 'vitest';
import { buildApp } from '../server.js';

describe('rbac and auth middleware', () => {
  it('rejects access to protected endpoint without token', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
    });

    expect(response.statusCode).toBe(401);
  });

  it('allows owners to fetch their own companies', async () => {
    const app = await buildApp();
    const email = `rbac-owner-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        name: 'RBAC Owner',
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

    const companiesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/companies',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(companiesResponse.statusCode).toBe(200);
    expect(companiesResponse.json().companies).toBeDefined();
  });
});
