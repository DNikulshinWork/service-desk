
import { getUserById, getTicketById, getCommentsByTicketId } from './auth.js';
import { sendToSlack, sendToTelegram } from './integrations.js';
import { sendEmail } from './transports.js';

const ADMIN_EMAIL = 'admin@example.com';

interface NotificationEvent {
  type: 'TICKET_CREATED' | 'TICKET_ASSIGNED' | 'NEW_COMMENT';
  ticketId: string;
  [key: string]: any;
}

async function handleEmailNotification(event: NotificationEvent) {
  const ticket = getTicketById(event.ticketId);
  if (!ticket) return;

  const creator = getUserById(ticket.creatorId);
  if (!creator) return;

  switch (event.type) {
    case 'TICKET_CREATED':
      await sendEmail(
        ADMIN_EMAIL,
        `[Ticket #${ticket.id}] New Ticket Created: ${ticket.subject}`,
        `A new ticket has been created by ${creator.name} (${creator.email}).\n\nDetails:\n- Priority: ${ticket.priority}\n- Status: ${ticket.status}`,
      );
      break;

    case 'TICKET_ASSIGNED':
      if (event.assigneeId) {
        const assignee = getUserById(event.assigneeId);
        if (assignee) {
          await sendEmail(
            assignee.email,
            `[Ticket #${ticket.id}] You have been assigned a new ticket: ${ticket.subject}`,
            `You have been assigned a new ticket by ${creator.name} (${creator.email}).`,
          );
        }
      }
      break;

    case 'NEW_COMMENT':
      const comments = getCommentsByTicketId(ticket.id);
      const lastComment = comments.find(c => c.id === event.commentId);
      if (!lastComment) return;

      const commenter = getUserById(lastComment.creatorId);

      if (commenter && ticket.creatorId !== lastComment.creatorId) {
        await sendEmail(
          creator.email,
          `[Ticket #${ticket.id}] New comment from ${commenter.name}: ${ticket.subject}`,
          `A new comment was added by ${commenter.name} (${commenter.email}).`,
        );
      }
      break;
  }
}

async function handleExternalNotification(event: NotificationEvent) {
  const ticket = getTicketById(event.ticketId);
  if (!ticket) return;

  const message = `[Ticket #${ticket.id}] ${event.type}: ${ticket.subject}`;

  await sendToSlack('general', message);
  await sendToTelegram('12345', message);
}

export async function sendNotification(event: NotificationEvent) {
  console.log(`[Notification] Event received: ${event.type}`);
  await handleEmailNotification(event);
  await handleExternalNotification(event);
}
