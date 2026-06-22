
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  createTicket,
  updateTicket,
  createComment,
  getTicketById,
  resetInMemoryDb,
  createSlaPolicy,
  createWorkingCalendar,
  createUser,
} from '../auth.js';

describe('SLA Status Calculation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetInMemoryDb();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('correctly calculates SLA statuses based on ticket lifecycle', async () => {
    // Setup users
    const user = createUser('user@test.com', 'password', 'Test User');
    const agent = createUser('agent@test.com', 'password', 'Test Agent');

    // 1. Setup Calendar and SLA Policy
    createWorkingCalendar('Biz Hours', 'UTC', [1, 2, 3, 4, 5], { start: '09:00', end: '17:00' });
    createSlaPolicy('Critical', 'High', 2, 8); // 2h response, 8h resolve

    // 2. Create ticket
    const creationTime = new Date('2024-01-01T10:00:00.000Z').getTime();
    vi.setSystemTime(creationTime);
    const createdTicket = await createTicket('SLA test', '...', 'High', user.id);

    let ticket = getTicketById(createdTicket.id)!;

    // Initial state: both Pending
    expect(ticket.responseSlaStatus).toBe('Pending');
    expect(ticket.resolveSlaStatus).toBe('Pending');

    // 3. Agent responds *within* response time
    const responseTime = new Date('2024-01-01T11:00:00.000Z').getTime();
    vi.setSystemTime(responseTime);
    await createComment('Looking into it.', ticket.id, agent.id);

    ticket = getTicketById(ticket.id)!;

    // Response SLA Met, Resolve SLA still Pending
    expect(ticket.responseSlaStatus).toBe('Met');
    expect(ticket.resolveSlaStatus).toBe('Pending');

    // 4. Time passes, resolve SLA is breached
    const breachTime = new Date('2024-01-02T12:00:00.000Z').getTime();
    vi.setSystemTime(breachTime);

    ticket = getTicketById(ticket.id)!;
    expect(ticket.responseSlaStatus).toBe('Met');
    expect(ticket.resolveSlaStatus).toBe('Breached');

    // 5. Ticket is closed (after breach)
    const closingTime = new Date('2024-01-02T13:00:00.000Z').getTime();
    vi.setSystemTime(closingTime);
    await updateTicket(ticket.id, { status: 'CLOSED' });

    ticket = getTicketById(ticket.id)!;

    // Final state: Response Met, Resolve Breached
    expect(ticket.responseSlaStatus).toBe('Met');
    expect(ticket.resolveSlaStatus).toBe('Breached');
  });
});
