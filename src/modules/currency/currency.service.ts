import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateCurrencyDto, UpdateCurrencyDto } from './currency.dto'
import type {
  ICurrencyRepository,
  ICurrencyService
} from './currency.interface'

@Injectable()
export class CurrencyService implements ICurrencyService {
  constructor(
    @Inject('ICurrencyRepository')
    private currencyRepository: ICurrencyRepository
  ) {}

  async create(data: CreateCurrencyDto, _user: IUserWithPermissions) {
    const existingCurrency = await this.currencyRepository.findByCode(data.code)

    if (existingCurrency) {
      throw new ConflictException('Currency with this code already exists')
    }

    return this.currencyRepository.create(data)
  }

  async findAll(_user: IUserWithPermissions) {
    return this.currencyRepository.findAll()
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const currency = await this.currencyRepository.findById(id)

    if (!currency) {
      throw new NotFoundException('Currency not found')
    }

    return currency
  }

  async update(
    id: string,
    data: UpdateCurrencyDto,
    _user: IUserWithPermissions
  ) {
    const currency = await this.currencyRepository.findById(id)

    if (!currency) {
      throw new NotFoundException('Currency not found')
    }

    if (data.code && data.code !== currency.code) {
      const existingCurrency = await this.currencyRepository.findByCode(
        data.code
      )

      if (existingCurrency) {
        throw new ConflictException('Currency with this code already exists')
      }
    }

    return this.currencyRepository.update(id, data)
  }

  async remove(id: string, _user: IUserWithPermissions) {
    const currency = await this.currencyRepository.findById(id)

    if (!currency) {
      throw new NotFoundException('Currency not found')
    }

    const propertyCount = await this.currencyRepository.countProperties(id)

    if (propertyCount > 0) {
      throw new BadRequestException(
        `Cannot delete currency with ${propertyCount} associated properties. Please reassign the properties first.`
      )
    }

    await this.currencyRepository.delete(id)

    return { message: 'Currency deleted successfully' }
  }
}
