
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createTicket, updateTicket, createComment, resetInMemoryDb, createUser, type Ticket } from '../auth.js';
import * as transports from '../transports.js';

// Mock the transports module
vi.mock('../transports.js', async (importOriginal) => {
  const actual = await importOriginal<typeof transports>();
  return {
    ...actual,
    sendEmail: vi.fn(),
  };
});

const sendEmailSpy = vi.mocked(transports.sendEmail);

describe('Notification Emails', () => {
  let adminUser: any, user1: any, user2: any;

  beforeEach(() => {
    resetInMemoryDb();
    vi.clearAllMocks();

    adminUser = createUser('admin@example.com', 'password', 'Admin', 'ADMIN');
    user1 = createUser('user1@example.com', 'password', 'User One');
    user2 = createUser('user2@example.com', 'password', 'User Two');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends an email to admins when a ticket is created', async () => {
    const ticket = await createTicket('Email Test', '...', 'High', user1.id);

    expect(sendEmailSpy).toHaveBeenCalledOnce();
    expect(sendEmailSpy).toHaveBeenCalledWith(
      adminUser.email,
      expect.stringContaining(`[Ticket #${ticket.id}] New Ticket Created: Email Test`),
      expect.stringContaining(`A new ticket has been created by ${user1.name}`)
    );
  });

  describe('with an existing ticket', () => {
    let ticket: Ticket;

    beforeEach(async () => {
      // Create a ticket and clear the mock from the creation notification
      ticket = await createTicket('Test Ticket', '...', 'Medium', user1.id);
      vi.clearAllMocks();
    });

    it('sends an email to the assignee when a ticket is assigned', async () => {
      await updateTicket(ticket.id, { assigneeId: user2.id });

      expect(sendEmailSpy).toHaveBeenCalledOnce();
      expect(sendEmailSpy).toHaveBeenCalledWith(
        user2.email,
        expect.stringContaining('You have been assigned a new ticket'),
        expect.stringContaining(`by ${user1.name}`)
      );
    });

    it('sends an email to the ticket creator when a comment is added by someone else', async () => {
      await createComment('A new comment from user 2', ticket.id, user2.id);

      expect(sendEmailSpy).toHaveBeenCalledOnce();
      expect(sendEmailSpy).toHaveBeenCalledWith(
        user1.email,
        expect.stringContaining(`New comment from ${user2.name}`),
        expect.stringContaining('A new comment was added by')
      );
    });

    it('does not send an email to the commenter when they add a comment', async () => {
      await createComment('I am commenting on my own ticket', ticket.id, user1.id);

      expect(sendEmailSpy).not.toHaveBeenCalled();
    });
  });
});
