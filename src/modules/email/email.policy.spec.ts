import { BadRequestException } from '@nestjs/common'
import { assertAttachmentUrlsAllowed, resolveRecipients } from './email.policy'

const BUCKET = 'https://vnp-uploads.s3.amazonaws.com'
const SUPPORT = 'support@vnpsolutions.com'

describe('resolveRecipients', () => {
  it('ignores the recipients an anonymous caller asks for', () => {
    expect(resolveRecipients(['victim@example.com'], false, SUPPORT)).toEqual([
      SUPPORT
    ])
  })

  it('keeps the recipients a signed-in caller asks for', () => {
    expect(
      resolveRecipients(
        ['ops@vnpsolutions.com', 'ops@vnpsolutions.com'],
        true,
        SUPPORT
      )
    ).toEqual(['ops@vnpsolutions.com'])
  })

  it('refuses anonymous sends when no support inbox is configured', () => {
    expect(() => resolveRecipients(['a@b.com'], false, '')).toThrow(
      BadRequestException
    )
  })
})

describe('assertAttachmentUrlsAllowed', () => {
  it('accepts a file on our own bucket', () => {
    expect(() =>
      assertAttachmentUrlsAllowed(
        [{ url: `${BUCKET}/support/report.pdf` }],
        BUCKET
      )
    ).not.toThrow()
  })

  it('refuses the cloud metadata address', () => {
    expect(() =>
      assertAttachmentUrlsAllowed(
        [
          {
            url: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/'
          }
        ],
        BUCKET
      )
    ).toThrow(BadRequestException)
  })

  it('refuses an internal service on localhost', () => {
    expect(() =>
      assertAttachmentUrlsAllowed(
        [{ url: 'http://localhost:5001/api/user' }],
        BUCKET
      )
    ).toThrow(BadRequestException)
  })

  it('refuses a lookalike host', () => {
    expect(() =>
      assertAttachmentUrlsAllowed(
        [{ url: 'https://vnp-uploads.s3.amazonaws.com.evil.test/x.pdf' }],
        BUCKET
      )
    ).toThrow(BadRequestException)
  })

  it('refuses plain http even on the right host', () => {
    expect(() =>
      assertAttachmentUrlsAllowed(
        [{ url: 'http://vnp-uploads.s3.amazonaws.com/support/x.pdf' }],
        BUCKET
      )
    ).toThrow(BadRequestException)
  })

  it('checks every url, not just the first', () => {
    expect(() =>
      assertAttachmentUrlsAllowed(
        [
          { url: `${BUCKET}/support/ok.pdf` },
          { url: 'http://10.0.0.1/secret' }
        ],
        BUCKET
      )
    ).toThrow(BadRequestException)
  })

  it('does nothing when there are no attachments', () => {
    expect(() => assertAttachmentUrlsAllowed(undefined, BUCKET)).not.toThrow()
  })
})
