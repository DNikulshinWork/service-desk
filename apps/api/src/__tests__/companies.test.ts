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

  it('does not list companies for other users', async () => {
    const app = await buildApp();
    const ownerEmail = `owner-${Date.now()}@example.com`;
    const otherUserEmail = `other-${Date.now()}@example.com`;

    // Register owner and login
    const regOwnerResponse = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: ownerEmail, password: 'Password123!', name: 'Owner' } });
    expect(regOwnerResponse.statusCode).toBe(201);
    const ownerLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: ownerEmail, password: 'Password123!' } });
    expect(ownerLogin.statusCode).toBe(200);
    const ownerToken = ownerLogin.json().accessToken;

    // Register other user and login
    const regOtherResponse = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: otherUserEmail, password: 'Password123!', name: 'Other' } });
    expect(regOtherResponse.statusCode).toBe(201);
    const otherUserLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: otherUserEmail, password: 'Password123!' } });
    expect(otherUserLogin.statusCode).toBe(200);
    const otherUserToken = otherUserLogin.json().accessToken;

    // Owner creates a company
    await app.inject({ method: 'POST', url: '/api/v1/companies', headers: { authorization: `Bearer ${ownerToken}` }, payload: { name: 'Owners Corp' } });

    // Other user lists companies
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/companies',
      headers: {
        authorization: `Bearer ${otherUserToken}`,
      },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().companies).toHaveLength(0);
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

  it('returns 401 when accessed without a token', async () => {
    const app = await buildApp();
    const createResponse = await app.inject({ method: 'POST', url: '/api/v1/companies', payload: { name: 'ghost company' } });
    expect(createResponse.statusCode).toBe(401);

    const listResponse = await app.inject({ method: 'GET', url: '/api/v1/companies' });
    expect(listResponse.statusCode).toBe(401);

    const usersResponse = await app.inject({ method: 'GET', url: '/api/v1/companies/some-id/users' });
    expect(usersResponse.statusCode).toBe(401);
  });
});
