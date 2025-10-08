import { Injectable, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'
import morgan from 'morgan'

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger: any

  constructor() {
    // Create custom morgan format with module name, API URL, method, status code and response time
    morgan.token('module-name', (req: Request) => {
      const url = req.originalUrl || req.url
      // Extract module name from URL (e.g., /api/property -> property)
      const match = url.match(/^\/api\/([^/?]+)/)
      return match ? match[1] : 'root'
    })

    // Custom format: [Module] Method URL StatusCode ResponseTime
    const customFormat =
      ':method :url :status :response-time ms - Module: :module-name'

    // Initialize morgan with custom format
    this.logger = morgan(customFormat, {
      stream: {
        write: (message: string) => {
          // Remove trailing newline and log
          console.log(message.trim())
        }
      }
    })
  }

  use(req: Request, res: Response, next: NextFunction) {
    this.logger(req, res, next)
  }
}
