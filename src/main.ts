import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ConfigService } from './config/config.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors()

  const configService = app.get(ConfigService)
  await app.listen(configService.app.port)
}
void bootstrap()
