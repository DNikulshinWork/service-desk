
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

const users = new Map<string, {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: string;
}>();

const refreshTokens = new Map<string, string>();
const companies = new Map<string, {
  id: string;
  name: string;
  domain?: string;
  ownerId: string;
}>();

const tickets = new Map<string, {
  id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  creatorId: string;
  assigneeId?: string;
}>();

const comments = new Map<string, {
  id: string;
  text: string;
  ticketId: string;
  creatorId: string;
}>();

const attachments = new Map<string, {
  id: string;
  filename: string;
  mimetype: string;
  ticketId: string;
  creatorId: string;
}>();

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(userId: string, role: string) {
  return jwt.sign(
    { sub: userId, role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '15m' },
  );
}

export function signRefreshToken(userId: string) {
  return jwt.sign(
    { sub: userId },
    process.env.REFRESH_SECRET || 'test-refresh-secret',
    { expiresIn: '7d' },
  );
}

export function createUser(email: string, password: string, name: string) {
  const id = randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = {
    id,
    email,
    passwordHash,
    name,
    role: 'USER',
  };

  users.set(email, user);
  return user;
}

export function getUserByEmail(email: string) {
  return users.get(email);
}

export function getUserById(id: string) {
  return Array.from(users.values()).find((user) => user.id === id);
}

export function getAllUsers() {
  return Array.from(users.values());
}

export function createTicket(
  subject: string,
  description: string,
  priority: string,
  creatorId: string,
) {
  const id = randomUUID();
  const ticket = {
    id,
    subject,
    description,
    priority,
    status: 'OPEN',
    creatorId,
  };

  tickets.set(id, ticket);
  return ticket;
}

export function getTicketById(id: string) {
  return tickets.get(id);
}

export function updateTicket(
  id: string,
  updates: Partial<{
    subject: string;
    description: string;
    priority: string;
    status: string;
    assigneeId?: string;
  }>,
) {
  const current = tickets.get(id);
  if (!current) {
    return undefined;
  }

  const updated = {
    ...current,
    ...updates,
  };

  tickets.set(id, updated);
  return updated;
}

export function deleteTicket(id: string) {
  tickets.delete(id);
}

export function getAllTickets() {
  return Array.from(tickets.values());
}

export function createComment(
  text: string,
  ticketId: string,
  creatorId: string,
) {
  const id = randomUUID();
  const comment = {
    id,
    text,
    ticketId,
    creatorId,
  };

  comments.set(id, comment);
  return comment;
}

export function getCommentsByTicketId(ticketId: string) {
  return Array.from(comments.values()).filter(
    (comment) => comment.ticketId === ticketId,
  );
}

export function createAttachment(
  filename: string,
  mimetype: string,
  ticketId: string,
  creatorId: string,
) {
  const id = randomUUID();
  const attachment = {
    id,
    filename,
    mimetype,
    ticketId,
    creatorId,
  };

  attachments.set(id, attachment);
  return attachment;
}

export function getAttachmentsByTicketId(ticketId: string) {
  return Array.from(attachments.values()).filter(
    (attachment) => attachment.ticketId === ticketId,
  );
}

export function setRefreshToken(userId: string, token: string) {
  refreshTokens.set(userId, token);
}

export function getRefreshToken(userId: string) {
  return refreshTokens.get(userId);
}

export function deleteRefreshToken(userId: string) {
  refreshTokens.delete(userId);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET || 'test-secret') as {
    sub: string;
    role: string;
  };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, process.env.REFRESH_SECRET || 'test-refresh-secret') as {
    sub: string;
  };
}

export function serializeUser(user: { id: string; email: string; name: string; role: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export function createCompany(name: string, domain: string | undefined, ownerId: string) {
  const id = randomUUID();
  const company = {
    id,
    name,
    domain,
    ownerId,
  };

  companies.set(id, company);
  return company;
}

export function getAllCompanies() {
  return Array.from(companies.values());
}

export function getCompanyById(id: string) {
  return companies.get(id);
}

export function getCompanyUsers(companyId: string) {
  const company = getCompanyById(companyId);
  if (!company) {
    return [];
  }

  return Array.from(users.values()).filter((user) => user.id === company.ownerId);
}

export function requireRole(role: string, userRole: string) {
  return userRole === role || userRole === 'ADMIN';
}
