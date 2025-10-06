import { ApiProperty } from '@nestjs/swagger'

export class FileUploadResponseDto {
  @ApiProperty({
    description: 'The public URL of the uploaded file',
    example: 'https://bucket-name.s3.region.amazonaws.com/uploads/filename.jpg'
  })
  url: string

  @ApiProperty({
    description: 'The S3 key of the uploaded file',
    example: 'uploads/1234567890-filename.jpg'
  })
  key: string

  @ApiProperty({
    description: 'Original file name',
    example: 'document.pdf'
  })
  originalName: string

  @ApiProperty({
    description: 'File size in bytes',
    example: 1024000
  })
  size: number

  @ApiProperty({
    description: 'File MIME type',
    example: 'image/jpeg'
  })
  mimetype: string
}
