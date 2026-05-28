# 05 — API Design

## 5.1 Overview

### Base URL
```
Production: https://api.propertyos.co.za/v1
Development: http://localhost:3001/v1
```

### API Conventions
- **REST** — Standard HTTP methods (GET, POST, PATCH, DELETE)
- **JSON** — Request and response bodies
- **JWT** — Bearer token authentication
- **Pagination** — `?page=1&limit=20` on list endpoints
- **Filtering** — Query parameters for filtering
- **Sorting** — `?sort=created_at&order=desc`
- **Versioning** — URL-based (`/v1/`)

### Standard Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "BOOK_DOUBLE_BOOKING",
    "message": "Room is not available for the requested dates",
    "statusCode": 409,
    "details": {
      "unavailableDates": ["2026-06-03", "2026-06-04"]
    }
  }
}
```

### Authentication Header
```
Authorization: Bearer <jwt_token>
```

---

## 5.2 Auth Endpoints

### POST /auth/register
Create a new user account.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+27821234567"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Smith"
    },
    "tokens": {
      "accessToken": "jwt...",
      "refreshToken": "jwt...",
      "expiresIn": 900
    }
  }
}
```

**Validation:**
- Email: valid format, unique
- Password: min 8 chars, 1 uppercase, 1 number
- Phone: valid SA format (+27...)

---

### POST /auth/login

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Smith",
      "properties": [
        {
          "id": "uuid",
          "name": "Seaside Guesthouse",
          "role": "owner"
        }
      ]
    },
    "tokens": {
      "accessToken": "jwt...",
      "refreshToken": "jwt...",
      "expiresIn": 900
    }
  }
}
```

---

### POST /auth/refresh

**Request:**
```json
{
  "refreshToken": "jwt..."
}
```

**Response (200):** New token pair

---

### POST /auth/forgot-password

**Request:**
```json
{
  "email": "john@example.com"
}
```

### POST /auth/reset-password

**Request:**
```json
{
  "token": "reset_token",
  "newPassword": "NewSecurePass123!"
}
```

---

## 5.3 Property Endpoints

> [!NOTE]
> All property endpoints require authentication. Users can only access properties they belong to.

### POST /properties
Create a new property.

**Request:**
```json
{
  "name": "Seaside Guesthouse",
  "propertyType": "guesthouse",
  "addressLine1": "123 Beach Road",
  "city": "Cape Town",
  "province": "Western Cape",
  "postalCode": "8001",
  "email": "info@seasideguesthouse.co.za",
  "phone": "+27211234567",
  "checkInTime": "14:00",
  "checkOutTime": "10:00",
  "currency": "ZAR"
}
```

**Response (201):** Created property with generated slug

---

### GET /properties
List all properties for the authenticated user.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Seaside Guesthouse",
      "slug": "seaside-guesthouse",
      "city": "Cape Town",
      "roomCount": 8,
      "isPublished": true,
      "role": "owner"
    }
  ]
}
```

---

### GET /properties/:propertyId
Get full property details.

### PATCH /properties/:propertyId
Update property details.

### GET /properties/:propertyId/dashboard
Get dashboard summary data.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "occupancyRate": 72.5,
    "revenueToday": 4800.00,
    "revenueMTD": 145000.00,
    "upcomingCheckIns": [
      {
        "bookingId": "uuid",
        "guestName": "Sarah Jones",
        "checkIn": "2026-06-01",
        "roomName": "Room 3",
        "nights": 3
      }
    ],
    "recentBookings": [ ... ],
    "bookingsBySource": {
      "direct": 45,
      "booking_com": 30,
      "airbnb": 15,
      "walk_in": 10
    }
  }
}
```

---

## 5.4 Room Endpoints

### POST /properties/:propertyId/room-types
Create a room type.

**Request:**
```json
{
  "name": "Deluxe Double",
  "description": "Spacious double room with sea view",
  "basePrice": 1500.00,
  "maxOccupancy": 2,
  "bedType": "queen",
  "sizeSqm": 28,
  "amenities": ["WiFi", "Air Conditioning", "Sea View", "Mini Bar"]
}
```

### GET /properties/:propertyId/room-types
List all room types.

### PATCH /room-types/:roomTypeId
Update room type.

### DELETE /room-types/:roomTypeId
Delete room type (only if no active rooms).

---

### POST /properties/:propertyId/rooms
Create a room.

**Request:**
```json
{
  "roomTypeId": "uuid",
  "name": "Room 1",
  "floor": "Ground"
}
```

### GET /properties/:propertyId/rooms
List all rooms (with type info).

**Query params:**
- `?includeAvailability=true&startDate=2026-06-01&endDate=2026-06-30`

### PATCH /rooms/:roomId
Update room.

### DELETE /rooms/:roomId
Deactivate room (soft delete — never hard delete rooms with bookings).

---

## 5.5 Availability Endpoints

### GET /properties/:propertyId/availability
Get availability for a date range.

**Query params:**
- `startDate` (required): YYYY-MM-DD
- `endDate` (required): YYYY-MM-DD
- `roomTypeId` (optional): filter by room type

**Response (200):**
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "roomId": "uuid",
        "roomName": "Room 1",
        "roomType": "Deluxe Double",
        "dates": [
          {
            "date": "2026-06-01",
            "status": "available",
            "price": 1500.00
          },
          {
            "date": "2026-06-02",
            "status": "booked",
            "price": 1500.00,
            "bookingId": "uuid",
            "guestName": "Sarah Jones"
          }
        ]
      }
    ]
  }
}
```

---

### POST /properties/:propertyId/availability/block
Block dates for a room.

**Request:**
```json
{
  "roomId": "uuid",
  "startDate": "2026-06-10",
  "endDate": "2026-06-15",
  "reason": "Owner personal use"
}
```

### POST /properties/:propertyId/availability/unblock
Unblock dates for a room.

**Request:**
```json
{
  "roomId": "uuid",
  "startDate": "2026-06-10",
  "endDate": "2026-06-15"
}
```

---

### POST /properties/:propertyId/availability/pricing
Update pricing for date ranges.

**Request:**
```json
{
  "roomTypeId": "uuid",
  "startDate": "2026-12-15",
  "endDate": "2026-01-05",
  "priceOverride": 2200.00,
  "name": "Festive Season"
}
```

---

## 5.6 Booking Endpoints (CORE)

### POST /bookings
Create a new booking (admin/manual).

**Request:**
```json
{
  "propertyId": "uuid",
  "roomId": "uuid",
  "checkIn": "2026-06-01",
  "checkOut": "2026-06-04",
  "guest": {
    "firstName": "Sarah",
    "lastName": "Jones",
    "email": "sarah@email.com",
    "phone": "+27821234567",
    "country": "ZA"
  },
  "guestCount": 2,
  "specialRequests": "Late check-in please",
  "source": "phone",
  "internalNotes": "Repeat guest, prefers room with garden view"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "referenceNumber": "POS-2026-0001",
    "propertyId": "uuid",
    "roomId": "uuid",
    "roomName": "Room 1",
    "guest": {
      "id": "uuid",
      "firstName": "Sarah",
      "lastName": "Jones",
      "email": "sarah@email.com"
    },
    "checkIn": "2026-06-01",
    "checkOut": "2026-06-04",
    "nights": 3,
    "nightlyRate": 1500.00,
    "totalPrice": 4500.00,
    "status": "confirmed",
    "source": "phone"
  }
}
```

**Business rules:**
- Validates room availability for all dates (transaction-safe)
- Creates guest record if new, links if existing (by email/phone)
- Locks room_availability rows
- Emits `BookingCreated` event (triggers notifications)

---

### GET /properties/:propertyId/bookings
List bookings with filters.

**Query params:**
- `status` — confirmed, checked_in, checked_out, cancelled
- `startDate`, `endDate` — Date range filter
- `source` — direct, booking_com, etc.
- `search` — Guest name or reference number
- `page`, `limit`, `sort`, `order`

---

### GET /bookings/:bookingId
Get full booking details including payment history.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "referenceNumber": "POS-2026-0001",
    "property": { "id": "uuid", "name": "Seaside Guesthouse" },
    "room": { "id": "uuid", "name": "Room 1", "type": "Deluxe Double" },
    "guest": { ... },
    "checkIn": "2026-06-01",
    "checkOut": "2026-06-04",
    "nights": 3,
    "nightlyRate": 1500.00,
    "totalPrice": 4500.00,
    "status": "confirmed",
    "source": "direct",
    "payments": [
      {
        "id": "uuid",
        "amount": 2250.00,
        "type": "deposit",
        "status": "completed",
        "provider": "payfast",
        "paidAt": "2026-05-28T10:30:00Z"
      }
    ],
    "notifications": [
      {
        "channel": "email",
        "template": "booking_confirmation",
        "status": "delivered",
        "sentAt": "2026-05-28T10:31:00Z"
      }
    ]
  }
}
```

---

### PATCH /bookings/:bookingId
Modify a booking.

**Request:**
```json
{
  "checkOut": "2026-06-05",
  "specialRequests": "Extended stay, please prepare room"
}
```

**Business rules:**
- Validates new dates for availability
- Recalculates pricing
- Updates room_availability
- Emits `BookingModified` event

---

### PATCH /bookings/:bookingId/status
Update booking status.

**Request:**
```json
{
  "status": "checked_in"
}
```

**Valid transitions:**
```
confirmed → checked_in → checked_out
confirmed → cancelled
confirmed → no_show
pending → confirmed → ...
```

---

### POST /bookings/:bookingId/cancel
Cancel a booking.

**Request:**
```json
{
  "reason": "Guest requested cancellation"
}
```

**Business rules:**
- Releases room_availability back to 'available'
- Triggers refund flow if applicable
- Emits `BookingCancelled` event
- Sends cancellation notifications

---

## 5.7 Public Booking Engine Endpoints

> [!IMPORTANT]
> These endpoints are PUBLIC (no auth required). They power the embeddable booking widget.

### GET /public/properties/:slug
Get public property info for booking widget.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "name": "Seaside Guesthouse",
    "description": "...",
    "coverImage": "https://...",
    "location": "Cape Town, Western Cape",
    "checkInTime": "14:00",
    "checkOutTime": "10:00",
    "roomTypes": [
      {
        "id": "uuid",
        "name": "Deluxe Double",
        "description": "...",
        "basePrice": 1500.00,
        "maxOccupancy": 2,
        "amenities": ["WiFi", "AC"],
        "photos": ["https://..."]
      }
    ]
  }
}
```

---

### GET /public/properties/:slug/availability
Check availability for guest booking.

**Query params:**
- `checkIn` (required): YYYY-MM-DD
- `checkOut` (required): YYYY-MM-DD
- `guests` (optional): number of guests

**Response (200):**
```json
{
  "success": true,
  "data": {
    "checkIn": "2026-06-01",
    "checkOut": "2026-06-04",
    "nights": 3,
    "availableRooms": [
      {
        "roomTypeId": "uuid",
        "roomTypeName": "Deluxe Double",
        "description": "...",
        "photos": ["https://..."],
        "amenities": ["WiFi", "AC"],
        "nightlyRate": 1500.00,
        "totalPrice": 4500.00,
        "availableCount": 3,
        "maxOccupancy": 2
      }
    ]
  }
}
```

---

### POST /public/bookings
Create a booking from the public widget.

**Request:**
```json
{
  "propertySlug": "seaside-guesthouse",
  "roomTypeId": "uuid",
  "checkIn": "2026-06-01",
  "checkOut": "2026-06-04",
  "guestCount": 2,
  "guest": {
    "firstName": "Sarah",
    "lastName": "Jones",
    "email": "sarah@email.com",
    "phone": "+27821234567"
  },
  "specialRequests": "Late check-in"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "bookingId": "uuid",
    "referenceNumber": "POS-2026-0001",
    "status": "pending",
    "totalPrice": 4500.00,
    "depositAmount": 2250.00,
    "paymentUrl": "https://www.payfast.co.za/eng/process?..."
  }
}
```

**Business rules:**
- Assigns best available room of the requested type
- Returns payment URL if deposit is required
- Booking status is `pending` until payment or confirmation
- Auto-cancels after 30 min if no payment received

---

## 5.8 Payment Endpoints

### POST /payments/initiate
Initiate a payment for a booking.

**Request:**
```json
{
  "bookingId": "uuid",
  "amount": 2250.00,
  "paymentType": "deposit",
  "provider": "payfast"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "paymentId": "uuid",
    "paymentUrl": "https://www.payfast.co.za/eng/process?...",
    "expiresAt": "2026-05-28T11:00:00Z"
  }
}
```

---

### POST /payments/webhook/payfast
PayFast IPN callback (server-to-server).

**PayFast sends:** Form-encoded payment notification
**Our system:** Validates signature, updates payment + booking status

---

### POST /payments/:paymentId/confirm-eft
Manually confirm an EFT payment (admin only).

**Request:**
```json
{
  "eftReference": "FNB-REF-12345",
  "notes": "Confirmed in bank statement"
}
```

---

### GET /properties/:propertyId/payments
List payments for a property.

**Query params:** `status`, `startDate`, `endDate`, `bookingId`

---

## 5.9 Notification Endpoints

### POST /notifications/send
Send a manual notification.

**Request:**
```json
{
  "bookingId": "uuid",
  "channel": "whatsapp",
  "template": "booking_confirmation"
}
```

### GET /properties/:propertyId/notifications
List notification history.

### PATCH /properties/:propertyId/notification-templates/:templateId
Update a notification template.

---

## 5.10 Guest Endpoints

### GET /properties/:propertyId/guests
List guests with search.

**Query params:** `search`, `page`, `limit`

### GET /guests/:guestId
Get guest details with booking history.

### PATCH /guests/:guestId
Update guest details.

---

## 5.11 Reporting Endpoints

### GET /properties/:propertyId/reports/occupancy
**Query params:** `startDate`, `endDate`, `groupBy` (day/week/month)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "overall": {
      "occupancyRate": 72.5,
      "totalNightsAvailable": 450,
      "totalNightsSold": 326
    },
    "periods": [
      {
        "period": "2026-06",
        "occupancyRate": 78.3,
        "nightsSold": 188
      }
    ],
    "byRoomType": [
      {
        "roomType": "Deluxe Double",
        "occupancyRate": 85.2,
        "nightsSold": 153
      }
    ]
  }
}
```

### GET /properties/:propertyId/reports/revenue
**Query params:** `startDate`, `endDate`, `groupBy`

### GET /properties/:propertyId/reports/bookings-by-source
Source breakdown (direct vs OTA).

---

## 5.12 Settings Endpoints

### GET /properties/:propertyId/settings
Get all property settings.

### PATCH /properties/:propertyId/settings/payment
Update payment settings (PayFast, EFT details).

### PATCH /properties/:propertyId/settings/notifications
Update notification preferences.

### PATCH /properties/:propertyId/settings/booking
Update booking settings (deposit %, cancellation policy, min/max stay).

---

## 5.13 Channel Manager Endpoints (Phase 2)

### POST /properties/:propertyId/channels/connect
Connect an OTA channel.

### DELETE /properties/:propertyId/channels/:channelId
Disconnect a channel.

### POST /properties/:propertyId/channels/:channelId/sync
Trigger manual sync.

### GET /properties/:propertyId/channels/:channelId/status
Get sync status and logs.

### POST /channels/webhook/booking-com
Booking.com push notification webhook.

### POST /channels/webhook/airbnb
Airbnb push notification webhook.

---

## 5.14 Rate Limiting

| Endpoint Group | Rate Limit |
|---|---|
| Auth (login/register) | 5 requests/min per IP |
| Public booking | 30 requests/min per IP |
| Admin API | 100 requests/min per user |
| Webhooks | 200 requests/min per source |
| Reports | 10 requests/min per user |
