import { Global, Module } from '@nestjs/common'
import { OtaPasswordPlaintextCacheService } from '../services/ota-password-plaintext-cache.service'

@Global()
@Module({
  providers: [OtaPasswordPlaintextCacheService],
  exports: [OtaPasswordPlaintextCacheService]
})
export class OtaPasswordPlaintextCacheModule {}
