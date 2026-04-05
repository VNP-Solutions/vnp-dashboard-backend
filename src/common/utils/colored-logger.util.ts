/**
 * Colored Logger Utility
 * Provides colored console output for different log levels
 */

export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  WARN = 'WARN'
}

export class ColoredLogger {
  private context: string

  constructor(context: string) {
    this.context = context
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    colorCode: string
  ): void {
    const timestamp = new Date().toISOString()
    const reset = '\x1b[0m'
    const formattedMessage = `${colorCode}[${timestamp}] [${level}] [${this.context}] ${message}${reset}\n`
    process.stdout.write(formattedMessage)
  }

  info(message: string): void {
    this.formatMessage(LogLevel.INFO, message, '\x1b[36m') // Cyan
  }

  success(message: string): void {
    this.formatMessage(LogLevel.SUCCESS, message, '\x1b[32m') // Green
  }

  error(message: string): void {
    this.formatMessage(LogLevel.ERROR, message, '\x1b[31m') // Red
  }

  warn(message: string): void {
    this.formatMessage(LogLevel.WARN, message, '\x1b[33m') // Yellow
  }

  /**
   * Log data in table format for better readability
   */
  table(headers: string[], rows: string[][]): void {
    const timestamp = new Date().toISOString()
    const cyan = '\x1b[36m'
    const reset = '\x1b[0m'

    process.stdout.write(
      `${cyan}[${timestamp}] [INFO] [${this.context}] Data Table:${reset}\n`
    )

    // Calculate column widths
    const colWidths = headers.map((header, i) => {
      const maxRowValue = Math.max(...rows.map((row) => (row[i] || '').length))
      return Math.max(header.length, maxRowValue) + 2
    })

    // Print headers
    const headerRow = headers
      .map((header, i) => header.padEnd(colWidths[i]))
      .join(' | ')
    process.stdout.write(`${cyan}${headerRow}${reset}\n`)
    process.stdout.write(
      `${cyan}${'-'.repeat(headerRow.length)}${reset}\n`
    )

    // Print rows
    rows.forEach((row) => {
      const formattedRow = row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join(' | ')
      process.stdout.write(`${formattedRow}\n`)
    })

    process.stdout.write('\n')
  }
}
