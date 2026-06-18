import type { FastifyReply } from 'fastify';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  error: unknown,
  _request: unknown,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({ message: error.message });
  }

  if (error instanceof Error) {
    return reply.code(500).send({ message: error.message });
  }

  return reply.code(500).send({ message: 'Internal Server Error' });
}
