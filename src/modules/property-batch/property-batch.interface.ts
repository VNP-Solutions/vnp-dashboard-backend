import { Prisma, PropertyBatch } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreatePropertyBatchDto,
  PropertyBatchQueryDto,
  ReorderPropertyBatchDto,
  UpdatePropertyBatchDto
} from './property-batch.dto'

type PropertyBatchWithProperties = Prisma.PropertyBatchGetPayload<{
  include: {
    properties: {
      select: {
        id: true
        name: true
        is_active: true
      }
    }
  }
}>

export interface IPropertyBatchRepository {
  create(data: CreatePropertyBatchDto): Promise<PropertyBatch>
  findAll(queryOptions: any): Promise<PropertyBatchWithProperties[]>
  findById(id: string): Promise<PropertyBatchWithProperties | null>
  findByBatchNo(batchNo: string): Promise<PropertyBatch | null>
  update(id: string, data: UpdatePropertyBatchDto): Promise<PropertyBatch>
  delete(id: string): Promise<PropertyBatch>
  countProperties(batchId: string): Promise<number>
  count(): Promise<number>
  updateMany(data: Array<{ id: string; order: number }>): Promise<void>
}

export interface IPropertyBatchService {
  create(
    data: CreatePropertyBatchDto,
    user: IUserWithPermissions
  ): Promise<PropertyBatch>
  findAll(
    query: PropertyBatchQueryDto,
    user: IUserWithPermissions
  ): Promise<PropertyBatchWithProperties[]>
  findOne(
    id: string,
    user: IUserWithPermissions
  ): Promise<PropertyBatchWithProperties>
  update(
    id: string,
    data: UpdatePropertyBatchDto,
    user: IUserWithPermissions
  ): Promise<PropertyBatch>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  reorder(id: string, data: ReorderPropertyBatchDto, user: IUserWithPermissions): Promise<{ message: string }>
}
