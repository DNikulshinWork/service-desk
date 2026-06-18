import cookie from '@fastify/cookie';
import Fastify, { type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  comparePassword,
  createCompany,
  createUser,
  deleteRefreshToken,
  getAllCompanies,
  getCompanyById,
  getCompanyUsers,
  getRefreshToken,
  getUserByEmail,
  getUserById,
  requireRole as requireRoleHelper,
  serializeUser,
  setRefreshToken,
  signAccessToken,
  signRefreshToken,
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

app.post('/api/v1/auth/refresh', async (request, reply) => {
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

app.post('/api/v1/auth/logout', async (request, reply) => {
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

app.get('/api/v1/users/me', {
  preHandler: authenticate,
}, async (request: AuthenticatedRequest, reply) => {
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

app.patch('/api/v1/users/me', {
  preHandler: authenticate,
}, async (request: AuthenticatedRequest, reply) => {
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

app.post('/api/v1/companies', {
  preHandler: [authenticate, requireRole('USER')],
}, async (request: AuthenticatedRequest, reply) => {
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
});

app.get('/api/v1/companies', {
  preHandler: authenticate,
}, async (request: AuthenticatedRequest, reply) => {
  const userPayload = request.user;
  if (!userPayload) {
    return reply.code(401).send({ message: 'Unauthorized' });
  }

  const companies = getAllCompanies().filter((company) => company.ownerId === userPayload.id);

  return reply.send({
    companies,
  });
});

app.get('/api/v1/companies/:id/users', {
  preHandler: authenticate,
}, async (request: AuthenticatedRequest, reply) => {
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

export async function buildApp() {
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 3000);
  app.listen({ port, host: '0.0.0.0' }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
