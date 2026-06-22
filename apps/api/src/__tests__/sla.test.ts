
import { describe, expect, it, beforeEach } from 'vitest';
import { buildApp } from '../server.js';
import { getUserByEmail, resetInMemoryDb } from '../auth.js';

describe('SLA policies endpoints', () => {
  beforeEach(() => {
    resetInMemoryDb();
  });

  it('allows ADMIN to manage SLA policies', async () => {
    const app = await buildApp();
    const adminEmail = `sla-admin-${Date.now()}@example.com`;
    const userEmail = `sla-user-${Date.now()}@example.com`;

    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: adminEmail, password: 'Password123!', name: 'SLA Admin' } });
    const admin = getUserByEmail(adminEmail);
    if (admin) admin.role = 'ADMIN';

    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: userEmail, password: 'Password123!', name: 'SLA User' } });

    const adminLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: adminEmail, password: 'Password123!' } });
    const adminAccessToken = adminLogin.json().accessToken;

    const userLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: userEmail, password: 'Password123!' } });
    const userAccessToken = userLogin.json().accessToken;

    // User cannot create an SLA policy
    const userCreateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/sla-policies',
      headers: { authorization: `Bearer ${userAccessToken}` },
      payload: { name: 'User Policy', priority: 'High', responseTime: 1, resolveTime: 4 },
    });
    expect(userCreateResponse.statusCode).toBe(403);

    // Admin can create an SLA policy
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/sla-policies',
      headers: { authorization: `Bearer ${adminAccessToken}` },
      payload: { name: 'High Priority', priority: 'High', responseTime: 1, resolveTime: 4 },
    });
    expect(createResponse.statusCode).toBe(201);
    const policy = createResponse.json().policy;
    expect(policy.name).toBe('High Priority');

    // Admin can list SLA policies
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/sla-policies',
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().policies.length).toBe(1);

    // Admin can get a specific SLA policy
    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/sla-policies/${policy.id}`,
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().policy.name).toBe('High Priority');

    // Admin can update an SLA policy
    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/sla-policies/${policy.id}`,
      headers: { authorization: `Bearer ${adminAccessToken}` },
      payload: { name: 'Critical Priority' },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().policy.name).toBe('Critical Priority');

    // Admin can delete an SLA policy
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/sla-policies/${policy.id}`,
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    expect(deleteResponse.statusCode).toBe(204);

    // The policy should no longer exist
    const getAfterDeleteResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/sla-policies/${policy.id}`,
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    expect(getAfterDeleteResponse.statusCode).toBe(404);
  });
});
