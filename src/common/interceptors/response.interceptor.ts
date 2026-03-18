import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { formatErrorStringIfNeeded } from '../utils/error-formatter.util'

/** Recursively transforms raw DB/Prisma error strings into user-friendly messages. */
function sanitizeErrorStringsInResponse(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return formatErrorStringIfNeeded(obj)
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeErrorStringsInResponse)
  }
  if (obj instanceof Date) {
    return obj
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeErrorStringsInResponse(value)
    }
    return result
  }
  return obj
}

export interface Response<T> {
  success: boolean
  message: string
  data?: T
  metadata?: any
  error?: string[]
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data: unknown) => {
        if (data && typeof data === 'object' && 'success' in data) {
          return sanitizeErrorStringsInResponse(data) as Response<T>
        }

        if (data && typeof data === 'object' && 'data' in data) {
          const responseData = data as {
            message?: string
            data: T
            metadata?: unknown
          }
          const sanitizedData = sanitizeErrorStringsInResponse(
            responseData.data
          ) as T
          return {
            success: true,
            message: responseData.message || 'Operation successful',
            data: sanitizedData,
            metadata: responseData.metadata
          }
        }

        // Handle responses that only contain a message (e.g., delete, activate, deactivate operations)
        if (
          data &&
          typeof data === 'object' &&
          'message' in data &&
          Object.keys(data).length <= 2
        ) {
          const messageData = data as { message: string; pending_action?: unknown }
          return {
            success: true,
            message: formatErrorStringIfNeeded(messageData.message),
            data: messageData.pending_action
              ? (sanitizeErrorStringsInResponse(data) as T)
              : undefined
          }
        }

        return {
          success: true,
          message: 'Operation successful',
          data: sanitizeErrorStringsInResponse(data) as T
        }
      })
    )
  }
}
