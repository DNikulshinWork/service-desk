
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  comparePassword,
  createAttachment,
  createComment,
  createCompany,
  createTicket,
  createUser,
  deleteRefreshToken,
  deleteTicket,
  getAllCompanies,
  getAllTickets,
  getAllUsers,
  getAttachmentsByTicketId,
  getCommentsByTicketId,
  getCompanyById,
  getCompanyUsers,
  getRefreshToken,
  getTicketById,
  getUserByEmail,
  getUserById,
  requireRole as requireRoleHelper,
  serializeUser,
  setRefreshToken,
  signAccessToken,
  signRefreshToken,
  updateTicket,
  verifyAccessToken,
  verifyRefreshToken,
} from './auth.js';
import { AppError, errorHandler } from './errors.js';
import {
  companyInputSchema,
  loginInputSchema,
  registerInputSchema,
  updateProfileInputSchema,
} from '@service-desk/shared';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    role: string;
  };
}

const app = Fastify({
  logger: false,
});

app.setErrorHandler(errorHandler);

await app.register(cookie);
await app.register(multipart);

await app.register(swagger, {
  swagger: {
    info: {
      title: 'Service Desk API',
      description: 'API for Service Desk',
      version: '1.0.0',
    },
    externalDocs: {
      url: 'https://swagger.io',
      description: 'Find more info here',
    },
    host: 'localhost:3000',
    schemes: ['http'],
    consumes: ['application/json', 'multipart/form-data'],
    produces: ['application/json'],
  },
});

await app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: true,
  },
  uiHooks: {
    onRequest: function (request, reply, next) { next() },
    preHandler: function (request, reply, next) { next() },
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
});

const authenticate = async (request: AuthenticatedRequest, reply: any) => {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'Unauthorized');
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = verifyAccessToken(token);
    request.user = {
      id: payload.sub,
      role: payload.role,
    };
  } catch {
    throw new AppError(401, 'Unauthorized');
  }
};

const requireRole = (role: string) => {
  return async (request: AuthenticatedRequest) => {
    if (!request.user || (request.user.role !== role && request.user.role !== 'ADMIN')) {
      throw new AppError(403, 'Forbidden');
    }
  };
};

app.get(
  '/health',
  {
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['ok'] },
          },
        },
      },
    },
  },
  async () => ({
    status: 'ok',
  }),
);

app.post(
  '/api/v1/auth/register',
  {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          name: { type: 'string', minLength: 1 },
        },
      },
      response: {
        201: {
          type: 'object',
          required: ['user'],
          properties: {
            user: {
              type: 'object',
              required: ['id', 'email', 'name', 'role'],
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  async (request, reply) => {
    try {
      const { email, password, name } = registerInputSchema.parse(request.body);

      if (getUserByEmail(email)) {
        throw new AppError(409, 'Email already exists');
      }

      const user = createUser(email, password, name);
      return reply.code(201).send({
        user: serializeUser(user),
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(400, error.errors.map((item) => item.message).join(', '));
      }
      throw error;
    }
  },
);

app.post(
  '/api/v1/auth/login',
  {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
      response: {
        200: {
          type: 'object',
          required: ['accessToken', 'user'],
          properties: {
            accessToken: { type: 'string' },
            user: {
              type: 'object',
              required: ['id', 'email', 'name', 'role'],
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  async (request, reply) => {
    try {
      const { email, password } = loginInputSchema.parse(request.body);

      const user = getUserByEmail(email);
      if (!user || !(await comparePassword(password, user.passwordHash))) {
        throw new AppError(401, 'Invalid credentials');
      }

      const accessToken = signAccessToken(user.id, user.role);
      const refreshToken = signRefreshToken(user.id);

      setRefreshToken(user.id, refreshToken);

      reply.setCookie('refresh_token', refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });

      return reply.send({
        accessToken,
        user: serializeUser(user),
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(400, error.errors.map((item) => item.message).join(', '));
      }
      throw error;
    }
  },
);

app.post(
  '/api/v1/auth/refresh',
  {
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['accessToken', 'user'],
          properties: {
            accessToken: { type: 'string' },
            user: {
              type: 'object',
              required: ['id', 'email', 'name', 'role'],
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
        401: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  },
  async (request, reply) => {
  const refreshToken = request.cookies.refresh_token as string | undefined;
  if (!refreshToken) {
    return reply.code(401).send({ message: 'Missing refresh token' });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = getUserById(payload.sub);
    const storedToken = getRefreshToken(payload.sub);

    if (!user || storedToken !== refreshToken) {
      return reply.code(401).send({ message: 'Invalid refresh token' });
    }

    const newAccessToken = signAccessToken(user.id, user.role);
    const newRefreshToken = signRefreshToken(user.id);

    setRefreshToken(user.id, newRefreshToken);
    reply.setCookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    return reply.send({
      accessToken: newAccessToken,
      user: serializeUser(user),
    });
  } catch {
    return reply.code(401).send({ message: 'Invalid refresh token' });
  }
});

app.post(
  '/api/v1/auth/logout',
  {
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['ok'],
          properties: {
            ok: { type: 'boolean' },
          },
        },
      },
    },
  },
  async (request, reply) => {
  const refreshToken = request.cookies.refresh_token as string | undefined;
  if (!refreshToken) {
    return reply.clearCookie('refresh_token').code(200).send({ ok: true });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    deleteRefreshToken(payload.sub);
  } catch {
    // ignore invalid token
  }

  return reply.clearCookie('refresh_token').send({ ok: true });
});

app.get(
  '/api/v1/users/me',
  {
    preHandler: authenticate,
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['user'],
          properties: {
            user: {
              type: 'object',
              required: ['id', 'email', 'name', 'role'],
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  async (request: AuthenticatedRequest, reply) => {
  const userPayload = request.user;
  if (!userPayload) {
    return reply.code(401).send({ message: 'Unauthorized' });
  }

  const user = getUserById(userPayload.id);
  if (!user) {
    return reply.code(401).send({ message: 'Unauthorized' });
  }

  return reply.send({
    user: serializeUser(user),
  });
});

app.patch(
  '/api/v1/users/me',
  {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
        },
      },
      response: {
        200: {
          type: 'object',
          required: ['user'],
          properties: {
            user: {
              type: 'object',
              required: ['id', 'email', 'name', 'role'],
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  async (request: AuthenticatedRequest, reply) => {
  const userPayload = request.user;
  if (!userPayload) {
    throw new AppError(401, 'Unauthorized');
  }

  const user = getUserById(userPayload.id);
  if (!user) {
    throw new AppError(401, 'Unauthorized');
  }

  try {
    const payload = updateProfileInputSchema.parse(request.body);
    user.name = payload.name || user.name;

    return reply.send({
      user: serializeUser(user),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(400, error.errors.map((item) => item.message).join(', '));
    }
    throw error;
  }
});

app.post(
  '/api/v1/companies',
  {
    preHandler: [authenticate, requireRole('USER')],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          domain: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          required: ['company'],
          properties: {
            company: {
              type: 'object',
              required: ['id', 'name', 'ownerId'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                domain: { type: 'string' },
                ownerId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  async (request: AuthenticatedRequest, reply) => {
    const userPayload = request.user;
    if (!userPayload) {
      throw new AppError(401, 'Unauthorized');
    }

    try {
      const payload = companyInputSchema.parse(request.body);
      const company = createCompany(payload.name, payload.domain, userPayload.id);

      return reply.code(201).send({
        company,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(400, error.errors.map((item) => item.message).join(', '));
      }
      throw error;
    }
  },
);

app.post(
  '/api/v1/tickets',
  {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['subject', 'description', 'priority'],
        properties: {
          subject: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          priority: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          required: ['ticket'],
          properties: {
            ticket: {
              type: 'object',
              required: ['id', 'subject', 'description', 'priority', 'status', 'creatorId'],
              properties: {
                id: { type: 'string' },
                subject: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string' },
                status: { type: 'string' },
                creatorId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  async (request: AuthenticatedRequest, reply) => {
    const userPayload = request.user;
    if (!userPayload) {
      throw new AppError(401, 'Unauthorized');
    }

    const payload = request.body as {
      subject: string;
      description: string;
      priority: string;
    };

    const ticket = createTicket(
      payload.subject,
      payload.description,
      payload.priority,
      userPayload.id,
    );

    return reply.code(201).send({
      ticket,
    });
  },
);

app.get(
  '/api/v1/tickets',
  {
    preHandler: authenticate,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          priority: { type: 'string' },
          sortBy: { type: 'string' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] },
          page: { type: 'number' },
          limit: { type: 'number' },
        },
      },
      response: {
        200: {
          type: 'object',
          required: ['tickets'],
          properties: {
            tickets: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'subject', 'description', 'priority', 'status', 'creatorId'],
                properties: {
                  id: { type: 'string' },
                  subject: { type: 'string' },
                  description: { type: 'string' },
                  priority: { type: 'string' },
                  status: { type: 'string' },
                  creatorId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  async (request: AuthenticatedRequest, reply) => {
    const userPayload = request.user;
    if (!userPayload) {
      throw new AppError(401, 'Unauthorized');
    }

    const { status, priority, sortBy, sortOrder, page, limit } = request.query as {
      status?: string;
      priority?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    };

    const options: Parameters<typeof getAllTickets>[0] = {
      status,
      priority,
      sortBy,
      sortOrder,
      page,
      limit,
    };

    if (userPayload.role !== 'ADMIN') {
      options.creatorId = userPayload.id;
    }

    const tickets = getAllTickets(options);

    return reply.send({
      tickets,
    });
  },
);

app.get(
  '/api/v1/tickets/:id',
  {
    preHandler: authenticate,
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          required: ['ticket'],
          properties: {
            ticket: {
              type: 'object',
              required: ['id', 'subject', 'description', 'priority', 'status', 'creatorId'],
              properties: {
                id: { type: 'string' },
                subject: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string' },
                status: { type: 'string' },
                creatorId: { type: 'string' },
                assigneeId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  async (request: AuthenticatedRequest, reply) => {
    const userPayload = request.user;
    if (!userPayload) {
      throw new AppError(401, 'Unauthorized');
    }

    const params = request.params as { id: string };
    const ticket = getTicketById(params.id);

    if (!ticket) {
      throw new AppError(404, 'Ticket not found');
    }

    if (ticket.creatorId !== userPayload.id && userPayload.role !== 'ADMIN') {
      throw new AppError(403, 'Forbidden');
    }

    return reply.send({
      ticket,
    });
  },
);

app.put(
  '/api/v1/tickets/:id',
  {
    preHandler: authenticate,
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          subject: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          priority: { type: 'string' },
          status: { type: 'string' },
          assigneeId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          required: ['ticket'],
          properties: {
            ticket: {
              type: 'object',
              required: ['id', 'subject', 'description', 'priority', 'status', 'creatorId'],
              properties: {
                id: { type: 'string' },
                subject: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string' },
                status: { type: 'string' },
                creatorId: { type: 'string' },
                assigneeId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  async (request: AuthenticatedRequest, reply) => {
    const userPayload = request.user;
    if (!userPayload) {
      throw new AppError(401, 'Unauthorized');
    }

    const params = request.params as { id: string };
    const ticket = getTicketById(params.id);

    if (!ticket) {
      throw new AppError(404, 'Ticket not found');
    }

    if (ticket.creatorId !== userPayload.id && userPayload.role !== 'ADMIN') {
      throw new AppError(403, 'Forbidden');
    }

    const payload = request.body as {
      subject?: string;
      description?: string;
      priority?: string;
      status?: string;
      assigneeId?: string;
    };

    const updatedTicket = updateTicket(params.id, payload);
    if (!updatedTicket) {
      throw new AppError(404, 'Ticket not found');
    }

    return reply.send({
      ticket: updatedTicket,
    });
  },
);

app.delete(
  '/api/v1/tickets/:id',
  {
    preHandler: authenticate,
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        204: {
          type: 'object',
        },
      },
    },
  },
  async (request: AuthenticatedRequest, reply) => {
    const userPayload = request.user;
    if (!userPayload) {
      throw new AppError(401, 'Unauthorized');
    }

    const params = request.params as { id: string };
    const ticket = getTicketById(params.id);

    if (!ticket) {
      throw new AppError(404, 'Ticket not found');
    }

    if (ticket.creatorId !== userPayload.id && userPayload.role !== 'ADMIN') {
      throw new AppError(403, 'Forbidden');
    }

    deleteTicket(params.id);

    return reply.code(204).send();
  },
);

app.post(
  '/api/v1/tickets/:id/comments',
  {
    preHandler: authenticate,
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string', minLength: 1 },
        },
      },
      response: {
        201: {
          type: 'object',
          required: ['comment'],
          properties: {
            comment: {
              type: 'object',
              required: ['id', 'text', 'ticketId', 'creatorId'],
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                ticketId: { type: 'string' },
                creatorId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  async (request: AuthenticatedRequest, reply) => {
    const userPayload = request.user;
    if (!userPayload) {
      throw new AppError(401, 'Unauthorized');
    }

    const params = request.params as { id: string };
    const ticket = getTicketById(params.id);

    if (!ticket) {
      throw new AppError(404, 'Ticket not found');
    }

    if (ticket.creatorId !== userPayload.id && userPayload.role !== 'ADMIN') {
      throw new AppError(403, 'Forbidden');
    }

    const payload = request.body as {
      text: string;
    };

    const comment = createComment(payload.text, params.id, userPayload.id);

    return reply.code(201).send({
      comment,
    });
  },
);

app.get(
  '/api/v1/tickets/:id/comments',
  {
    preHandler: authenticate,
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          required: ['comments'],
          properties: {
            comments: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'text', 'ticketId', 'creatorId'],
                properties: {
                  id: { type: 'string' },
                  text: { type: 'string' },
                  ticketId: { type: 'string' },
                  creatorId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  async (request: AuthenticatedRequest, reply) => {
    const userPayload = request.user;
    if (!userPayload) {
      throw new AppError(401, 'Unauthorized');
    }

    const params = request.params as { id: string };
    const ticket = getTicketById(params.id);

    if (!ticket) {
      throw new AppError(404, 'Ticket not found');
    }

    if (ticket.creatorId !== userPayload.id && userPayload.role !== 'ADMIN') {
      throw new AppError(403, 'Forbidden');
    }

    const comments = getCommentsByTicketId(params.id);

    return reply.send({
      comments,
    });
  },
);

app.post(
  '/api/v1/tickets/:id/attachments',
  {
    preHandler: authenticate,
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      consumes: ['multipart/form-data'],
      response: {
        201: {
          type: 'object',
          required: ['attachment'],
          properties: {
            attachment: {
              type: 'object',
              required: ['id', 'filename', 'mimetype', 'ticketId', 'creatorId'],
              properties: {
                id: { type: 'string' },
                filename: { type: 'string' },
                mimetype: { type: 'string' },
                ticketId: { type: 'string' },
                creatorId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  async (request: AuthenticatedRequest, reply) => {
    const userPayload = request.user;
    if (!userPayload) {
      throw new AppError(401, 'Unauthorized');
    }

    const params = request.params as { id: string };
    const ticket = getTicketById(params.id);

    if (!ticket) {
      throw new AppError(404, 'Ticket not found');
    }

    if (ticket.creatorId !== userPayload.id && userPayload.role !== 'ADMIN') {
      throw new AppError(403, 'Forbidden');
    }

    const data = await request.file();

    if (!data) {
      throw new AppError(400, 'No file uploaded');
    }

    // In a real application, you would stream the file to a storage service (e.g., MinIO, S3)
    // For this example, we'll just use the metadata.

    const attachment = createAttachment(
      data.filename,
      data.mimetype,
      params.id,
      userPayload.id,
    );

    return reply.code(201).send({ attachment });
  },
);

app.get(
  '/api/v1/tickets/:id/attachments',
  {
    preHandler: authenticate,
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          required: ['attachments'],
          properties: {
            attachments: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'filename', 'mimetype', 'ticketId', 'creatorId'],
                properties: {
                  id: { type: 'string' },
                  filename: { type: 'string' },
                  mimetype: { type: 'string' },
                  ticketId: { type: 'string' },
                  creatorId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  async (request: AuthenticatedRequest, reply) => {
    const userPayload = request.user;
    if (!userPayload) {
      throw new AppError(401, 'Unauthorized');
    }

    const params = request.params as { id: string };
    const ticket = getTicketById(params.id);

    if (!ticket) {
      throw new AppError(404, 'Ticket not found');
    }

    if (ticket.creatorId !== userPayload.id && userPayload.role !== 'ADMIN') {
      throw new AppError(403, 'Forbidden');
    }

    const attachments = getAttachmentsByTicketId(params.id);

    return reply.send({ attachments });
  },
);

app.get(
  '/api/v1/companies',
  {
    preHandler: authenticate,
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['companies'],
          properties: {
            companies: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'name', 'ownerId'],
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  domain: { type: 'string' },
                  ownerId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  async (request: AuthenticatedRequest, reply) => {
  const userPayload = request.user;
  if (!userPayload) {
    return reply.code(401).send({ message: 'Unauthorized' });
  }

  const companies = getAllCompanies().filter((company) => company.ownerId === userPayload.id);

  return reply.send({
    companies,
  });
});

app.get(
  '/api/v1/companies/:id/users',
  {
    preHandler: authenticate,
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          required: ['company', 'users'],
          properties: {
            company: {
              type: 'object',
              required: ['id', 'name', 'ownerId'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                domain: { type: 'string' },
                ownerId: { type: 'string' },
              },
            },
            users: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'email', 'name', 'role'],
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  async (request: AuthenticatedRequest, reply) => {
  const userPayload = request.user;
  if (!userPayload) {
    return reply.code(401).send({ message: 'Unauthorized' });
  }

  const params = request.params as { id: string };
  const company = getCompanyById(params.id);
  if (!company) {
    return reply.code(404).send({ message: 'Company not found' });
  }

  if (company.ownerId !== userPayload.id) {
    return reply.code(403).send({ message: 'Forbidden' });
  }

  return reply.send({
    company,
    users: getCompanyUsers(company.id),
  });
});

app.get(
  '/api/v1/admin/users',
  {
    preHandler: [authenticate, requireRole('ADMIN')],
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['users'],
          properties: {
            users: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'email', 'name', 'role'],
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  async (_request: AuthenticatedRequest, reply) => {
  return reply.send({
    users: getAllUsers().map(serializeUser),
  });
});

app.get(
  '/api/v1/auth/oauth/:provider',
  {
    schema: {
      params: {
        type: 'object',
        required: ['provider'],
        properties: {
          provider: { type: 'string' },
        },
      },
      response: {
        302: {
          type: 'object',
        },
      },
    },
  },
  async (request, reply) => {
  const params = request.params as { provider: string };
  const provider = params.provider;

  if (!['github', 'google'].includes(provider)) {
    throw new AppError(400, 'Unsupported provider');
  }

  const providerUrl = provider === 'github'
    ? 'https://github.com/login/oauth/authorize'
    : 'https://accounts.google.com/o/oauth2/v2/auth';

  return reply.redirect(providerUrl);
});

app.get(
  '/api/v1/auth/oauth/:provider/callback',
  {
    schema: {
      params: {
        type: 'object',
        required: ['provider'],
        properties: {
          provider: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          required: ['ok', 'provider'],
          properties: {
            ok: { type: 'boolean' },
            provider: { type: 'string' },
          },
        },
      },
    },
  },
  async (request, reply) => {
  const params = request.params as { provider: string };
  if (!['github', 'google'].includes(params.provider)) {
    throw new AppError(400, 'Unsupported provider');
  }

  return reply.send({
    ok: true,
    provider: params.provider,
  });
});

export async function buildApp() {
  await app.ready();
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 3000);
  app.listen({ port, host: '0.0.0.0' }).then(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Server is running at http://localhost:${port}`);
      console.log(`Swagger documentation is available at http://localhost:${port}/docs`);
    }
  }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
