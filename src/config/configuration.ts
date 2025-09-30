import { NodeEnvironment } from './configuration.schema'

export interface Configuration {
  port: number
  app: {
    port: number
  }
  appName?: string
  nodeEnv: NodeEnvironment
  database: {
    url: string
  }
  jwt: {
    secret: string
    expiresIn: string
  }
  s3: {
    bucketName: string
    region: string
    accessKey: string
    secretKey: string
    bucketUrl: string
  }
  smtp: {
    email: string
    password: string
  }
  invitationRedirectUrl?: string
}

export default (): Configuration => ({
  port: parseInt(process.env.PORT || '3000', 10),
  app: {
    port: parseInt(process.env.PORT || '3000', 10)
  },
  appName: process.env.APP_NAME,
  nodeEnv:
    (process.env.NODE_ENV as NodeEnvironment) || NodeEnvironment.DEVELOPMENT,
  database: {
    url: process.env.DATABASE_URL!
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  s3: {
    bucketName: process.env.S3_BUCKET_NAME!,
    region: process.env.S3_REGION!,
    accessKey: process.env.S3_ACCESS_KEY!,
    secretKey: process.env.S3_SECRET_KEY!,
    bucketUrl: process.env.S3_BUCKET_URL!
  },
  smtp: {
    email: process.env.SMTP_EMAIL!,
    password: process.env.SMTP_PASSWORD!
  },
  invitationRedirectUrl: process.env.INVITATION_REDIRECT_URL
})
