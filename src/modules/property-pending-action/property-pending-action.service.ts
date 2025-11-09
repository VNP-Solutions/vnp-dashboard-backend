import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef
} from '@nestjs/common'
import { PropertyActionStatus, PropertyActionType } from '@prisma/client'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { isUserSuperAdmin } from '../../common/utils/permission.util'
import type { IPropertyService } from '../property/property.interface'
import {
  ApprovePropertyPendingActionDto,
  CreatePropertyPendingActionDto,
  PropertyPendingActionQueryDto
} from './property-pending-action.dto'
import type {
  IPropertyPendingActionRepository,
  IPropertyPendingActionService
} from './property-pending-action.interface'

@Injectable()
export class PropertyPendingActionService
  implements IPropertyPendingActionService
{
  constructor(
    @Inject('IPropertyPendingActionRepository')
    private repository: IPropertyPendingActionRepository,
    @Inject(forwardRef(() => 'IPropertyService'))
    private propertyService: IPropertyService
  ) {}

  async create(
    data: CreatePropertyPendingActionDto,
    user: IUserWithPermissions
  ) {
    // Validate transfer data for transfer actions
    if (
      data.action_type === PropertyActionType.TRANSFER &&
      !data.transfer_data?.new_portfolio_id
    ) {
      throw new BadRequestException(
        'Transfer data with new_portfolio_id is required for transfer actions'
      )
    }

    // Create the pending action
    return this.repository.create({
      property_id: data.property_id,
      action_type: data.action_type,
      requested_user_id: user.id,
      transfer_data: data.transfer_data
    })
  }

  async findAll(
    query: PropertyPendingActionQueryDto,
    user: IUserWithPermissions
  ) {
    const where: any = {}

    // Non-super admins can only see their own pending actions
    if (!isUserSuperAdmin(user)) {
      where.requested_user_id = user.id
    }

    if (query.status) {
      where.status = query.status
    }

    if (query.action_type) {
      where.action_type = query.action_type
    }

    if (query.requested_user_id && isUserSuperAdmin(user)) {
      where.requested_user_id = query.requested_user_id
    }

    return this.repository.findAll({ where })
  }

  async findOne(id: string, user: IUserWithPermissions) {
    const pendingAction = await this.repository.findById(id)

    if (!pendingAction) {
      throw new NotFoundException('Pending action not found')
    }

    // Non-super admins can only view their own pending actions
    if (
      !isUserSuperAdmin(user) &&
      pendingAction.requested_user_id !== user.id
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this pending action'
      )
    }

    return pendingAction
  }

  async approve(
    id: string,
    _data: ApprovePropertyPendingActionDto,
    user: IUserWithPermissions
  ) {
    // Only super admins can approve
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can approve actions')
    }

    const pendingAction = await this.repository.findById(id)

    if (!pendingAction) {
      throw new NotFoundException('Pending action not found')
    }

    if (pendingAction.status !== PropertyActionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve action with status: ${pendingAction.status}`
      )
    }

    // Execute the actual action based on type
    await this.executeAction(pendingAction, user)

    // Update the pending action status
    return this.repository.update(id, {
      status: PropertyActionStatus.APPROVED,
      approval_user_id: user.id,
      approved_at: new Date()
    })
  }

  async reject(
    id: string,
    data: ApprovePropertyPendingActionDto,
    user: IUserWithPermissions
  ) {
    // Only super admins can reject
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can reject actions')
    }

    const pendingAction = await this.repository.findById(id)

    if (!pendingAction) {
      throw new NotFoundException('Pending action not found')
    }

    if (pendingAction.status !== PropertyActionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject action with status: ${pendingAction.status}`
      )
    }

    if (!data.rejection_reason) {
      throw new BadRequestException('Rejection reason is required')
    }

    // Update the pending action status
    return this.repository.update(id, {
      status: PropertyActionStatus.REJECTED,
      approval_user_id: user.id,
      rejection_reason: data.rejection_reason,
      approved_at: new Date()
    })
  }

  async findByPropertyId(propertyId: string) {
    return this.repository.findByPropertyId(propertyId)
  }

  /**
   * Execute the actual property action
   * This method delegates to the property service to perform the actual operation
   */
  private async executeAction(pendingAction: any, user: IUserWithPermissions) {
    switch (pendingAction.action_type) {
      case PropertyActionType.DELETE:
        // Delete the property
        await this.propertyService.remove(pendingAction.property_id, user)
        break

      case PropertyActionType.TRANSFER:
        // Transfer the property
        if (!pendingAction.transfer_data?.new_portfolio_id) {
          throw new BadRequestException(
            'Transfer data is missing for TRANSFER action'
          )
        }
        await this.propertyService.transfer(
          pendingAction.property_id,
          {
            new_portfolio_id: pendingAction.transfer_data.new_portfolio_id,
            password: '' // Password already validated when creating pending action
          },
          user
        )
        break

      default:
        throw new BadRequestException(
          `Unknown action type: ${pendingAction.action_type}`
        )
    }
  }
}
