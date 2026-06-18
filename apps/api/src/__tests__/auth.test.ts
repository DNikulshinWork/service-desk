import { describe, expect, it } from 'vitest';
import { buildApp } from '../server.js';

describe('auth endpoints', () => {
  it('registers and logs in a user', async () => {
    const app = await buildApp();
    const email = `user-${Date.now()}@example.com`;

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        name: 'Test User',
      },
    });

    expect(registerResponse.statusCode).toBe(201);
    expect(registerResponse.json()).toMatchObject({
      user: {
        email,
        name: 'Test User',
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

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json()).toHaveProperty('accessToken');
    expect(loginResponse.cookies.some((cookie) => cookie.name === 'refresh_token')).toBe(true);
  });

  it('returns current user profile for authenticated requests', async () => {
    const app = await buildApp();
    const email = `profile-${Date.now()}@example.com`;

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
    expect(profileResponse.json()).toMatchObject({
      user: {
        email,
        name: 'Profile User',
      },
    });
  });

  it('refreshes tokens using the refresh cookie and clears it on logout', async () => {
    const app = await buildApp();
    const email = `auth-flow-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        name: 'Auth Flow User',
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

    const refreshCookie = loginResponse.cookies.find((cookie) => cookie.name === 'refresh_token');
    expect(refreshCookie).toBeDefined();

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: {
        refresh_token: refreshCookie!.value,
      },
    });

    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponse.json()).toHaveProperty('accessToken');
    expect(refreshResponse.cookies.some((cookie) => cookie.name === 'refresh_token')).toBe(true);

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: {
        refresh_token: refreshCookie!.value,
      },
    });

    expect(logoutResponse.statusCode).toBe(200);
    expect(logoutResponse.cookies.some((cookie) => cookie.name === 'refresh_token' && cookie.value === '')).toBe(true);
  });
});
