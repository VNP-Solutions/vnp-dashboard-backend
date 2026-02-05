import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments
} from 'class-validator'

/**
 * Validates that a string contains one or more valid email addresses separated by commas
 * @param validationOptions - Additional validation options
 */
export function IsCommaSeparatedEmails(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isCommaSeparatedEmails',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!value || typeof value !== 'string') {
            return false
          }

          // Split by comma and trim whitespace
          const emails = value.split(',').map(email => email.trim())

          // Check if there's at least one email
          if (emails.length === 0) {
            return false
          }

          // Email regex pattern (RFC 5322 simplified)
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

          // Validate each email
          for (const email of emails) {
            if (!email || !emailRegex.test(email)) {
              return false
            }
          }

          return true
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must contain one or more valid email addresses separated by commas`
        }
      }
    })
  }
}

/**
 * Helper function to split and normalize comma-separated emails
 * @param emails - Comma-separated email string
 * @returns Array of trimmed email addresses
 */
export function splitEmails(emails: string | null | undefined): string[] {
  if (!emails) {
    return []
  }

  return emails
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0)
}
