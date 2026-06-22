import { describe, expect, it } from 'vitest';
import { buildApp } from '../server.js';

describe('profile flow', () => {
  it('updates profile name for authenticated user', async () => {
    const app = await buildApp();
    const email = `profile-flow-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        name: 'Original Name',
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
        name: 'Updated Name',
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().user.name).toBe('Updated Name');
  });

  it('returns 401 when updating profile without a token', async () => {
    const app = await buildApp();

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      payload: {
        name: 'Updated Name',
      },
    });

    expect(updateResponse.statusCode).toBe(401);
  });

  it('returns profile info after login', async () => {
    const app = await buildApp();
    const email = `profile-flow-me-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        name: 'Profile User',
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

    const profileResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(profileResponse.statusCode).toBe(200);
    expect(profileResponse.json().user.email).toBe(email);
  });

  it('returns 401 when getting profile without a token', async () => {
    const app = await buildApp();

    const profileResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
    });

    expect(profileResponse.statusCode).toBe(401);
  });
});
