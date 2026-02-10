import { Inject, Injectable } from '@nestjs/common'
import { BankType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  CreatePropertyBankDetailsDto,
  UpdatePropertyBankDetailsDto
} from './property-bank-details.dto'
import type { IPropertyBankDetailsRepository } from './property-bank-details.interface'

@Injectable()
export class PropertyBankDetailsRepository
  implements IPropertyBankDetailsRepository
{
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreatePropertyBankDetailsDto) {
    const createData: any = {
      property_id: data.property_id,
      bank_type: data.bank_type as BankType
    }

    // Add optional fields if provided
    if (data.bank_sub_type) {
      createData.bank_sub_type = data.bank_sub_type
    }
    if (data.hotel_portfolio_name) {
      createData.hotel_portfolio_name = data.hotel_portfolio_name
    }
    if (data.beneficiary_name) {
      createData.beneficiary_name = data.beneficiary_name
    }
    if (data.beneficiary_address) {
      createData.beneficiary_address = data.beneficiary_address
    }
    if (data.account_number) {
      createData.account_number = data.account_number
    }
    if (data.account_name) {
      createData.account_name = data.account_name
    }
    if (data.bank_name) {
      createData.bank_name = data.bank_name
    }
    if (data.bank_branch) {
      createData.bank_branch = data.bank_branch
    }
    if (data.swift_bic_iban) {
      createData.swift_bic_iban = data.swift_bic_iban
    }
    if (data.routing_number) {
      createData.routing_number = data.routing_number
    }
    if (data.bank_wiring_routing_number) {
      createData.bank_wiring_routing_number = data.bank_wiring_routing_number
    }
    if (data.bank_account_type) {
      createData.bank_account_type = data.bank_account_type
    }
    if (data.currency) {
      createData.currency = data.currency
    }
    if (data.stripe_account_email) {
      createData.stripe_account_email = data.stripe_account_email
    }
    if (data.contact_name) {
      createData.contact_name = data.contact_name
    }
    if (data.email_address) {
      createData.email_address = data.email_address
    }
    if (data.bank_address) {
      createData.bank_address = data.bank_address
    }
    if (data.comments) {
      createData.comments = data.comments
    }
    if (data.associated_user_id) {
      createData.associated_user_id = data.associated_user_id
    }

    return this.prisma.propertyBankDetails.create({
      data: createData
    })
  }

  async findByPropertyId(propertyId: string) {
    return this.prisma.propertyBankDetails.findUnique({
      where: { property_id: propertyId },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            is_active: true
          }
        }
      }
    })
  }

  async update(propertyId: string, data: UpdatePropertyBankDetailsDto) {
    const updateData: any = {}

    // Only include fields that are provided
    if (data.bank_type !== undefined) {
      updateData.bank_type = data.bank_type as BankType
    }
    if (data.bank_sub_type !== undefined) {
      updateData.bank_sub_type = data.bank_sub_type
    }
    if (data.hotel_portfolio_name !== undefined) {
      updateData.hotel_portfolio_name = data.hotel_portfolio_name
    }
    if (data.beneficiary_name !== undefined) {
      updateData.beneficiary_name = data.beneficiary_name
    }
    if (data.beneficiary_address !== undefined) {
      updateData.beneficiary_address = data.beneficiary_address
    }
    if (data.account_number !== undefined) {
      updateData.account_number = data.account_number
    }
    if (data.account_name !== undefined) {
      updateData.account_name = data.account_name
    }
    if (data.bank_name !== undefined) {
      updateData.bank_name = data.bank_name
    }
    if (data.bank_branch !== undefined) {
      updateData.bank_branch = data.bank_branch
    }
    if (data.swift_bic_iban !== undefined) {
      updateData.swift_bic_iban = data.swift_bic_iban
    }
    if (data.routing_number !== undefined) {
      updateData.routing_number = data.routing_number
    }
    if (data.bank_wiring_routing_number !== undefined) {
      updateData.bank_wiring_routing_number = data.bank_wiring_routing_number
    }
    if (data.bank_account_type !== undefined) {
      updateData.bank_account_type = data.bank_account_type
    }
    if (data.currency !== undefined) {
      updateData.currency = data.currency
    }
    if (data.stripe_account_email !== undefined) {
      updateData.stripe_account_email = data.stripe_account_email
    }
    if (data.contact_name !== undefined) {
      updateData.contact_name = data.contact_name
    }
    if (data.email_address !== undefined) {
      updateData.email_address = data.email_address
    }
    if (data.bank_address !== undefined) {
      updateData.bank_address = data.bank_address
    }
    if (data.comments !== undefined) {
      updateData.comments = data.comments
    }
    if (data.associated_user_id !== undefined) {
      updateData.associated_user_id = data.associated_user_id
    }

    return this.prisma.propertyBankDetails.update({
      where: { property_id: propertyId },
      data: updateData
    })
  }

  async delete(propertyId: string) {
    return this.prisma.propertyBankDetails.delete({
      where: { property_id: propertyId }
    })
  }
}
