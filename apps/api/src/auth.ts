
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { calculateDeadline } from './deadlines.js';
import { sendNotification } from './notifications.js';
import { getTicketWithSlaStatus } from './sla.js';

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

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  creatorId: string;
  assigneeId?: string;
  createdAt: number;
  responseDue?: number;
  resolveDue?: number;
  closedAt?: number;
  firstRespondedAt?: number;
}

const tickets = new Map<string, Ticket>();

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

const articles = new Map<string, {
  id: string;
  title: string;
  content: string;
  creatorId: string;
  createdAt: number;
  categoryId?: string;
  status: 'DRAFT' | 'PUBLISHED';
}>();

const categories = new Map<string, { id: string; name: string }>();

const articleFeedbacks = new Map<string, {
  id: string;
  articleId: string;
  userId: string;
  vote: 'HELPFUL' | 'NOT_HELPFUL';
}>();

const slaPolicies = new Map<string, {
  id: string;
  name: string;
  priority: string;
  responseTime: number; // in hours
  resolveTime: number; // in hours
}>();

const workingCalendars = new Map<string, {
  id: string;
  name: string;
  timezone: string;
  workingDays: number[]; // 0=Sunday, 6=Saturday
  workingHours: { start: string; end: string }; // e.g., { start: '09:00', end: '17:00' }
}>();

export function resetInMemoryDb() {
  users.clear();
  refreshTokens.clear();
  companies.clear();
  tickets.clear();
  comments.clear();
  attachments.clear();
  articles.clear();
  categories.clear();
  articleFeedbacks.clear();
  slaPolicies.clear();
  workingCalendars.clear();
}

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

export async function createTicket(
  subject: string,
  description: string,
  priority: string,
  creatorId: string,
) {
  const id = randomUUID();
  const createdAt = Date.now();

  const slaPolicy = Array.from(slaPolicies.values()).find(p => p.priority === priority);
  const calendar = Array.from(workingCalendars.values())[0]; // Assume default calendar

  let responseDue: number | undefined;
  let resolveDue: number | undefined;

  if (slaPolicy && calendar) {
    responseDue = calculateDeadline(createdAt, slaPolicy, calendar, slaPolicy.responseTime);
    resolveDue = calculateDeadline(createdAt, slaPolicy, calendar, slaPolicy.resolveTime);
  }

  const ticket: Ticket = {
    id,
    subject,
    description,
    priority,
    status: 'OPEN',
    creatorId,
    createdAt,
    responseDue,
    resolveDue,
  };

  tickets.set(id, ticket);
  await sendNotification({ type: 'TICKET_CREATED', ticketId: id, creatorId });

  return ticket;
}

export function getTicketById(id: string) {
  const ticket = tickets.get(id);
  if (!ticket) return undefined;
  return getTicketWithSlaStatus(ticket);
}

export async function updateTicket(
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

  const updated: Ticket = {
    ...current,
    ...updates,
  };

  if (updates.status === 'CLOSED' && current.status !== 'CLOSED') {
    updated.closedAt = Date.now();
  }

  if (updates.priority && updates.priority !== current.priority) {
    const slaPolicy = Array.from(slaPolicies.values()).find(p => p.priority === updates.priority);
    const calendar = Array.from(workingCalendars.values())[0];

    if (slaPolicy && calendar) {
      updated.responseDue = calculateDeadline(current.createdAt, slaPolicy, calendar, slaPolicy.responseTime);
      updated.resolveDue = calculateDeadline(current.createdAt, slaPolicy, calendar, slaPolicy.resolveTime);
    }
  }

  if (updates.assigneeId && updates.assigneeId !== current.assigneeId) {
    await sendNotification({ type: 'TICKET_ASSIGNED', ticketId: id, assigneeId: updates.assigneeId });
  }

  tickets.set(id, updated);
  return getTicketWithSlaStatus(updated);
}

export function deleteTicket(id: string) {
  tickets.delete(id);
}

export function getAllTickets(options: {
  status?: string;
  priority?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  creatorId?: string;
} = {}) {
  let allTickets = Array.from(tickets.values());

  if (options.creatorId) {
    allTickets = allTickets.filter((ticket) => ticket.creatorId === options.creatorId);
  }

  if (options.status) {
    allTickets = allTickets.filter((ticket) => ticket.status === options.status);
  }

  if (options.priority) {
    allTickets = allTickets.filter((ticket) => ticket.priority === options.priority);
  }

  if (options.sortBy) {
    allTickets.sort((a, b) => {
      const fieldA = a[options.sortBy as keyof typeof a];
      const fieldB = b[options.sortBy as keyof typeof b];
      if (fieldA < fieldB) {
        return options.sortOrder === 'asc' ? -1 : 1;
      }
      if (fieldA > fieldB) {
        return options.sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  if (options.page && options.limit) {
    const startIndex = (options.page - 1) * options.limit;
    allTickets = allTickets.slice(startIndex, startIndex + options.limit);
  }

  return allTickets.map(getTicketWithSlaStatus);
}

export async function createComment(
  text: string,
  ticketId: string,
  creatorId: string,
) {
  const ticket = tickets.get(ticketId);
  if (ticket && !ticket.firstRespondedAt && ticket.creatorId !== creatorId) {
    ticket.firstRespondedAt = Date.now();
    tickets.set(ticketId, ticket);
  }

  const id = randomUUID();
  const comment = {
    id,
    text,
    ticketId,
    creatorId,
  };

  comments.set(id, comment);
  await sendNotification({ type: 'NEW_COMMENT', ticketId, commentId: id, creatorId });

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

export function createCategory(name: string) {
  const id = randomUUID();
  const category = { id, name };
  categories.set(id, category);
  return category;
}

export function getAllCategories() {
  return Array.from(categories.values());
}

export function createArticle(
  title: string,
  content: string,
  creatorId: string,
  categoryId?: string,
) {
  const id = randomUUID();
  const article = {
    id,
    title,
    content,
    creatorId,
    createdAt: Date.now(),
    categoryId,
    status: 'DRAFT' as const,
  };
  articles.set(id, article);
  return article;
}

export function getArticleById(id: string) {
  return articles.get(id);
}

export function getAllArticles(options: { query?: string; categoryId?: string; role?: string } = {}) {
  let allArticles = Array.from(articles.values());

  if (options.role !== 'ADMIN') {
    allArticles = allArticles.filter((article) => article.status === 'PUBLISHED');
  }

  if (options.query) {
    const lowercasedQuery = options.query.toLowerCase();
    allArticles = allArticles.filter(
      (article) =>
        article.title.toLowerCase().includes(lowercasedQuery) ||
        article.content.toLowerCase().includes(lowercasedQuery),
    );
  }

  if (options.categoryId) {
    allArticles = allArticles.filter((article) => article.categoryId === options.categoryId);
  }

  return allArticles;
}

export function updateArticle(id: string, updates: Partial<{ title: string; content: string; status: 'DRAFT' | 'PUBLISHED' }>) {
  const current = articles.get(id);
  if (!current) {
    return undefined;
  }
  const updated = { ...current, ...updates };
  articles.set(id, updated);
  return updated;
}

export function deleteArticle(id: string) {
  articles.delete(id);
}

export function createArticleFeedback(articleId: string, userId: string, vote: 'HELPFUL' | 'NOT_HELPFUL') {
  const id = randomUUID();
  const feedback = { id, articleId, userId, vote };
  articleFeedbacks.set(id, feedback);
  return feedback;
}

export function getArticleFeedbacks(articleId: string) {
  return Array.from(articleFeedbacks.values()).filter((feedback) => feedback.articleId === articleId);
}

export function createSlaPolicy(name: string, priority: string, responseTime: number, resolveTime: number) {
  const id = randomUUID();
  const policy = { id, name, priority, responseTime, resolveTime };
  slaPolicies.set(id, policy);
  return policy;
}

export function getSlaPolicy(id: string) {
  return slaPolicies.get(id);
}

export function getAllSlaPolicies() {
  return Array.from(slaPolicies.values());
}

export function updateSlaPolicy(id: string, updates: Partial<{ name: string; priority: string; responseTime: number; resolveTime: number }>) {
  const current = slaPolicies.get(id);
  if (!current) {
    return undefined;
  }
  const updated = { ...current, ...updates };
  slaPolicies.set(id, updated);
  return updated;
}

export function deleteSlaPolicy(id: string) {
  slaPolicies.delete(id);
}

export function createWorkingCalendar(name: string, timezone: string, workingDays: number[], workingHours: { start: string; end: string }) {
  const id = randomUUID();
  const calendar = { id, name, timezone, workingDays, workingHours };
  workingCalendars.set(id, calendar);
  return calendar;
}

export function getWorkingCalendar(id: string) {
  return workingCalendars.get(id);
}

export function getAllWorkingCalendars() {
  return Array.from(workingCalendars.values());
}

export function updateWorkingCalendar(id: string, updates: Partial<{ name: string; timezone: string; workingDays: number[]; workingHours: { start: string; end: string } }>) {
  const current = workingCalendars.get(id);
  if (!current) {
    return undefined;
  }
  const updated = { ...current, ...updates };
  workingCalendars.set(id, updated);
  return updated;
}

export function deleteWorkingCalendar(id: string) {
  workingCalendars.delete(id);
}
