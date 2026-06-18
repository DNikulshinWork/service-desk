import type { FastifyError, FastifyReply } from 'fastify';

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

  if (isValidationError(error)) {
    return reply.code(400).send({ message: error.message });
  }

  if (error instanceof Error) {
    return reply.code(500).send({ message: error.message });
  }

  return reply.code(500).send({ message: 'Internal Server Error' });
}

function isValidationError(error: unknown): error is FastifyError {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'FST_ERR_VALIDATION'
  );
}
