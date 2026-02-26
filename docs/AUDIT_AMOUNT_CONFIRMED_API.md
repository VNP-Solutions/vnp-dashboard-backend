# Audit Amount Confirmed Fields - API Documentation

This document describes the APIs for managing the three amount confirmed fields in the Audit module.

## Overview

The Audit model has three amount confirmed fields:
- **`expedia_amount_confirmed`** - Confirmed amount for Expedia
- **`agoda_amount_confirmed`** - Confirmed amount for Agoda
- **`booking_amount_confirmed`** - Confirmed amount for Booking

**Important:** These fields have special update restrictions based on user roles and whether the field has been previously set.

---

## User Permissions Summary

| User Type | Can Update Directly | Restriction |
|-----------|---------------------|-------------|
| **Super Admin** | ✅ Yes | No restrictions - can update anytime |
| **Internal User** | ✅ Yes | Can only set **once** per OTA type. After value is set, only super admins can update it |
| **External User** | ❌ No | Must submit a request that requires super admin approval |

---

## API Endpoints

### 1. Direct Update (Super Admins & Internal Users)

Update one or more amount confirmed fields directly.

**Endpoint:** `PATCH /audit/:id`

**Authentication:** Bearer Token (JWT)

**Permissions:**
- Module: `audit`
- Action: `update`
- User Type: Internal users only

**Request Headers:**
```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "expedia_amount_confirmed": 4500.75,
  "agoda_amount_confirmed": 2800.50,
  "booking_amount_confirmed": 1900.25
}
```

**Success Response:** `200 OK`
```json
{
  "success": true,
  "message": "Audit updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "expedia_amount_confirmed": 4500.75,
    "agoda_amount_confirmed": 2800.50,
    "booking_amount_confirmed": 1900.25,
    // ... other audit fields
  }
}
```

**Error Responses:**

`400 Bad Request` - Non-super-admin internal user trying to update already-set amount_confirmed
```json
{
  "success": false,
  "message": "Cannot update expedia_amount_confirmed: Field has already been set. Only super admins can update it.",
  "error": ["Bad Request"]
}
```

`403 Forbidden` - External user attempting to update directly
```json
{
  "success": false,
  "message": "Only internal users can update audits",
  "error": ["Forbidden"]
}
```

**Behavior Notes:**
- All three fields are optional - you can update one, two, or all three
- Super admins can update these fields anytime, even if already set
- Non-super-admin internal users can only set each field **once per OTA type**
- Once set by a non-super-admin, only a super admin can modify that field again

---

### 2. Request Update (External Users)

Submit a request to update amount confirmed fields. Requires super admin approval.

**Endpoint:** `POST /audit/:id/request-update-amount-confirmed`

**Authentication:** Bearer Token (JWT)

**Permissions:**
- Module: `audit`
- Action: `read`
- User Type: External users only

**Request Headers:**
```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "password": "UserPassword123!",
  "expedia_amount_confirmed": 5000.50,
  "agoda_amount_confirmed": 3000.00,
  "booking_amount_confirmed": 2000.00,
  "reason": "Need to correct the amount based on final audit report"
}
```

**Fields:**
- `password` (required) - User's password for verification
- `expedia_amount_confirmed` (optional) - New Expedia amount value
- `agoda_amount_confirmed` (optional) - New Agoda amount value
- `booking_amount_confirmed` (optional) - New Booking amount value
- `reason` (optional) - Explanation for the change request
- **At least one amount_confirmed field must be provided**

**Success Response:** `201 Created`
```json
{
  "success": true,
  "message": "Update request submitted successfully. Waiting for super admin approval.",
  "data": {
    "id": "507f1f77bcf86cd799439020",
    "type": "AUDIT_UPDATE_AMOUNT_CONFIRMED",
    "status": "PENDING",
    "audit_id": "507f1f77bcf86cd799439011",
    "requested_by": "507f1f77bcf86cd799439015",
    "requested_data": {
      "expedia_amount_confirmed": 5000.50,
      "agoda_amount_confirmed": 3000.00,
      "booking_amount_confirmed": 2000.00
    },
    "reason": "Need to correct the amount based on final audit report",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses:**

`400 Bad Request` - Amount already set
```json
{
  "success": false,
  "message": "Cannot request update for expedia_amount_confirmed: Field has already been set",
  "error": ["Bad Request"]
}
```

`400 Bad Request` - No amount provided
```json
{
  "success": false,
  "message": "At least one amount_confirmed field must be provided",
  "error": ["Bad Request"]
}
```

`400 Bad Request` - Invalid password
```json
{
  "success": false,
  "message": "Invalid password",
  "error": ["Bad Request"]
}
```

`400 Bad Request` - Pending request already exists
```json
{
  "success": false,
  "message": "A pending update request already exists for this audit",
  "error": ["Bad Request"]
}
```

`403 Forbidden` - Internal user attempting to use this endpoint
```json
{
  "success": false,
  "message": "Only external users can request amount confirmed updates",
  "error": ["Forbidden"]
}
```

**Behavior Notes:**
- Password verification is required
- Only works when the amount_confirmed field is **not yet set** for that OTA type
- Creates a pending action with type `AUDIT_UPDATE_AMOUNT_CONFIRMED`
- Super admin must approve or reject the request
- Only one pending request per audit at a time

---

### 3. Approve Update Request (Super Admins)

Approve a pending amount confirmed update request.

**Endpoint:** `PATCH /pending-actions/:id/approve`

**Authentication:** Bearer Token (JWT)

**Permissions:**
- User Type: Super Admin only

**Request Headers:**
```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "password": "SuperAdminPassword123!"
}
```

**Success Response:** `200 OK`
```json
{
  "success": true,
  "message": "Action approved and executed successfully",
  "data": {
    "id": "507f1f77bcf86cd799439020",
    "type": "AUDIT_UPDATE_AMOUNT_CONFIRMED",
    "status": "APPROVED",
    "audit_id": "507f1f77bcf86cd799439011",
    "approved_by": "507f1f77bcf86cd799439014",
    "approved_at": "2024-01-15T11:00:00Z",
    "updated_audit": {
      "id": "507f1f77bcf86cd799439011",
      "expedia_amount_confirmed": 5000.50,
      "agoda_amount_confirmed": 3000.00,
      "booking_amount_confirmed": 2000.00
    }
  }
}
```

**Error Responses:**

`400 Bad Request` - Invalid password
```json
{
  "success": false,
  "message": "Invalid password",
  "error": ["Bad Request"]
}
```

`403 Forbidden` - Non-super-admin user
```json
{
  "success": false,
  "message": "Only super admins can approve pending actions",
  "error": ["Forbidden"]
}
```

`404 Not Found` - Pending action doesn't exist
```json
{
  "success": false,
  "message": "Pending action not found",
  "error": ["Not Found"]
}
```

**Behavior Notes:**
- Password verification is required
- Updates the audit's amount_confirmed fields with the requested values
- Marks the pending action as `APPROVED`
- Sets `approved_by` and `approved_at` timestamps

---

### 4. Reject Update Request (Super Admins)

Reject a pending amount confirmed update request.

**Endpoint:** `PATCH /pending-actions/:id/reject`

**Authentication:** Bearer Token (JWT)

**Permissions:**
- User Type: Super Admin only

**Request Headers:**
```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "password": "SuperAdminPassword123!",
  "rejection_reason": "Insufficient documentation provided. Please upload the final audit report."
}
```

**Fields:**
- `password` (required) - Super admin's password for verification
- `rejection_reason` (required) - Explanation for why the request was rejected

**Success Response:** `200 OK`
```json
{
  "success": true,
  "message": "Action rejected successfully",
  "data": {
    "id": "507f1f77bcf86cd799439020",
    "type": "AUDIT_UPDATE_AMOUNT_CONFIRMED",
    "status": "REJECTED",
    "audit_id": "507f1f77bcf86cd799439011",
    "rejected_by": "507f1f77bcf86cd799439014",
    "rejected_at": "2024-01-15T11:00:00Z",
    "rejection_reason": "Insufficient documentation provided. Please upload the final audit report."
  }
}
```

**Error Responses:**

`400 Bad Request` - Missing rejection reason
```json
{
  "success": false,
  "message": "Rejection reason is required",
  "error": ["Bad Request"]
}
```

`400 Bad Request` - Invalid password
```json
{
  "success": false,
  "message": "Invalid password",
  "error": ["Bad Request"]
}
```

`403 Forbidden` - Non-super-admin user
```json
{
  "success": false,
  "message": "Only super admins can reject pending actions",
  "error": ["Forbidden"]
}
```

---

### 5. List Pending Requests (Super Admins)

Retrieve all pending actions, including amount confirmed update requests.

**Endpoint:** `GET /pending-actions`

**Authentication:** Bearer Token (JWT)

**Permissions:**
- User Type: Super Admin only

**Request Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
```
?type=AUDIT_UPDATE_AMOUNT_CONFIRMED&status=PENDING&page=1&limit=10
```

**Parameters:**
- `type` (optional) - Filter by action type (e.g., `AUDIT_UPDATE_AMOUNT_CONFIRMED`)
- `status` (optional) - Filter by status (`PENDING`, `APPROVED`, `REJECTED`)
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 10)
- `sortBy` (optional) - Field to sort by
- `sortOrder` (optional) - Sort direction (`asc`, `desc`)

**Success Response:** `200 OK`
```json
{
  "success": true,
  "message": "Pending actions retrieved successfully",
  "data": [
    {
      "id": "507f1f77bcf86cd799439020",
      "type": "AUDIT_UPDATE_AMOUNT_CONFIRMED",
      "status": "PENDING",
      "audit_id": "507f1f77bcf86cd799439011",
      "audit": {
        "id": "507f1f77bcf86cd799439011",
        "property": {
          "id": "507f1f77bcf86cd799439025",
          "name": "Property A"
        }
      },
      "requested_by": {
        "id": "507f1f77bcf86cd799439015",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "requested_data": {
        "expedia_amount_confirmed": 5000.50,
        "agoda_amount_confirmed": 3000.00
      },
      "reason": "Need to correct the amount based on final audit report",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "metadata": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

**Example:** Get only pending amount confirmed requests
```
GET /pending-actions?type=AUDIT_UPDATE_AMOUNT_CONFIRMED&status=PENDING
```

---

### 6. Bulk Update via Excel (Internal Users)

Update multiple audits at once by uploading an Excel file.

**Endpoint:** `POST /audit/bulk-update`

**Authentication:** Bearer Token (JWT)

**Permissions:**
- Module: `audit`
- Action: `update`
- User Type: Internal users only

**Request Headers:**
```http
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```
file: [Excel file]
```

**Excel Columns (Amount Confirmed Fields):**
- `Expedia Amount Confirmed` / `Expedia Confirmed` / `expedia_amount_confirmed`
- `Agoda Amount Confirmed` / `Agoda Confirmed` / `agoda_amount_confirmed`
- `Booking Amount Confirmed` / `Booking Confirmed` / `booking_amount_confirmed`

**Required Column:**
- `Audit ID` / `Audit Id` / `Audit id` / `ID` / `Id` / `id` - ID of the audit to update

**Success Response:** `200 OK`
```json
{
  "success": true,
  "message": "Bulk update completed successfully",
  "data": {
    "totalRows": 10,
    "successCount": 8,
    "failureCount": 2,
    "errors": [
      {
        "row": 3,
        "auditId": "507f1f77bcf86cd799439011",
        "error": "Cannot update expedia_amount_confirmed: Field has already been set. Only super admins can update it."
      }
    ],
    "successfulUpdates": [
      "507f1f77bcf86cd799439012",
      "507f1f77bcf86cd799439013"
    ]
  }
}
```

**Behavior Notes:**
- Same amount_confirmed restrictions apply as direct update
- Non-super-admin internal users can only set each amount_confirmed once per OTA type
- Empty cells keep existing values unchanged
- Returns detailed success/failure information for each row

---

## Complete Workflow Examples

### Example 1: Super Admin Direct Update

```javascript
// Super admin updating audit amounts
const response = await fetch('/audit/507f1f77bcf86cd799439011', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    expedia_amount_confirmed: 4500.75,
    agoda_amount_confirmed: 2800.50,
    booking_amount_confirmed: 1900.25
  })
})
```

### Example 2: External User Request + Approval

**Step 1: External user submits request**
```javascript
// External user requesting amount update
const request = await fetch('/audit/507f1f77bcf86cd799439011/request-update-amount-confirmed', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    password: 'UserPassword123!',
    expedia_amount_confirmed: 5000.50,
    reason: 'Final audit report received'
  })
})

// Response includes pending action ID
const { data } = await request.json()
const pendingActionId = data.id
```

**Step 2: Super admin approves request**
```javascript
// Super admin approving the request
const approval = await fetch(`/pending-actions/${pendingActionId}/approve`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${superAdminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    password: 'SuperAdminPassword123!'
  })
})
```

### Example 3: Internal User First-Time Set

```javascript
// Internal user setting amount_confirmed for the first time
const response = await fetch('/audit/507f1f77bcf86cd799439011', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    expedia_amount_confirmed: 4500.75
  })
})

// If successful, this value can only be changed by super admin now
```

### Example 4: Listing Pending Requests

```javascript
// Super admin fetching all pending amount confirmed requests
const response = await fetch('/pending-actions?type=AUDIT_UPDATE_AMOUNT_CONFIRMED&status=PENDING', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${superAdminToken}`
  }
})

const { data, metadata } = await response.json()
// data contains array of pending requests
```

---

## Common Error Scenarios

### Scenario 1: Non-Super-Admin Trying to Update Already-Set Field

**Request:**
```json
PATCH /audit/507f1f77bcf86cd799439011
{
  "expedia_amount_confirmed": 6000
}
```

**Response (Internal User):**
```json
{
  "success": false,
  "message": "Cannot update expedia_amount_confirmed: Field has already been set. Only super admins can update it.",
  "error": ["Bad Request"]
}
```

**Solution:** User must request an update via the request endpoint, or a super admin must make the change.

### Scenario 2: External User Trying Direct Update

**Request:**
```json
PATCH /audit/507f1f77bcf86cd799439011
{
  "expedia_amount_confirmed": 6000
}
```

**Response:**
```json
{
  "success": false,
  "message": "Only internal users can update audits",
  "error": ["Forbidden"]
}
```

**Solution:** External user must use the request endpoint instead.

---

## Frontend Implementation Tips

### 1. Determine User Type and Permissions

Check the user's role to decide which endpoint to use:

```javascript
const isSuperAdmin = user.role.is_super_admin
const isInternalUser = user.role.is_internal_user
const isExternalUser = !isInternalUser

if (isSuperAdmin || isInternalUser) {
  // Use PATCH /audit/:id for direct update
} else if (isExternalUser) {
  // Use POST /audit/:id/request-update-amount-confirmed
}
```

### 2. Check if Amount Confirmed is Already Set

Before allowing non-super-admin users to update:

```javascript
if (audit.expedia_amount_confirmed !== null && !isSuperAdmin) {
  // Show error: "Field has already been set. Please contact super admin."
  return
}
```

### 3. Handle Pending Requests

For super admins, provide a UI to:
- List all pending `AUDIT_UPDATE_AMOUNT_CONFIRMED` requests
- View request details (who requested, values, reason)
- Approve or reject with password verification

### 4. Show Appropriate UI Based on Permissions

```javascript
// Example for audit edit form
{isSuperAdmin && (
  <input
    label="Expedia Amount Confirmed"
    value={expedia_amount_confirmed}
    onChange={handleChange}
    disabled={false}
    helperText="You can edit this field anytime"
  />
)}

{isInternalUser && !isSuperAdmin && (
  <input
    label="Expedia Amount Confirmed"
    value={expedia_amount_confirmed}
    onChange={handleChange}
    disabled={!!expedia_amount_confirmed}
    helperText={
      expedia_amount_confirmed
        ? "Field already set. Only super admin can modify."
        : "You can set this value once"
    }
  />
)}

{isExternalUser && (
  <button onClick={openRequestModal}>
    Request Update
  </button>
)}
```

### 5. Error Handling

Always handle these specific errors:
- `400` with message about field already set (non-super-admin)
- `403` for external users trying direct update
- `400` for invalid password
- `400` for pending request already exists

---

## Related Endpoints

- `GET /audit/:id` - Get audit details (check if amount_confirmed is set)
- `GET /audit` - List all audits with filtering
- `GET /pending-actions/:id` - Get specific pending action details

---

## Pending Action Types

When working with pending actions, the type for amount confirmed updates is:

```typescript
enum PendingActionType {
  AUDIT_UPDATE_AMOUNT_CONFIRMED  // Use this for filtering
}
```

Example filter:
```
GET /pending-actions?type=AUDIT_UPDATE_AMOUNT_CONFIRMED
```

---

## Summary Table

| Scenario | Endpoint | User Type | Password Required |
|----------|----------|-----------|-------------------|
| Direct update (field never set) | `PATCH /audit/:id` | Internal User | No |
| Direct update (field already set) | `PATCH /audit/:id` | Super Admin | No |
| Request update (field never set) | `POST /audit/:id/request-update-amount-confirmed` | External User | Yes |
| Approve request | `PATCH /pending-actions/:id/approve` | Super Admin | Yes |
| Reject request | `PATCH /pending-actions/:id/reject` | Super Admin | Yes |
| List pending requests | `GET /pending-actions` | Super Admin | No |
| Bulk update | `POST /audit/bulk-update` | Internal User | No |

---

## Additional Notes

1. **Password Verification**: External users must provide their password when requesting updates. Super admins must provide their password when approving/rejecting requests.

2. **One-Time Set for Non-Super-Admins**: Once an internal user (non-super-admin) sets an amount_confirmed field, only a super admin can modify it again. This is a business rule to prevent accidental overwrites.

3. **Request Limits**: Only one pending request per audit at a time. External users must wait for approval or rejection before submitting another request.

4. **Partial Updates**: All endpoints support partial updates. You can update one, two, or all three amount_confirmed fields in a single request.

5. **Null Values**: Amount confirmed fields can be `null` (unset). The restriction applies once a non-null value is set.

---

For questions or clarifications, please refer to the API documentation at `/api/docs` or contact the backend team.
