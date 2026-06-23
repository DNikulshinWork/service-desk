
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { buildApp } from '../server.js';
import { FastifyInstance } from 'fastify';
import { createUser, createTicket, resetInMemoryDb } from '../auth.js';
import * as Integrations from '../integrations.js';

describe('Messenger Integrations', () => {
  let app: FastifyInstance;
  let userToken: string;

  beforeAll(async () => {
    app = await buildApp();
    resetInMemoryDb();

    const user = createUser('user@test.com', 'password', 'Test User');
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: user.email, password: 'password' },
    });
    userToken = login.json().accessToken;
  });

  it('sends notifications to Slack and Telegram when a ticket is created', async () => {
    const slackSpy = vi.spyOn(Integrations, 'sendToSlack');
    const telegramSpy = vi.spyOn(Integrations, 'sendToTelegram');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        subject: 'Integration Test Ticket',
        description: 'This is a test.',
        priority: 'HIGH',
      },
    });

    expect(response.statusCode).toBe(201);

    // Проверяем, что mock-функции были вызваны
    expect(slackSpy).toHaveBeenCalled();
    expect(telegramSpy).toHaveBeenCalled();

    // Проверяем, что они были вызваны с правильными аргументами
    expect(slackSpy).toHaveBeenCalledWith('general', expect.stringContaining('Integration Test Ticket'));
    expect(telegramSpy).toHaveBeenCalledWith('12345', expect.stringContaining('Integration Test Ticket'));

    // Очищаем mock-функции после теста
    slackSpy.mockRestore();
    telegramSpy.mockRestore();
  });
});
