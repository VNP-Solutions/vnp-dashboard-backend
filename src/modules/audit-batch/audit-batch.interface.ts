import { AuditBatch, Prisma } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  AuditBatchQueryDto,
  CreateAuditBatchDto,
  ReorderAuditBatchDto,
  UpdateAuditBatchDto
} from './audit-batch.dto'

type AuditBatchWithAudits = Prisma.AuditBatchGetPayload<object>

export interface IAuditBatchRepository {
  create(data: CreateAuditBatchDto): Promise<AuditBatch>
  findAll(queryOptions: any): Promise<AuditBatchWithAudits[]>
  findById(id: string): Promise<AuditBatchWithAudits | null>
  findByBatchNo(batchNo: string): Promise<AuditBatch | null>
  update(id: string, data: UpdateAuditBatchDto): Promise<AuditBatch>
  delete(id: string): Promise<AuditBatch>
  countAudits(batchId: string): Promise<number>
  count(): Promise<number>
  updateMany(data: Array<{ id: string; order: number }>): Promise<void>
}

export interface IAuditBatchService {
  create(
    data: CreateAuditBatchDto,
    user: IUserWithPermissions
  ): Promise<AuditBatch>
  findAll(
    query: AuditBatchQueryDto,
    user: IUserWithPermissions
  ): Promise<AuditBatchWithAudits[]>
  findOne(id: string, user: IUserWithPermissions): Promise<AuditBatchWithAudits>
  update(
    id: string,
    data: UpdateAuditBatchDto,
    user: IUserWithPermissions
  ): Promise<AuditBatch>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  reorder(
    id: string,
    data: ReorderAuditBatchDto,
    user: IUserWithPermissions
  ): Promise<{ message: string }>
}
