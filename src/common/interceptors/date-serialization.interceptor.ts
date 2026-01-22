import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

/**
 * Date Serialization Interceptor
 *
 * Automatically converts all Date objects in API responses to ISO 8601 UTC format.
 * This ensures dates are consistently formatted regardless of the server's or client's timezone.
 *
 * Place this interceptor in app.module.ts or main.ts to apply globally:
 * @UseInterceptors(DateSerializationInterceptor)
 */
@Injectable()
export class DateSerializationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        return this.serializeDates(data)
      })
    )
  }

  /**
   * Recursively serializes all Date objects in the data structure to UTC strings
   */
  private serializeDates(obj: any): any {
    // Handle null/undefined
    if (obj === null || obj === undefined) {
      return obj
    }

    // Handle Date objects
    if (obj instanceof Date) {
      return obj.toISOString()
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item) => this.serializeDates(item))
    }

    // Handle objects
    if (typeof obj === 'object') {
      const serialized: any = {}
      for (const key in obj) {
        // Skip the prototype chain
        if (!Object.prototype.hasOwnProperty.call(obj, key)) {
          continue
        }

        serialized[key] = this.serializeDates(obj[key])
      }
      return serialized
    }

    // Return primitives as-is
    return obj
  }
}
