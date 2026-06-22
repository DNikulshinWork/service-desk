
import { describe, expect, it, beforeEach } from 'vitest';
import { buildApp } from '../server.js';
import { getUserByEmail, resetInMemoryDb } from '../auth.js';

describe('Working calendars endpoints', () => {
  beforeEach(() => {
    resetInMemoryDb();
  });

  it('allows ADMIN to manage working calendars', async () => {
    const app = await buildApp();
    const adminEmail = `calendar-admin-${Date.now()}@example.com`;
    const userEmail = `calendar-user-${Date.now()}@example.com`;

    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: adminEmail, password: 'Password123!', name: 'Calendar Admin' } });
    const admin = getUserByEmail(adminEmail);
    if (admin) admin.role = 'ADMIN';

    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: userEmail, password: 'Password123!', name: 'Calendar User' } });

    const adminLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: adminEmail, password: 'Password123!' } });
    const adminAccessToken = adminLogin.json().accessToken;

    const userLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: userEmail, password: 'Password123!' } });
    const userAccessToken = userLogin.json().accessToken;

    const calendarPayload = {
      name: 'Standard Business Hours',
      timezone: 'America/New_York',
      workingDays: [1, 2, 3, 4, 5], // Monday-Friday
      workingHours: { start: '09:00', end: '17:00' },
    };

    // User cannot create a calendar
    const userCreateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/working-calendars',
      headers: { authorization: `Bearer ${userAccessToken}` },
      payload: calendarPayload,
    });
    expect(userCreateResponse.statusCode).toBe(403);

    // Admin can create a calendar
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/working-calendars',
      headers: { authorization: `Bearer ${adminAccessToken}` },
      payload: calendarPayload,
    });
    expect(createResponse.statusCode).toBe(201);
    const calendar = createResponse.json().calendar;
    expect(calendar.name).toBe('Standard Business Hours');

    // Admin can list calendars
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/working-calendars',
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().calendars.length).toBe(1);

    // Admin can get a specific calendar
    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/working-calendars/${calendar.id}`,
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().calendar.name).toBe('Standard Business Hours');

    // Admin can update a calendar
    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/working-calendars/${calendar.id}`,
      headers: { authorization: `Bearer ${adminAccessToken}` },
      payload: { timezone: 'Europe/London' },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().calendar.timezone).toBe('Europe/London');

    // Admin can delete a calendar
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/working-calendars/${calendar.id}`,
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    expect(deleteResponse.statusCode).toBe(204);

    // The calendar should no longer exist
    const getAfterDeleteResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/working-calendars/${calendar.id}`,
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    expect(getAfterDeleteResponse.statusCode).toBe(404);
  });
});
