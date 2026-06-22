
import { type Ticket } from './auth.js';

type SlaStatus = 'Pending' | 'Met' | 'Breached';

export interface TicketWithSla extends Ticket {
  responseSlaStatus: SlaStatus;
  resolveSlaStatus: SlaStatus;
}

export function getTicketWithSlaStatus(ticket: Ticket): TicketWithSla {
  let responseSlaStatus: SlaStatus = 'Pending';
  if (ticket.responseDue) {
    if (ticket.firstRespondedAt) {
      responseSlaStatus = ticket.firstRespondedAt <= ticket.responseDue ? 'Met' : 'Breached';
    } else if (Date.now() > ticket.responseDue) {
      responseSlaStatus = 'Breached';
    }
  }

  let resolveSlaStatus: SlaStatus = 'Pending';
  if (ticket.resolveDue) {
    if (ticket.closedAt) {
      resolveSlaStatus = ticket.closedAt <= ticket.resolveDue ? 'Met' : 'Breached';
    } else if (Date.now() > ticket.resolveDue) {
      resolveSlaStatus = 'Breached';
    }
  }

  return {
    ...ticket,
    responseSlaStatus,
    resolveSlaStatus,
  };
}
