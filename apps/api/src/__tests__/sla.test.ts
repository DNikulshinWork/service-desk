
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../server.js';
import { FastifyInstance } from 'fastify';
import { resetInMemoryDb, createUser, createSlaPolicy, createWorkingCalendar, createTicket, getTicketById } from '../auth.js';
import { checkSlaBreaches } from '../sla.js';
import * as notifications from '../notifications.js';

// Mock the notifications module
vi.mock('../notifications.js', async () => {
  const actual = await vi.importActual('../notifications.js') as any;
  return {
    ...actual,
    sendNotification: vi.fn(),
  };
});

describe('Sprint 4: SLA and Notifications', () => {
  let app: FastifyInstance;
  let timer: NodeJS.Timeout;

  beforeAll(async () => {
    app = await buildApp();
    resetInMemoryDb();
    // Stop the timer from running during tests
    if ((app as any).slaTimer) {
      clearInterval((app as any).slaTimer);
    }
  });

  afterAll(() => {
    // Clear any timers that might have been set
    if (timer) clearInterval(timer);
  });

  it('calculates ticket deadlines based on SLA policy and working calendar', async () => {
    // Setup
    createWorkingCalendar('Business Hours', 'UTC', [1, 2, 3, 4, 5], { start: '09:00', end: '17:00' });
    createSlaPolicy('Urgent', 'URGENT', 1, 4); // 1 hour response, 4 hours resolve

    const creationTime = new Date('2024-01-01T10:00:00.000Z').getTime(); // Monday 10:00 AM UTC
    vi.spyOn(Date, 'now').mockReturnValue(creationTime);

    // Action
    const ticket = await createTicket('Test Ticket', 'Description', 'URGENT', 'user-1');

    // Assertion
    vi.spyOn(Date, 'now').mockRestore();
    expect(ticket.responseDue).toBeDefined();
    expect(ticket.resolveDue).toBeDefined();

    const responseDueDate = new Date(ticket.responseDue!);
    const resolveDueDate = new Date(ticket.resolveDue!);

    expect(responseDueDate.toISOString()).toBe('2024-01-01T11:00:00.000Z');
    expect(resolveDueDate.toISOString()).toBe('2024-01-01T14:00:00.000Z');
  });

  it('sends a notification when an SLA is breached', async () => {
    // Setup
    createSlaPolicy('Critical', 'CRITICAL', 1, 2);
    const creationTime = new Date('2024-01-03T10:00:00.000Z').getTime(); // Wednesday 10:00 AM UTC
    vi.spyOn(Date, 'now').mockReturnValue(creationTime);
    const ticket = await createTicket('SLA Breach Test', '...', 'CRITICAL', 'user-3');
    vi.spyOn(Date, 'now').mockRestore();

    // Mock sendNotification to check if it's called
    const sendNotificationSpy = vi.spyOn(notifications, 'sendNotification');

    // 1. Move time forward to breach the response SLA
    const breachTime = new Date('2024-01-03T11:01:00.000Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(breachTime);

    // 2. Run the check
    await checkSlaBreaches();

    // 3. Assert notification was sent for response breach
    expect(sendNotificationSpy).toHaveBeenCalledWith({
      type: 'SLA_BREACHED',
      ticketId: ticket.id,
      slaType: 'response',
    });

    // 4. Move time forward to breach the resolve SLA
    const resolveBreachTime = new Date('2024-01-03T12:01:00.000Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(resolveBreachTime);
    await checkSlaBreaches();

    // 5. Assert notification was sent for resolve breach
    expect(sendNotificationSpy).toHaveBeenCalledWith({
      type: 'SLA_BREACHED',
      ticketId: ticket.id,
      slaType: 'resolve',
    });

    vi.spyOn(Date, 'now').mockRestore();
    sendNotificationSpy.mockRestore();
  });
});
