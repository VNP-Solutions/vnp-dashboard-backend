import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

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
          return data as Response<T>
        }

        if (data && typeof data === 'object' && 'data' in data) {
          const responseData = data as {
            message?: string
            data: T
            metadata?: unknown
          }
          return {
            success: true,
            message: responseData.message || 'Operation successful',
            data: responseData.data,
            metadata: responseData.metadata
          }
        }

        return {
          success: true,
          message: 'Operation successful',
          data: data as T
        }
      })
    )
  }
}
