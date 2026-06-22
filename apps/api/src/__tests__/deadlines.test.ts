
import { describe, expect, it, beforeEach } from 'vitest';
import { buildApp } from '../server.js';
import { getUserByEmail, resetInMemoryDb } from '../auth.js';

describe('Deadline calculation', () => {
  beforeEach(() => {
    resetInMemoryDb();
  });

  it('calculates deadlines correctly when a ticket is created', async () => {
    const app = await buildApp();
    const adminEmail = `deadline-admin-${Date.now()}@example.com`;
    const userEmail = `deadline-user-${Date.now()}@example.com`;

    // Register admin and user
    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: adminEmail, password: 'Password123!', name: 'Deadline Admin' } });
    const admin = getUserByEmail(adminEmail);
    if (admin) admin.role = 'ADMIN';

    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: userEmail, password: 'Password123!', name: 'Deadline User' } });

    // Login admin and user
    const adminLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: adminEmail, password: 'Password123!' } });
    const adminAccessToken = adminLogin.json().accessToken;

    const userLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: userEmail, password: 'Password123!' } });
    const userAccessToken = userLogin.json().accessToken;

    // 1. Create a Working Calendar (as admin)
    const calendarPayload = {
      name: 'Business Hours',
      timezone: 'UTC',
      workingDays: [1, 2, 3, 4, 5], // Mon-Fri
      workingHours: { start: '09:00', end: '17:00' },
    };
    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/working-calendars',
      headers: { authorization: `Bearer ${adminAccessToken}` },
      payload: calendarPayload,
    });

    // 2. Create an SLA Policy for 'High' priority (as admin)
    const slaPayload = {
      name: 'High Priority SLA',
      priority: 'High',
      responseTime: 4, // hours
      resolveTime: 16, // hours
    };
    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/sla-policies',
      headers: { authorization: `Bearer ${adminAccessToken}` },
      payload: slaPayload,
    });

    // 3. Create a Ticket (as user)
    const ticketPayload = {
      subject: 'Urgent issue: System down',
      description: 'The main production system is not responding.',
      priority: 'High',
    };
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers: { authorization: `Bearer ${userAccessToken}` },
      payload: ticketPayload,
    });

    expect(createResponse.statusCode).toBe(201);
    const ticket = createResponse.json().ticket;

    // 4. Verify the deadlines
    expect(ticket.responseDue).toBeDefined();
    expect(ticket.resolveDue).toBeDefined();

    // (Simple check, detailed logic is in deadlines.ts and will be tested there)
    const now = Date.now();
    const expectedResponseMin = now + (4 * 60 * 60 * 1000) - 10000; // allow 10s buffer
    const expectedResolveMin = now + (16 * 60 * 60 * 1000) - 10000; // allow 10s buffer

    expect(ticket.responseDue).toBeGreaterThan(expectedResponseMin);
    expect(ticket.resolveDue).toBeGreaterThan(expectedResolveMin);
  });
});
