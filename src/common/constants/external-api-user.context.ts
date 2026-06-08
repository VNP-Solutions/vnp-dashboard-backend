import { AccessLevel, PermissionLevel } from '@prisma/client'
import { IUserWithPermissions } from '../interfaces/permission.interface'

const allPermission = {
  permission_level: PermissionLevel.all,
  access_level: AccessLevel.all
}

/**
 * Virtual super-admin context used for external API key requests so property
 * list responses match the regular portfolio-scoped property GET all API.
 */
export const EXTERNAL_API_SUPER_ADMIN_CONTEXT: IUserWithPermissions = {
  id: 'external-api',
  email: 'external-api@system',
  user_role_id: 'external-api',
  role: {
    id: 'external-api',
    name: 'External API',
    is_external: false,
    can_access_mis: true,
    portfolio_permission: allPermission,
    property_permission: allPermission,
    audit_permission: allPermission,
    user_permission: allPermission,
    system_settings_permission: allPermission,
    bank_details_permission: allPermission
  }
}
