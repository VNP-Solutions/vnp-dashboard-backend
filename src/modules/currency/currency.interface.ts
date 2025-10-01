import { Currency, Prisma } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateCurrencyDto, UpdateCurrencyDto } from './currency.dto'

type CurrencyWithProperties = Prisma.CurrencyGetPayload<{
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

export interface ICurrencyRepository {
  create(data: CreateCurrencyDto): Promise<Currency>
  findAll(): Promise<CurrencyWithProperties[]>
  findById(id: string): Promise<CurrencyWithProperties | null>
  findByCode(code: string): Promise<Currency | null>
  update(id: string, data: UpdateCurrencyDto): Promise<Currency>
  delete(id: string): Promise<Currency>
  countProperties(currencyId: string): Promise<number>
}

export interface ICurrencyService {
  create(data: CreateCurrencyDto, user: IUserWithPermissions): Promise<Currency>
  findAll(user: IUserWithPermissions): Promise<CurrencyWithProperties[]>
  findOne(
    id: string,
    user: IUserWithPermissions
  ): Promise<CurrencyWithProperties>
  update(
    id: string,
    data: UpdateCurrencyDto,
    user: IUserWithPermissions
  ): Promise<Currency>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
}
