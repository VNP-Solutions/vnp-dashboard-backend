import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common'
import { Response } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'
    let errors: string[] = []

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse
        errors = [exceptionResponse]
      } else if (typeof exceptionResponse === 'object') {
        const errorObj = exceptionResponse as Record<string, unknown>
        message =
          (errorObj.message as string) ||
          exception.message ||
          'An error occurred'

        if (Array.isArray(errorObj.message)) {
          errors = errorObj.message as string[]
        } else if (typeof errorObj.message === 'string') {
          errors = [errorObj.message]
        } else {
          errors = [message]
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message
      errors = [exception.message]
    }

    response.status(status).json({
      success: false,
      message,
      error: errors,
      data: null
    })
  }
}
