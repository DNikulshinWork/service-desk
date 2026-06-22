
import { test, expect, describe, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../server.js';
import { resetInMemoryDb } from '../auth.js';

describe('Auth API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    resetInMemoryDb();
  });

  afterAll(async () => {
    await app.close();
  });

  test('POST /api/v1/auth/register - should register a new user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      },
    });

    expect(response.statusCode).toBe(201);
    const payload = JSON.parse(response.payload);
    expect(payload.user).toHaveProperty('id');
    expect(payload.user.email).toBe('test@example.com');
    expect(payload.user.name).toBe('Test User');
    expect(payload.user.role).toBe('USER');
  });
});
