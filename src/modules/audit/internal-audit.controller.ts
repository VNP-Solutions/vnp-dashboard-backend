import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'
import { Public } from '../auth/decorators/public.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { InternalApiKeyGuard } from './internal-api-key.guard'

/**
 * Service-to-service read seam for the payout backend (x-api-key, not JWT). Returns one audit with
 * its property's currency + credentials, in the shape the payout backend's DashboardReader expects.
 * @Public() skips the global JwtAuthGuard; InternalApiKeyGuard enforces the shared service key.
 */
@ApiTags('Internal')
@ApiSecurity('x-api-key')
@Public()
@Controller('internal')
@UseGuards(InternalApiKeyGuard)
export class InternalAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('audit/:id')
  @ApiOperation({ summary: 'Read one audit (amounts + property currency/credentials) for payout resolution' })
  async getAudit(@Param('id') id: string) {
    const audit = await this.prisma.audit.findUnique({
      where: { id },
      include: { property: { include: { currency: true, credentials: true } } }
    })
    if (!audit) throw new NotFoundException('Audit not found')
    return audit
  }
}
