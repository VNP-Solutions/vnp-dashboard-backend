import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient
} from '@aws-sdk/client-sqs'
import { Upload } from '@aws-sdk/lib-storage'
import { Readable } from 'stream'

export interface AuditImportSqsMessage {
  jobId: string
  s3Key: string
  originalName: string
  requestedAt: string
  qaPanelId: string
  email: string
}

export interface S3ClientConfig {
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
}

export function createSqsClient(config: {
  region: string
  accessKeyId: string
  secretAccessKey: string
}): SQSClient {
  return new SQSClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  })
}

export function createS3Client(config: {
  region: string
  accessKeyId: string
  secretAccessKey: string
}): S3Client {
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  })
}

export async function enqueueAuditImport(
  sqsClient: SQSClient,
  queueUrl: string,
  message: AuditImportSqsMessage
): Promise<string | undefined> {
  const result = await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message)
    })
  )
  return result.MessageId
}

export async function receiveAuditImportMessages(
  sqsClient: SQSClient,
  queueUrl: string
): Promise<Message[]> {
  const result = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20,
      VisibilityTimeout: 300
    })
  )
  return result.Messages ?? []
}

export async function deleteAuditImportMessage(
  sqsClient: SQSClient,
  queueUrl: string,
  receiptHandle: string
): Promise<void> {
  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle
    })
  )
}

export async function uploadFileToS3(
  s3Client: S3Client,
  bucketName: string,
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType
    }
  })
  await upload.done()
}

export async function downloadFileFromS3(
  s3Client: S3Client,
  bucketName: string,
  key: string
): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucketName, Key: key })
  )

  const stream = response.Body as Readable
  const chunks: Buffer[] = []

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

export async function deleteFileFromS3(
  s3Client: S3Client,
  bucketName: string,
  key: string
): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
}
