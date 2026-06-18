import { describe, expect, it } from 'vitest';
import { buildApp } from '../server.js';

describe('company profile integration', () => {
  it('keeps profile update and company listing consistent for the same user', async () => {
    const app = await buildApp();
    const email = `company-profile-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        name: 'Company Profile User',
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

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        name: 'Updated Profile User',
      },
    });

    const companyResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/companies',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        name: 'Linked Company',
        domain: 'linked.test',
      },
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/companies',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(companyResponse.statusCode).toBe(201);
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().companies).toHaveLength(1);
  });
});
