
import { describe, expect, it, beforeEach } from 'vitest';
import { buildApp } from '../server.js';
import { getUserByEmail, resetInMemoryDb } from '../auth.js';

describe('tickets endpoints', () => {
  beforeEach(() => {
    resetInMemoryDb();
  });

  it('creates and lists tickets for an authenticated user', async () => {
    const app = await buildApp();
    const email = `ticket-user-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        name: 'Ticket User',
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

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        subject: 'Printer issue',
        description: 'The printer is not responding.',
        priority: 'HIGH',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      ticket: {
        subject: 'Printer issue',
        priority: 'HIGH',
      },
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/tickets',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().tickets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subject: 'Printer issue',
        }),
      ]),
    );
  });

  it('returns ticket details and allows updates by the owner', async () => {
    const app = await buildApp();
    const email = `ticket-owner-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'Password123!',
        name: 'Ticket Owner',
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

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        subject: 'Network issue',
        description: 'The network is unstable.',
        priority: 'MEDIUM',
      },
    });

    const ticket = createResponse.json().ticket;

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/tickets/${ticket.id}`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      ticket: {
        id: ticket.id,
        subject: 'Network issue',
        status: 'OPEN',
      },
    });

    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/api/v1/tickets/${ticket.id}`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        status: 'IN_PROGRESS',
        priority: 'LOW',
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      ticket: {
        id: ticket.id,
        status: 'IN_PROGRESS',
        priority: 'LOW',
      },
    });
  });

  it('allows admin to list all tickets, while user can only see their own', async () => {
    const app = await buildApp();
    const userEmail = `test-user-${Date.now()}@example.com`;
    const adminEmail = `test-admin-${Date.now()}@example.com`;

    // Create user and admin
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: userEmail, password: 'Password123!', name: 'Test User' },
    });
    const user = getUserByEmail(userEmail);
    if (user) {
      user.role = 'USER';
    }

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: adminEmail, password: 'Password123!', name: 'Test Admin' },
    });
    const admin = getUserByEmail(adminEmail);
    if (admin) {
      admin.role = 'ADMIN';
    }

    // Login as user and admin
    const userLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: userEmail, password: 'Password123!' },
    });
    const userAccessToken = userLoginResponse.json().accessToken;

    const adminLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: adminEmail, password: 'Password123!' },
    });
    const adminAccessToken = adminLoginResponse.json().accessToken;

    // Create tickets
    await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers: { authorization: `Bearer ${userAccessToken}` },
      payload: { subject: 'User Ticket', description: '...', priority: 'LOW' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers: { authorization: `Bearer ${adminAccessToken}` },
      payload: { subject: 'Admin Ticket', description: '...', priority: 'HIGH' },
    });

    // List tickets as user
    const userListResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/tickets',
      headers: { authorization: `Bearer ${userAccessToken}` },
    });
    expect(userListResponse.statusCode).toBe(200);
    const userTickets = userListResponse.json().tickets;
    expect(userTickets.length).toBe(1);
    expect(userTickets[0].subject).toBe('User Ticket');

    // List tickets as admin
    const adminListResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/tickets',
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    expect(adminListResponse.statusCode).toBe(200);
    const adminTickets = adminListResponse.json().tickets;
    expect(adminTickets.length).toBe(2);
    expect(adminTickets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subject: 'User Ticket' }),
        expect.objectContaining({ subject: 'Admin Ticket' }),
      ]),
    );
  });

  it('filters, sorts, and paginates tickets', async () => {
    const app = await buildApp();
    const email = `query-user-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'Password123!', name: 'Query User' },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'Password123!' },
    });

    const accessToken = loginResponse.json().accessToken;

    // Create a variety of tickets
    const ticket1 = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers: { authorization: `Bearer ${accessToken}` }, payload: { subject: 'First', description: '.', priority: 'LOW' } })).json().ticket;
    await new Promise(resolve => setTimeout(resolve, 10));
    const ticket2 = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers: { authorization: `Bearer ${accessToken}` }, payload: { subject: 'Second', description: '.', priority: 'MEDIUM' } })).json().ticket;
    await new Promise(resolve => setTimeout(resolve, 10));
    const ticket3 = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers: { authorization: `Bearer ${accessToken}` }, payload: { subject: 'Third', description: '.', priority: 'HIGH' } })).json().ticket;
    await new Promise(resolve => setTimeout(resolve, 10));
    const ticket4 = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers: { authorization: `Bearer ${accessToken}` }, payload: { subject: 'Fourth', description: '.', priority: 'MEDIUM' } })).json().ticket;

    // Update statuses
    await app.inject({ method: 'PUT', url: `/api/v1/tickets/${ticket3.id}`, headers: { authorization: `Bearer ${accessToken}` }, payload: { status: 'IN_PROGRESS' } });
    await app.inject({ method: 'PUT', url: `/api/v1/tickets/${ticket4.id}`, headers: { authorization: `Bearer ${accessToken}` }, payload: { status: 'IN_PROGRESS' } });

    // Filter by status
    const openTickets = await app.inject({ method: 'GET', url: '/api/v1/tickets?status=OPEN', headers: { authorization: `Bearer ${accessToken}` } });
    expect(openTickets.json().tickets.length).toBe(2);
    expect(openTickets.json().tickets.every((t: any) => t.status === 'OPEN')).toBe(true);

    // Filter by priority
    const highPriorityTickets = await app.inject({ method: 'GET', url: '/api/v1/tickets?priority=HIGH', headers: { authorization: `Bearer ${accessToken}` } });
    expect(highPriorityTickets.json().tickets.length).toBe(1);
    expect(highPriorityTickets.json().tickets[0].priority).toBe('HIGH');

    // Sort by createdAt
    const sortedTicketsAsc = await app.inject({ method: 'GET', url: '/api/v1/tickets?sortBy=createdAt&sortOrder=asc', headers: { authorization: `Bearer ${accessToken}` } });
    expect(sortedTicketsAsc.json().tickets.map((t: any) => t.subject)).toEqual(['First', 'Second', 'Third', 'Fourth']);

    const sortedTicketsDesc = await app.inject({ method: 'GET', url: '/api/v1/tickets?sortBy=createdAt&sortOrder=desc', headers: { authorization: `Bearer ${accessToken}` } });
    expect(sortedTicketsDesc.json().tickets.map((t: any) => t.subject)).toEqual(['Fourth', 'Third', 'Second', 'First']);

    // Paginate
    const page1 = await app.inject({ method: 'GET', url: '/api/v1/tickets?limit=2&page=1&sortBy=createdAt&sortOrder=asc', headers: { authorization: `Bearer ${accessToken}` } });
    expect(page1.json().tickets.length).toBe(2);
    expect(page1.json().tickets.map((t: any) => t.subject)).toEqual(['First', 'Second']);

    const page2 = await app.inject({ method: 'GET', url: '/api/v1/tickets?limit=2&page=2&sortBy=createdAt&sortOrder=asc', headers: { authorization: `Bearer ${accessToken}` } });
    expect(page2.json().tickets.length).toBe(2);
    expect(page2.json().tickets.map((t: any) => t.subject)).toEqual(['Third', 'Fourth']);
  });

});
