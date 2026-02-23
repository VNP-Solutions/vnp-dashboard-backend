import { ExecutionContext } from '@nestjs/common'

/**
 * Extract IP address from the request
 * Handles various proxy headers like X-Forwarded-For
 */
export function extractIpFromRequest(context: ExecutionContext): string | null {
  const request = context.switchToHttp().getRequest()

  // Check various headers for IP address (in order of priority)
  const ip =
    request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    request.headers['x-real-ip'] ||
    request.headers['cf-connecting-ip'] || // Cloudflare
    request.connection?.remoteAddress ||
    request.socket?.remoteAddress ||
    request.ip ||
    null

  console.log('🔍 Raw IP extracted:', ip)

  // Handle IPv6-mapped IPv4 addresses (e.g., ::ffff:127.0.0.1)
  let processedIp = ip
  if (ip && ip.startsWith('::ffff:')) {
    processedIp = ip.substring(7)
  }

  // Check if it's a local/private address
  const isLocal = processedIp && (
    processedIp === '127.0.0.1' ||
    processedIp === '::1' ||
    processedIp.startsWith('192.168.') ||
    processedIp.startsWith('10.') ||
    processedIp.startsWith('172.16.')
  )

  if (isLocal) {
    console.log('⚠️  Local/private IP detected, skipping geolocation:', processedIp)
    return null
  }

  console.log('✓ IP to geolocate:', processedIp)
  return processedIp
}

/**
 * Get location information from IP address using a free geolocation API
 * Returns formatted location string or null if unavailable
 */
export async function getLocationFromIp(ip: string): Promise<string | null> {
  if (!ip) {
    return null
  }

  try {
    console.log(`🌍 Fetching location for IP: ${ip}`)
    // Use ip-api.com (free, no API key required for non-commercial use)
    const response = await fetch(`http://ip-api.com/json/${ip}`)

    if (!response.ok) {
      console.warn(`⚠️  Failed to get location for IP ${ip}: HTTP ${response.status}`)
      return null
    }

    const data = await response.json()

    if (data.status === 'fail') {
      console.warn(`⚠️  IP geolocation failed for ${ip}: ${data.message}`)
      return null
    }

    // Build location string from available data
    const parts: string[] = []
    if (data.city) parts.push(data.city)
    if (data.regionName) parts.push(data.regionName)
    if (data.country) parts.push(data.country)

    const location = parts.length > 0 ? parts.join(', ') : null
    console.log(`✓ Location found for ${ip}: ${location}`)
    return location
  } catch (error) {
    console.error(`❌ Error getting location for IP ${ip}:`, error)
    return null
  }
}

/**
 * Get location from request context
 * This is a convenience method that combines IP extraction and geolocation
 */
export async function getLocationFromRequest(
  context: ExecutionContext
): Promise<string | null> {
  const ip = extractIpFromRequest(context)
  if (!ip) {
    console.log('ℹ️  No IP available for geolocation (likely localhost or private network)')
    return null
  }

  const location = await getLocationFromIp(ip)
  console.log('📍 Final location result:', location || 'Unable to determine location')
  return location
}
