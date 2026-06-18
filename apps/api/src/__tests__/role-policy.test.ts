import { describe, expect, it } from 'vitest';
import { signAccessToken } from '../auth.js';
import { buildApp } from '../server.js';

describe('role policy checks', () => {
  it('rejects users without admin role from admin-only endpoint', async () => {
    const app = await buildApp();
    const accessToken = signAccessToken('user-1', 'USER');

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows admin role to access admin-only endpoint', async () => {
    const app = await buildApp();
    const accessToken = signAccessToken('admin-1', 'ADMIN');

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('users');
  });

  it('returns registered users for admin requests', async () => {
    const app = await buildApp();
    const email = `admin-list-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        name: 'Admin List User',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      headers: {
        authorization: `Bearer ${signAccessToken('admin-2', 'ADMIN')}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email,
          name: 'Admin List User',
        }),
      ]),
    );
  });
});
