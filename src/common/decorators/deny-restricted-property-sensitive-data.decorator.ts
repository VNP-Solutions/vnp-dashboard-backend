import { SetMetadata } from '@nestjs/common'

export const DENY_RESTRICTED_PROPERTY_SENSITIVE_DATA_PROFILE_KEY =
  'denyRestrictedPropertySensitiveDataProfile'

/**
 * When set on a route, users whose role matches the restricted external sales permission
 * profile cannot access property credentials or bank details for a property (400 Bad Request).
 */
export const DenyRestrictedPropertySensitiveDataProfile = () =>
  SetMetadata(DENY_RESTRICTED_PROPERTY_SENSITIVE_DATA_PROFILE_KEY, true)
