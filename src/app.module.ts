import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ConfigService } from './config/config.service'
import configuration from './config/configuration'
import { validate } from './config/validation'
import { PortfolioModule } from './modules/portfolio/portfolio.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      validate,
      isGlobal: true,
      cache: true
    }),
    PortfolioModule
  ],
  controllers: [AppController],
  providers: [AppService, ConfigService],
  exports: [ConfigService]
})
export class AppModule {}
