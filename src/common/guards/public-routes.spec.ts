import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Inventory of routes that skip `JwtAuthGuard`.
 *
 * `@Public()` is the only way past the global guard, but it means two very different things:
 * with a `@UseGuards(...)` of its own the route is machine-authenticated, while `@Public()` alone
 * leaves the route open to anyone on the internet. Both lists are pinned so that opening a route
 * has to be a deliberate edit here, reviewed as such.
 *
 * A `:: class` entry means the decorator sits on the controller, so every route in it is public
 * unless that route sets its own guard or `@Public(false)`.
 */
const UNAUTHENTICATED = [
  'auth/auth.controller.ts :: class',
  'email/email.controller.ts :: sendEmail',
  'external-communication/external-communication.controller.ts :: class',
  'file-upload/file-upload.controller.ts :: uploadFile',
  'property/property.controller.ts :: updateAccessLevels'
]

const SERVICE_GUARDED = [
  'api-key/external-api.controller.ts :: class',
  'portfolio/portfolio.controller.ts :: syncBulkUpsert',
  'portfolio/portfolio.controller.ts :: syncDelete',
  'portfolio/portfolio.controller.ts :: syncUpdate',
  'portfolio/portfolio.controller.ts :: syncUpsert',
  'portfolio/portfolio.controller.ts :: updateFileCount',
  'property/property.controller.ts :: syncBulkCreate',
  'property/property.controller.ts :: syncBulkDelete',
  'property/property.controller.ts :: syncBulkUpsert',
  'property/property.controller.ts :: syncByOta',
  'property/property.controller.ts :: syncCreate',
  'property/property.controller.ts :: syncDelete',
  'property/property.controller.ts :: syncUpsert',
  'sync-action-log/sync-action-log.controller.ts :: create'
]

type PublicRoute = { id: string; guarded: boolean }

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return controllerFiles(path)
    return path.endsWith('.controller.ts') ? [path] : []
  })
}

function publicRoutesIn(source: string, label: string): PublicRoute[] {
  const lines = source.split('\n')
  const found: PublicRoute[] = []

  lines.forEach((line, index) => {
    // `@Public(false)` re-protects a route inside a public controller; only bare/true opens one.
    if (!/^\s*@Public\(\s*(true)?\s*\)/.test(line)) return

    const rest = lines.slice(index + 1)
    const classIndex = rest.findIndex(l => /^export class /.test(l))
    const handlerIndex = rest.findIndex(l =>
      /^\s{2}(?:async\s+)?[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(l)
    )
    const isClassLevel =
      classIndex !== -1 && (handlerIndex === -1 || classIndex < handlerIndex)
    const end = isClassLevel ? classIndex : handlerIndex

    // A guard between `@Public()` and what it decorates authenticates the caller — except
    // `OptionalJwtAuthGuard`, which only fills in `req.user` when a token happens to be present.
    const guarded = rest
      .slice(0, end === -1 ? 0 : end)
      .some(l => /@UseGuards\(/.test(l) && !/OptionalJwtAuthGuard/.test(l))

    const handler = rest[handlerIndex]?.match(
      /([A-Za-z_][A-Za-z0-9_]*)\s*\(/
    )?.[1]
    found.push({
      id: `${label} :: ${isClassLevel ? 'class' : (handler ?? 'unknown')}`,
      guarded
    })
  })

  return found
}

describe('routes that skip JwtAuthGuard', () => {
  const modulesDir = join(__dirname, '..', '..', 'modules')
  const routes = controllerFiles(modulesDir).flatMap(path =>
    publicRoutesIn(
      readFileSync(path, 'utf8'),
      path.slice(path.indexOf('modules/') + 'modules/'.length)
    )
  )

  it('finds controllers to scan', () => {
    expect(controllerFiles(modulesDir).length).toBeGreaterThan(10)
  })

  it('leaves only the expected routes open to anyone', () => {
    const open = routes
      .filter(route => !route.guarded)
      .map(route => route.id)
      .sort()

    expect(open).toEqual([...UNAUTHENTICATED].sort())
  })

  it('keeps the machine-to-machine surface as expected', () => {
    const guarded = routes
      .filter(route => route.guarded)
      .map(route => route.id)
      .sort()

    expect(guarded).toEqual([...SERVICE_GUARDED].sort())
  })
})
