
import { test, expect, describe, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../server.js';
import { resetInMemoryDb, createUser } from '../auth.js';

describe('Auth API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    resetInMemoryDb();
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

  test('POST /api/v1/auth/login - should log in an existing user', async () => {
    // Create a user to log in with
    createUser('login@example.com', 'password123', 'Login User');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'login@example.com',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload).toHaveProperty('accessToken');
    expect(payload.user.email).toBe('login@example.com');
    expect(response.cookies[0]).toHaveProperty('name', 'refresh_token');
  });

  test('POST /api/v1/auth/login - should fail with invalid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'wrong@example.com',
        password: 'wrongpassword',
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
