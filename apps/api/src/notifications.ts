
import { getTicketById, getUserById } from './auth.js';
import { sendEmail } from './transports.js';

export type NotificationEvent =
  | { type: 'TICKET_CREATED'; ticketId: string; creatorId: string; }
  | { type: 'TICKET_ASSIGNED'; ticketId: string; assigneeId: string; }
  | { type: 'NEW_COMMENT'; ticketId: string; commentId: string; creatorId: string; };

const ADMIN_EMAIL = 'admin@example.com';

export async function sendNotification(event: NotificationEvent) {
  console.log(`[Notification] Event received: ${event.type}`);

  const ticket = await getTicketById(event.ticketId);
  if (!ticket) return;

  let to = ADMIN_EMAIL;
  let subject = '';
  let body = '';

  switch (event.type) {
    case 'TICKET_CREATED': {
      const creator = await getUserById(event.creatorId);
      subject = `[Ticket #${ticket.id}] New Ticket Created: ${ticket.subject}`;
      body = `A new ticket has been created by ${creator?.name} (${creator?.email}).\n\nDetails:\n- Priority: ${ticket.priority}\n- Status: ${ticket.status}`;
      // Notify admins
      to = ADMIN_EMAIL;
      break;
    }
    case 'TICKET_ASSIGNED': {
      const assignee = await getUserById(event.assigneeId);
      if (!assignee) return;
      subject = `[Ticket #${ticket.id}] You have been assigned a new ticket: ${ticket.subject}`;
      body = `You have been assigned a ticket.\n\nDetails:\n- Priority: ${ticket.priority}\n- Status: ${ticket.status}`;
      to = assignee.email;
      break;
    }
    case 'NEW_COMMENT': {
      const creator = await getUserById(event.creatorId);
      const ticketCreator = await getUserById(ticket.creatorId);
      if (!ticketCreator) return;
      
      subject = `[Ticket #${ticket.id}] New comment from ${creator?.name}: ${ticket.subject}`;
      body = `A new comment was added by ${creator?.name} (${creator?.email}).`;
      // Notify ticket creator, unless they wrote the comment
      if (creator?.id !== ticketCreator.id) {
        to = ticketCreator.email;
      } else {
        return; // Don't notify on your own comments
      }
      break;
    }
  }

  if (to && subject && body) {
    await sendEmail(to, subject, body);
  }
}
