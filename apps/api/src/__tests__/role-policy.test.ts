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
});
