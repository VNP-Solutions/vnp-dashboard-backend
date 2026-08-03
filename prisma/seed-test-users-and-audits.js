/**
 * Dashboard test roles, users and payable audits.
 *
 * Run with:
 *   docker exec -i vnps-dash-mongo mongosh vnpdash --quiet < prisma/seed-test-users-and-audits.js
 *
 * WHY ROLES AND NOT JUST USERS: the dashboard's payout controls are gated on the AUDIT permission,
 * on two independent axes. `permission_level` decides whether the Pay out button renders at all
 * (it needs `update`), and `access_level` decides which properties the user may act on
 * (`partial` means only assigned ones). A bug in either axis is invisible signed in as a role that
 * has `all` on both, which is what the only existing account has. The partial role exists to catch
 * exactly the defect we already found once here: a guard that computed the right answer and then
 * returned true regardless, letting a scoped user dispatch a payout for a property they cannot see.
 *
 * WHY NEW AUDITS: every existing audit already has a payout against it, so its button reads Paid or
 * Retry and the first-dispatch path cannot be exercised. These are fresh, on properties that are
 * mapped to a payout-service hotel, so "Pay out" resolves a destination instead of failing unmapped.
 *
 * Safe to re-run: everything is upserted by a stable id or a natural key.
 */

// Shared password for every test account below: Sandbox123!
// Reused from the existing demo operator rather than re-hashed, so this file carries no plaintext
// and no bcrypt dependency.
const demoUser = db.User.findOne({ email: 'operator-1784919800869@local.test' })
if (!demoUser) {
  print('ERROR: demo operator not found; cannot copy a password hash. Aborting.')
  quit(1)
}
const PASSWORD_HASH = demoUser.password

const now = new Date()

/** Properties already mapped to a payout-service hotel, so a payout can actually resolve. */
const PAYABLE = [
  { id: '6a6c00000000000000000001', name: 'Harbor Point Hotel' },
  { id: '6a6c00000000000000000002', name: 'Cedar Grove Inn' },
  { id: '6a6c00000000000000000003', name: 'Marina Bay Suites' },
  { id: '6a6c0000000000000000d38d', name: 'Merge Verify Property' }
]

const COMPLETE_STATUS = db.AuditStatus.findOne({ status: 'COMPLETE' })

// ---------------------------------------------------------------- roles

const full = level => ({ permission_level: level, access_level: 'all' })
const partial = level => ({ permission_level: level, access_level: 'partial' })
const none = () => ({ permission_level: 'view', access_level: 'none' })

const ROLES = [
  {
    _id: ObjectId('6a6d0000000000000000r001'.replace(/r/g, '1')),
    name: 'Test Super Admin',
    description: 'Everything at all/all. The baseline where every control is present.',
    perms: {
      portfolio_permission: full('all'),
      property_permission: full('all'),
      audit_permission: full('all'),
      user_permission: full('all'),
      system_settings_permission: full('all'),
      bank_details_permission: full('all')
    }
  },
  {
    _id: ObjectId('6a6d0000000000000000r002'.replace(/r/g, '1')),
    name: 'Test Payout Operator',
    description: 'Can dispatch payouts on any property, but cannot manage users or settings.',
    perms: {
      portfolio_permission: full('view'),
      property_permission: full('view'),
      audit_permission: full('update'),
      user_permission: none(),
      system_settings_permission: none(),
      bank_details_permission: full('view')
    }
  },
  {
    _id: ObjectId('6a6d0000000000000000r003'.replace(/r/g, '1')),
    name: 'Test Partial Operator',
    description: 'May dispatch payouts, but ONLY on assigned properties. Proves scoping.',
    perms: {
      portfolio_permission: partial('view'),
      property_permission: partial('view'),
      audit_permission: partial('update'),
      user_permission: none(),
      system_settings_permission: none(),
      bank_details_permission: partial('view')
    }
  },
  {
    _id: ObjectId('6a6d0000000000000000r004'.replace(/r/g, '1')),
    name: 'Test Read Only',
    description: 'Sees audits and payouts, must not be offered any control that moves money.',
    perms: {
      portfolio_permission: full('view'),
      property_permission: full('view'),
      audit_permission: full('view'),
      user_permission: none(),
      system_settings_permission: none(),
      bank_details_permission: full('view')
    }
  },
  {
    _id: ObjectId('6a6d0000000000000000r005'.replace(/r/g, '1')),
    name: 'Test No Audit Access',
    description: 'No audit access at all. Audits and Payouts must not appear in the sidebar.',
    perms: {
      portfolio_permission: full('view'),
      property_permission: full('view'),
      audit_permission: none(),
      user_permission: none(),
      system_settings_permission: none(),
      bank_details_permission: none()
    }
  }
]

print('=== roles ===')
ROLES.forEach(r => {
  db.UserRole.updateOne(
    { _id: r._id },
    {
      $set: Object.assign(
        {
          name: r.name,
          description: r.description,
          is_external: false,
          can_access_mis: false,
          is_active: true,
          order: Long(0),
          updated_at: now
        },
        r.perms
      ),
      $setOnInsert: { created_at: now }
    },
    { upsert: true }
  )
  print('  ' + r.name)
})

// ---------------------------------------------------------------- users

const USERS = [
  { id: '6a6d000000000000000011a1', first: 'Sasha', last: 'Superadmin', email: 'dash-super@test.local', role: 0 },
  { id: '6a6d000000000000000011a2', first: 'Oliver', last: 'Operator', email: 'dash-operator@test.local', role: 1 },
  {
    id: '6a6d000000000000000011a3',
    first: 'Pam',
    last: 'Partial',
    email: 'dash-partial@test.local',
    role: 2,
    // Assigned to ONE payable property. Pay out must work here and nowhere else.
    properties: ['6a6c00000000000000000002']
  },
  { id: '6a6d000000000000000011a4', first: 'Rita', last: 'Readonly', email: 'dash-readonly@test.local', role: 3 },
  { id: '6a6d000000000000000011a5', first: 'Nate', last: 'Noaudit', email: 'dash-noaudit@test.local', role: 4 }
]

print('=== users (password: Sandbox123!) ===')
USERS.forEach(u => {
  const _id = ObjectId(u.id)
  db.User.updateOne(
    { _id: _id },
    {
      $set: {
        first_name: u.first,
        last_name: u.last,
        email: u.email,
        language: 'en',
        user_role_id: ROLES[u.role]._id,
        password: PASSWORD_HASH,
        is_verified: true,
        updated_at: now
      },
      $setOnInsert: { created_at: now }
    },
    { upsert: true }
  )

  // Reconcile assignments rather than append, so a re-run cannot widen someone's access.
  db.UserAccessedProperty.deleteMany({ user_id: _id })
  if (u.properties) {
    db.UserAccessedProperty.insertOne({
      user_id: _id,
      portfolio_id: [ObjectId('6a6ac89f3aeca8b36ee60086')],
      property_id: u.properties.map(p => ObjectId(p)),
      created_at: now,
      updated_at: now
    })
  }
  print('  ' + u.email.padEnd(30) + ROLES[u.role].name + (u.properties ? '  [Cedar Grove Inn only]' : ''))
})

// ---------------------------------------------------------------- payable audits

/**
 * Fresh audits, one per mapped property, with confirmed amounts on two OTAs.
 *
 * Two OTAs on purpose: the payout service picks a rail per OTA from the processor configured for it,
 * so a two-OTA audit is what produces a mixed-rail payout, which is the case worth being able to
 * demonstrate. Confirmed amounts are set because the payout amount is derived from them; an audit
 * with none is skipped rather than paid.
 */
const AUDITS = [
  { id: '6a6d00000000000000aa0001', prop: 0, expedia: 910.25, booking: 640.5 },
  { id: '6a6d00000000000000aa0002', prop: 1, expedia: 420.0, booking: 265.75 },
  { id: '6a6d00000000000000aa0003', prop: 2, expedia: 1310.4, booking: 880.0 },
  { id: '6a6d00000000000000aa0004', prop: 3, expedia: 555.0, booking: 333.33 },
  // A second audit on the first property, so repeat payouts to one hotel can be demonstrated.
  { id: '6a6d00000000000000aa0005', prop: 0, expedia: 210.0, booking: 145.6 }
]

print('=== payable audits ===')
AUDITS.forEach(a => {
  const property = PAYABLE[a.prop]
  db.Audit.updateOne(
    { _id: ObjectId(a.id) },
    {
      $set: {
        type_of_ota: ['expedia', 'booking'],
        audit_status_id: COMPLETE_STATUS ? COMPLETE_STATUS._id : null,
        property_id: ObjectId(property.id),
        expedia_amount_collectable: a.expedia,
        booking_amount_collectable: a.booking,
        expedia_amount_confirmed: a.expedia,
        booking_amount_confirmed: a.booking,
        is_archived: false,
        updated_at: now
      },
      $setOnInsert: { created_at: now }
    },
    { upsert: true }
  )
  print('  ' + a.id + '  ' + property.name.padEnd(24) + 'expedia ' + a.expedia + '  booking ' + a.booking)
})

print('')
print('users: ' + db.User.countDocuments() + '   roles: ' + db.UserRole.countDocuments() + '   audits: ' + db.Audit.countDocuments())
