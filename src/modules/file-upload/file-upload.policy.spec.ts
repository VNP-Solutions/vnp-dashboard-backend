import { BadRequestException, PayloadTooLargeException } from '@nestjs/common'
import {
  ANONYMOUS_MAX_BYTES,
  assertAnonymousUploadAllowed
} from './file-upload.policy'

const file = (over: Partial<Express.Multer.File>): Express.Multer.File =>
  ({
    originalname: 'report.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('x'),
    ...over
  }) as Express.Multer.File

describe('assertAnonymousUploadAllowed', () => {
  it('accepts a small support attachment', () => {
    expect(() => assertAnonymousUploadAllowed(file({}))).not.toThrow()
  })

  it('refuses a file over the anonymous size cap', () => {
    expect(() =>
      assertAnonymousUploadAllowed(file({ size: ANONYMOUS_MAX_BYTES + 1 }))
    ).toThrow(PayloadTooLargeException)
  })

  it('refuses an executable dressed as an upload', () => {
    expect(() =>
      assertAnonymousUploadAllowed(
        file({ originalname: 'run.sh', mimetype: 'application/x-sh' })
      )
    ).toThrow(BadRequestException)
  })

  it('refuses html, which the bucket could serve back to a browser', () => {
    expect(() =>
      assertAnonymousUploadAllowed(
        file({ originalname: 'x.html', mimetype: 'text/html' })
      )
    ).toThrow(BadRequestException)
  })

  it('refuses a missing file', () => {
    expect(() =>
      assertAnonymousUploadAllowed(undefined as unknown as Express.Multer.File)
    ).toThrow(BadRequestException)
  })
})
