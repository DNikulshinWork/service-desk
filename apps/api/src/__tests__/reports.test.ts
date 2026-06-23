
import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../server.js';
import { FastifyInstance } from 'fastify';
import { resetInMemoryDb, createUser, createTicket } from '../auth.js';

describe('Sprint 5: Reports', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await buildApp();
    resetInMemoryDb();

    const admin = createUser('admin@test.com', 'password', 'Admin User', 'ADMIN');
    const user = createUser('user@test.com', 'password', 'Regular User', 'USER');

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: admin.email, password: 'password' },
    });
    adminToken = adminLogin.json().accessToken;

    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: user.email, password: 'password' },
    });
    userToken = userLogin.json().accessToken;

    // Create some tickets for report data
    await createTicket('Ticket 1', '...', 'HIGH', user.id, admin.id, 'IN_PROGRESS');
    await createTicket('Ticket 2', '...', 'MEDIUM', user.id, admin.id, 'RESOLVED');
    await createTicket('Ticket 3', '...', 'LOW', user.id);
  });

  it('allows ADMIN to access reports', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/reports/ticket-status',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
    const report = response.json();
    expect(report.totalTickets).toBe(3);
    expect(report.byStatus.IN_PROGRESS).toBe(1);
    expect(report.byStatus.RESOLVED).toBe(1);
    expect(report.byStatus.OPEN).toBe(1);
  });

  it('denies access to non-admin users for reports', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/reports/ticket-status',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('returns agent performance report', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/reports/agent-performance',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
    const report = response.json().data;
    expect(Array.isArray(report)).toBe(true);
    const adminStat = report.find(r => r.agentName === 'Admin User');
    expect(adminStat.assigned).toBe(2);
    expect(adminStat.resolved).toBe(1);
  });

  it('returns C-SAT report', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/reports/csat',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
    const report = response.json();
    expect(report.averageScore).toBeDefined();
    expect(report.totalRatings).toBeDefined();
  });
});
