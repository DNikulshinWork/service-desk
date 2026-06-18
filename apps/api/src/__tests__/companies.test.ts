import { describe, expect, it } from 'vitest';
import { buildApp } from '../server.js';

describe('company endpoints', () => {
  it('creates a company and lists companies for the owner', async () => {
    const app = await buildApp();
    const email = `company-owner-${Date.now()}@example.com`;

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        name: 'Company Owner',
      },
    });

    expect(registerResponse.statusCode).toBe(201);

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email,
        password: 'Password123!',
      },
    });

    const accessToken = loginResponse.json().accessToken;

    const createCompanyResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/companies',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        name: 'Acme Corp',
        domain: 'acme.test',
      },
    });

    expect(createCompanyResponse.statusCode).toBe(201);
    expect(createCompanyResponse.json()).toMatchObject({
      company: {
        name: 'Acme Corp',
      },
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/companies',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().companies).toHaveLength(1);
  });

  it('returns users for a company', async () => {
    const app = await buildApp();
    const email = `company-user-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        name: 'Company User',
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

    const createCompanyResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/companies',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        name: 'Beta Ltd',
      },
    });

    const companyId = createCompanyResponse.json().company.id;

    const usersResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/companies/${companyId}/users`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(usersResponse.statusCode).toBe(200);
    expect(usersResponse.json().users).toHaveLength(1);
  });
});
