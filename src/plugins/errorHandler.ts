import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { ZodError } from 'zod'

const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error)

    // Zod validation errors thrown directly
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      })
    }

    // Validation errors from safeParse in routes
    if ((error as any).validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: (error as any).validation.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      })
    }

    // Our custom thrown errors → throw { statusCode: 409, message: '...' }
    const err = error as any
    if (err.statusCode && err.message) {
      return reply.status(err.statusCode).send({
        success: false,
        error: {
          code: getErrorCode(err.statusCode),
          message: err.message,
        },
      })
    }

    // Unexpected errors
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong',
      },
    })
  })
}

const getErrorCode = (statusCode: number): string => {
  const codes: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
  }
  return codes[statusCode] || 'INTERNAL_SERVER_ERROR'
}

export default fp(errorHandlerPlugin)