import { BadRequestException, PayloadTooLargeException } from '@nestjs/common'

/** Anonymous uploads exist only to attach a file to a help-page message. */
export const ANONYMOUS_UPLOAD_PREFIX = 'support'
export const ANONYMOUS_MAX_BYTES = 10 * 1024 * 1024
export const ANONYMOUS_ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]

/**
 * Signed-in users upload through the app's own flows; an anonymous caller is a stranger with our
 * bucket, so cap what they can put in it and keep it in one prefix that can be expired separately.
 */
export function assertAnonymousUploadAllowed(file: Express.Multer.File): void {
  if (!file) {
    throw new BadRequestException('No file provided')
  }

  if (file.size > ANONYMOUS_MAX_BYTES) {
    throw new PayloadTooLargeException(
      `Attachments are limited to ${ANONYMOUS_MAX_BYTES / (1024 * 1024)} MB`
    )
  }

  if (!ANONYMOUS_ALLOWED_MIME.includes(file.mimetype)) {
    throw new BadRequestException(
      `Attachments of type ${file.mimetype} are not accepted`
    )
  }
}
