import { BadRequestException } from '@nestjs/common'
import { AttachmentUrlDto } from './email.dto'

/**
 * `POST /email/send` is reachable without a token so the help page can reach support. That makes
 * two things the caller must not control when unauthenticated:
 *
 * - the recipient, or the endpoint is an open relay sending mail as us to anyone;
 * - the attachment host, or the server fetches a URL of the caller's choosing and mails back the
 *   response, which reaches anything the server can reach that the caller cannot.
 */
export function resolveRecipients(
  requested: string[],
  isAuthenticated: boolean,
  supportInbox: string
): string[] {
  const deduped = [
    ...new Set((requested ?? []).map(to => to?.trim()).filter(Boolean))
  ]

  if (isAuthenticated) return deduped

  if (!supportInbox) {
    throw new BadRequestException(
      'Support inbox is not configured on this server'
    )
  }

  return [supportInbox]
}

/** Attachment URLs must live on our own upload bucket, for anonymous and signed-in callers alike. */
export function assertAttachmentUrlsAllowed(
  urls: AttachmentUrlDto[] | undefined,
  bucketUrl: string | undefined
): void {
  if (!urls?.length) return

  let allowedHost: string
  try {
    allowedHost = new URL(bucketUrl ?? '').host
  } catch {
    throw new BadRequestException(
      'Attachment URLs are not accepted: the upload bucket is not configured'
    )
  }

  for (const { url } of urls) {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new BadRequestException(`Attachment URL is not a valid URL: ${url}`)
    }

    if (parsed.protocol !== 'https:' || parsed.host !== allowedHost) {
      throw new BadRequestException(
        `Attachments must be uploaded to ${allowedHost} first; refusing to fetch ${parsed.host}`
      )
    }
  }
}
