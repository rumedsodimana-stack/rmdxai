# Singularity OS — Open Facility Monetization Channel Architecture

> **Design system:** Dark glassmorphism · Teal `#14b8a6` · DM Sans
> **Version:** 1.0 · April 2026
> **Status:** Architecture Proposal

---

## 1. Current State Audit

### What Exists

| Module | Location | Status | Channel-Ready? |
|--------|----------|--------|----------------|
| **Channel Manager** | `src/channel/` | Built | Rooms only |
| **PMS** (Rooms) | `src/pms/` | Built | Yes (via channel module) |
| **POS / F&B** | `src/pos/` | Built | No |
| **Events / Banquet** | `src/events/` | Built | No |
| **CRM** | `src/crm/` | Built | No |
| **Finance** | `src/finance/` | Built | No |
| **RMS** | `src/rms/` | Built | No |
| **BMS** | `src/bms/` | Built | No |
| **HCM** | `src/hcm/` | Built | No |
| **Procurement** | `src/procurement/` | Built | No |
| **Security** | `src/security/` | Built | No |
| **Comms** | `src/comms/` | Built | No |
| **Guest App** | `src/guest-app/` | Built | No |
| **Multi-property** | `src/multi-property/` | Built | No |
| **OS Kernel** | `src/os-kernel/` | Built | No |
| **Spa** | — | Missing | — |
| **Gym / Pool / Beach** | — | Missing | — |
| **Activities** | — | Missing | — |
| **Transfers / Parking** | — | Missing | — |

### What the Channel Manager Does Today

The existing `src/channel/` module manages:

- **Rate Plans** — room-type-linked rates with meal plans, LOS restrictions, cancellation policies
- **Channel Connections** — OTA provider credentials (`BOOKING_COM`, `EXPEDIA`, `AIRBNB`, `HOTELS_COM`, `AGODA`, `DIRECT`)
- **Rate Mapping** — maps internal rate plans to OTA rate codes with markup
- **Availability Sync** — Bull queue with 3-retry exponential backoff
- **Rate Push** — bulk rate publishing over date ranges
- **Sync Queue Monitor** — status tracking + retry for failed jobs
- **Availability Calendar** — per-room-type cross-channel view

### The Gap

The channel manager is **room-only**. Every other revenue-generating facility (dining, spa, pool, events, parking, activities, transfers, beach) has zero channel integration. There is no concept of a "facility toggle" — hotels cannot choose what to list or where. TravelBook has no integration point.

---

## 2. Architecture Vision

### Core Principle

> Every bookable facility in Singularity OS is a **channel listing**. The hotel decides which facilities appear on which platforms. No new OTA or new facility type should require core architecture changes.

### Three Separation Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 — Module Layer                                          │
│  Each Singularity OS module owns its facilities                  │
│  (PMS → rooms, POS → outlets, Events → spaces, ...)             │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2 — Channel Registry (src/channel/)                       │
│  Facility-agnostic: FacilityListing + ChannelToggle              │
│  Owns: what's enabled, on which channel, with what config        │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3 — Platform Adapters                                     │
│  TravelBook adapter, Booking.com adapter, Expedia adapter, etc.  │
│  Each adapter transforms Singularity payloads to platform format │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### 3.1 New Prisma Enums

```prisma
enum FacilityType {
  ROOM          // src/pms — RoomType
  DINING        // src/pos — Outlet
  SPA           // future spa module — Treatment/Package
  GYM           // future — GymSession
  POOL          // future — PoolSlot
  BEACH         // future — BeachCabana
  EVENT_SPACE   // src/events — EventSpace/BanquetRoom
  TRANSFER      // future — TransferRoute
  PARKING       // future — ParkingSlot
  ACTIVITY      // future — Activity
}

enum ListingStatus {
  DRAFT         // configured but not yet pushed
  ACTIVE        // live on the channel
  PAUSED        // temporarily hidden (e.g. renovations)
  REMOVED       // delisted from channel
}

enum FacilitySyncType {
  LISTING       // create/update the listing on the OTA
  AVAILABILITY  // push availability/slots
  PRICING       // push updated prices
  REMOVAL       // delist the facility
}
```

### 3.2 FacilityChannelListing

The single source of truth for what any Singularity OS facility shows on any channel.

```prisma
model FacilityChannelListing {
  id                  String            @id @default(cuid())
  propertyId          String
  channelConnectionId String

  // What facility
  facilityType        FacilityType
  facilityId          String            // FK into owning module (roomTypeId, outletId, etc.)
  facilityName        String            // denormalized for display without joins

  // Toggle state
  status              ListingStatus     @default(DRAFT)
  isEnabled           Boolean           @default(false)

  // Platform-specific config (pricing overrides, descriptions, photos, etc.)
  // Shape varies by facilityType — each module defines its own config schema
  config              Json              @default("{}")

  // Sync tracking
  lastSyncedAt        DateTime?
  lastSyncStatus      SyncStatus?
  externalId          String?           // ID assigned by the OTA once listed

  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  property            Property          @relation(fields: [propertyId], references: [id])
  channelConnection   ChannelConnection @relation(fields: [channelConnectionId], references: [id], onDelete: Cascade)

  @@unique([channelConnectionId, facilityType, facilityId])
  @@index([propertyId, facilityType])
  @@index([propertyId, isEnabled])
}
```

### 3.3 FacilityAvailabilitySlot

Generic availability model that replaces the room-specific `AvailabilityBlock` for non-room facilities.

```prisma
model FacilityAvailabilitySlot {
  id                    String                 @id @default(cuid())
  propertyId            String
  listingId             String

  date                  DateTime               @db.Date
  startTime             String?                // "09:00" — null for all-day (rooms, parking)
  endTime               String?                // "11:00"
  capacity              Int                    // max bookings for this slot
  booked                Int                    @default(0)
  price                 Decimal                @db.Decimal(10, 2)
  isClosed              Boolean                @default(false)

  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt

  listing               FacilityChannelListing @relation(fields: [listingId], references: [id], onDelete: Cascade)

  @@unique([listingId, date, startTime])
  @@index([listingId, date])
}
```

### 3.4 FacilityChannelSyncQueue

Unified sync queue for all facility types (extends existing `ChannelSyncQueue`).

```prisma
model FacilityChannelSyncQueue {
  id            String            @id @default(cuid())
  propertyId    String
  listingId     String
  syncType      FacilitySyncType
  payload       Json
  status        SyncStatus        @default(PENDING)
  attempts      Int               @default(0)
  maxAttempts   Int               @default(3)
  lastError     String?
  processedAt   DateTime?

  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  listing       FacilityChannelListing @relation(fields: [listingId], references: [id])

  @@index([propertyId, status])
  @@index([listingId])
}
```

### 3.5 Existing ChannelConnection Extension

Add `TRAVELBOOK` to the `ChannelProvider` enum (and any future OTAs here — the rest of the system auto-adapts):

```prisma
enum ChannelProvider {
  BOOKING_COM
  EXPEDIA
  AIRBNB
  HOTELS_COM
  AGODA
  TRAVELBOOK     // ← add
  DIRECT
}
```

---

## 4. Module Contracts

Each Singularity OS module that owns facilities must implement the `FacilityProvider` interface. This is how the Channel Registry discovers what's available to list.

### 4.1 FacilityProvider Interface

```typescript
// src/channel/interfaces/facility-provider.interface.ts

export interface FacilityDescriptor {
  facilityId: string;
  facilityType: FacilityType;
  name: string;
  description?: string;
  photos?: string[];
  // Type-specific fields via discriminated union
  metadata: RoomFacilityMeta | DiningFacilityMeta | EventFacilityMeta | GenericFacilityMeta;
}

export interface RoomFacilityMeta {
  type: 'ROOM';
  roomTypeCode: string;
  maxOccupancy: number;
  bedConfiguration: string;
  amenities: string[];
}

export interface DiningFacilityMeta {
  type: 'DINING';
  outletType: string;       // restaurant, bar, pool_bar, room_service, etc.
  cuisine?: string;
  covers: number;           // seating capacity
  openTime: string;
  closeTime: string;
  hasDelivery: boolean;
  hasReservation: boolean;
}

export interface EventFacilityMeta {
  type: 'EVENT_SPACE';
  maxCapacity: number;
  setupStyles: string[];    // theater, classroom, banquet, cocktail, etc.
  sqm: number;
  hasAV: boolean;
}

export interface GenericFacilityMeta {
  type: 'SPA' | 'GYM' | 'POOL' | 'BEACH' | 'TRANSFER' | 'PARKING' | 'ACTIVITY';
  [key: string]: unknown;
}

export interface FacilityProvider {
  facilityType: FacilityType;

  /** Return all listable facilities for a property */
  listFacilities(propertyId: string): Promise<FacilityDescriptor[]>;

  /** Return a single facility's current availability for a date range */
  getAvailability(
    facilityId: string,
    fromDate: string,
    toDate: string,
  ): Promise<FacilityAvailabilityPayload[]>;

  /** Called by the Channel Registry when a booking arrives from an OTA */
  handleInboundBooking(
    facilityId: string,
    booking: InboundFacilityBooking,
  ): Promise<{ confirmed: boolean; internalId: string }>;
}
```

### 4.2 Module Registration (NestJS)

Each module registers itself with the Channel Registry on startup:

```typescript
// src/pos/pos.module.ts — example for F&B

@Module({
  providers: [
    PosService,
    {
      provide: FACILITY_PROVIDER_TOKEN,
      useClass: PosFacilityProvider,   // implements FacilityProvider
      multi: true,
    },
  ],
})
export class PosModule {}
```

The Channel Registry collects all `FACILITY_PROVIDER_TOKEN` providers and builds a map keyed by `FacilityType`. No hardcoding required — new modules self-register.

---

## 5. API Contract

### 5.1 Singularity OS → Channel Registry (Internal)

These are hotel-facing endpoints. The GM/Admin uses these to configure what to list.

```
# Discovery — what can be listed?
GET  /channel/facilities
     ?propertyId=...
     &type=ROOM|DINING|SPA|...    (optional filter)
     → FacilityDescriptor[]

# Toggle a facility on/off for a channel
POST /channel/listings
     Body: { channelConnectionId, facilityType, facilityId, config }
     → FacilityChannelListing

PATCH /channel/listings/:listingId
      Body: { isEnabled?, config?, status? }
      → FacilityChannelListing

DELETE /channel/listings/:listingId
       → 204 (triggers REMOVAL sync)

# View all listings for a property
GET /channel/listings
    ?propertyId=...
    &channelConnectionId=...     (optional)
    &facilityType=...            (optional)
    &status=ACTIVE|DRAFT|...     (optional)
    → FacilityChannelListing[]

# Availability management
POST /channel/listings/:listingId/availability
     Body: FacilityAvailabilitySlot[]
     → { slotsUpserted: number, syncQueued: boolean }

GET  /channel/listings/:listingId/availability
     ?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
     → FacilityAvailabilitySlot[]

# Manual sync trigger
POST /channel/listings/:listingId/sync
     Body: { syncType: 'LISTING'|'AVAILABILITY'|'PRICING' }
     → { syncQueueId: string, status: 'PENDING' }

# Bulk sync for a channel
POST /channel/connections/:connectionId/sync-all
     Body: { facilityTypes?: FacilityType[], syncType: FacilitySyncType }
     → { queued: number }
```

### 5.2 TravelBook (OTA) → Singularity OS (External / Public)

TravelBook pulls inventory and pushes bookings through these endpoints. The same contract applies to any OTA.

```
Base: https://api.singularityos.io/v1
Auth: Bearer token (per ChannelConnection.credentials)

# Pull all active listings for a property
GET /ota/properties/:propertyHotelId/listings
    → OtaListingResponse[]

# Pull availability for a specific listing
GET /ota/listings/:externalId/availability
    ?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
    → OtaAvailabilityResponse

# Create a booking (OTA → Singularity OS)
POST /ota/bookings
     Body: OtaBookingRequest
     → OtaBookingConfirmation

# Cancel a booking
DELETE /ota/bookings/:otaBookingId
       → { cancelled: boolean }

# Singularity OS → TravelBook webhook (push, async)
POST {travelbook_webhook_url}
     Events:
       listing.created    — new facility enabled on TravelBook
       listing.updated    — config/pricing changed
       listing.removed    — facility delisted
       availability.updated — slot changes
       booking.confirmed  — Singularity OS confirmed an inbound booking
       booking.cancelled  — cancellation from within Singularity OS
```

### 5.3 OTA Listing Response Shape

```typescript
interface OtaListingResponse {
  externalId: string;             // Singularity listing ID
  facilityType: FacilityType;
  name: string;
  description?: string;
  photos: string[];
  pricing: {
    basePrice: number;
    currency: string;
    unit: 'per_night' | 'per_person' | 'per_session' | 'per_slot';
    taxInclusive: boolean;
  };
  availability: {
    nextAvailableDate: string;
    totalCapacity: number;
  };
  metadata: Record<string, unknown>;  // facility-type-specific, defined per adapter
}

interface OtaBookingRequest {
  listingExternalId: string;
  facilityType: FacilityType;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  date: string;                   // YYYY-MM-DD
  startTime?: string;             // HH:mm — required for timed facilities
  quantity: number;               // rooms, covers, slots, etc.
  otaBookingRef: string;          // OTA's own reference
  totalAmount: number;
  currency: string;
  notes?: string;
}

interface OtaBookingConfirmation {
  singularityBookingId: string;
  otaBookingRef: string;
  status: 'CONFIRMED' | 'WAITLISTED' | 'FAILED';
  message?: string;
}
```

---

## 6. Integration Flow — Singularity OS ↔ TravelBook

### 6.1 Hotel Enables a Facility (Outbound)

```
Hotel GM (Singularity OS UI)
  │
  ├─ 1. Opens "Channel Manager" → "Facility Listings"
  │       UI shows all property facilities grouped by type
  │       (glassmorphism panel, teal toggles per channel)
  │
  ├─ 2. Toggles "The Terrace Restaurant" ON for TravelBook
  │       → POST /channel/listings
  │         { channelConnectionId: "<travelbook-conn-id>",
  │           facilityType: "DINING",
  │           facilityId: "<outlet-id>",
  │           config: { priceOverride: null, description: "...", photos: [...] } }
  │
  ├─ 3. Channel Registry creates FacilityChannelListing (status: DRAFT)
  │       → Enqueues Bull job: type=LISTING, syncType=LISTING
  │
  ├─ 4. TravelBook Adapter processes the job:
  │       → Calls PosFacilityProvider.listFacilities() to get full descriptor
  │       → Transforms to OtaListingResponse shape
  │       → POST {travelbook_base}/api/listings (TravelBook ingest API)
  │       → Receives externalId from TravelBook
  │       → Updates FacilityChannelListing.externalId + status=ACTIVE
  │
  └─ 5. TravelBook shows "The Terrace Restaurant" on the marketplace
```

### 6.2 Guest Books on TravelBook (Inbound)

```
Guest (TravelBook)
  │
  ├─ 1. Browses "The Terrace Restaurant" listing
  │       Sees: photos, description, availability calendar, pricing
  │       TravelBook pulls /ota/listings/:externalId/availability in real-time
  │
  ├─ 2. Selects date + covers + timeslot → Books
  │       TravelBook → POST /ota/bookings (Singularity OS)
  │       Body: { listingExternalId, facilityType: "DINING", date, startTime,
  │               quantity: 4, guestName, guestEmail, otaBookingRef }
  │
  ├─ 3. Singularity OS OTA controller receives booking:
  │       → Resolves listing → outletId
  │       → Calls PosFacilityProvider.handleInboundBooking(outletId, booking)
  │       → POS module creates: Reservation (or table hold) in POS system
  │       → Decrements FacilityAvailabilitySlot.booked for that date/time
  │
  ├─ 4. Singularity OS responds:
  │       → { singularityBookingId, otaBookingRef, status: "CONFIRMED" }
  │
  ├─ 5. Singularity OS pushes webhook to TravelBook:
  │       POST {travelbook_webhook_url}
  │       Event: booking.confirmed
  │       Body: { bookingId, guestName, date, covers, restaurantName, confirmationCode }
  │
  └─ 6. TravelBook shows guest: "Booking confirmed at The Terrace ✓"
         Guest receives email with confirmation code from both platforms
```

### 6.3 Availability Update (Bidirectional Sync)

```
Singularity OS (any trigger: new booking, block, renovation)
  │
  ├─ Source of truth: FacilityAvailabilitySlot table
  │
  ├─ Change detected (via DB trigger or service call)
  │   → POST /channel/listings/:listingId/sync
  │     { syncType: "AVAILABILITY" }
  │   → Enqueues FacilityChannelSyncQueue entry
  │
  ├─ TravelBook Adapter:
  │   → GET availability from FacilityAvailabilitySlot
  │   → Pushes diff to TravelBook API (or full range)
  │   → Updates lastSyncedAt
  │
  └─ TravelBook calendar reflects new availability within seconds
```

---

## 7. Platform Adapter Pattern

Each OTA target gets its own adapter class. Adapters live in `src/channel/adapters/`.

```typescript
// src/channel/adapters/adapter.interface.ts

export interface ChannelAdapter {
  provider: ChannelProvider;

  /** Push a listing to the OTA. Returns the OTA's external ID. */
  publishListing(
    connection: ChannelConnection,
    listing: FacilityChannelListing,
    descriptor: FacilityDescriptor,
  ): Promise<{ externalId: string }>;

  /** Update availability on the OTA */
  pushAvailability(
    connection: ChannelConnection,
    listing: FacilityChannelListing,
    slots: FacilityAvailabilitySlot[],
  ): Promise<void>;

  /** Remove a listing from the OTA */
  removeListing(
    connection: ChannelConnection,
    listing: FacilityChannelListing,
  ): Promise<void>;
}

// src/channel/adapters/travelbook.adapter.ts
@Injectable()
export class TravelbookAdapter implements ChannelAdapter {
  provider = ChannelProvider.TRAVELBOOK;
  // ... implementation
}

// src/channel/adapters/booking-com.adapter.ts
@Injectable()
export class BookingComAdapter implements ChannelAdapter {
  provider = ChannelProvider.BOOKING_COM;
  // OTA XML/JSON API — rooms only initially, expand to facilities
}
```

The `ChannelSyncProcessor` resolves the correct adapter at runtime:

```typescript
@Process('facility-sync')
async handleFacilitySync(job: Job<FacilitySyncJobData>) {
  const adapter = this.adapterRegistry.get(job.data.provider);
  const provider = this.facilityProviderRegistry.get(job.data.facilityType);

  const descriptor = await provider.listFacilities(job.data.propertyId);
  await adapter.publishListing(connection, listing, descriptor);
}
```

---

## 8. UI Design Spec

> Dark glassmorphism · Teal `#14b8a6` · DM Sans

### Channel Manager — Facility Listings Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CHANNEL MANAGER                              [+ Add Channel Connection]     │
│  Shangri-La Maldives                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ACTIVE CHANNELS                                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│  │ TravelBook       │  │ Booking.com      │  │ Expedia          │         │
│  │ ● Connected      │  │ ● Connected      │  │ ○ Inactive       │         │
│  │ 6 listings live  │  │ 1 listing live   │  │ —                │         │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘         │
│                                                                             │
│  FACILITY LISTINGS · TravelBook ▾                                           │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ROOMS                                                                      │
│  ┌─────────────────────────────────────────────── ─────────────────────┐   │
│  │ Deluxe Ocean Villa          ████████████████ ●──── [ACTIVE]  [Edit] │   │
│  │ Garden Pool Suite           ████████████████ ●──── [ACTIVE]  [Edit] │   │
│  │ Beach Residence             ════════════════ ○──── [DRAFT]   [Edit] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  DINING                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ The Terrace Restaurant      ████████████████ ●──── [ACTIVE]  [Edit] │   │
│  │ Aqua Bar                    ════════════════ ○──── [OFF]     [Edit] │   │
│  │ In-Villa Dining             ════════════════ ○──── [OFF]     [Edit] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  EVENTS                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Lagoon Ballroom             ████████████████ ●──── [ACTIVE]  [Edit] │   │
│  │ Sunset Pavilion             ════════════════ ○──── [OFF]     [Edit] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  SPA · GYM · ACTIVITIES · TRANSFERS · PARKING                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ [These modules are not yet configured]   [Set Up Modules →]        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Teal toggle = active/enabled
Gray toggle  = off/draft
████ bar    = glassmorphism card, backdrop-blur, border rgba(255,255,255,0.1)
```

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--teal` | `#14b8a6` | Active toggles, CTAs, highlights |
| `--surface` | `rgba(255,255,255,0.05)` | Glass card backgrounds |
| `--border` | `rgba(255,255,255,0.10)` | Card borders |
| `--text-primary` | `#f1f5f9` | Headings |
| `--text-muted` | `#94a3b8` | Labels, secondary |
| `--success` | `#22c55e` | Connected status |
| `--warning` | `#f59e0b` | Sync pending |
| `--error` | `#ef4444` | Sync failed |

---

## 9. Implementation Roadmap

### Phase 1 — Extend Channel Module (Rooms → Facilities)
- [ ] Add `FacilityType`, `ListingStatus`, `FacilitySyncType` enums to `schema.prisma`
- [ ] Add `FacilityChannelListing` and `FacilityAvailabilitySlot` models
- [ ] Add `TRAVELBOOK` to `ChannelProvider` enum
- [ ] Create `FacilityProvider` interface in `src/channel/interfaces/`
- [ ] Create `FacilityChannelService` in `src/channel/`
- [ ] Create `FacilityChannelController` with all listing endpoints
- [ ] Update `ChannelSyncProcessor` to handle `facility-sync` job type

### Phase 2 — Module Adapters
- [ ] Implement `RoomFacilityProvider` in `src/pms/` (wraps existing RoomType logic)
- [ ] Implement `DiningFacilityProvider` in `src/pos/` (wraps Outlet model)
- [ ] Implement `EventFacilityProvider` in `src/events/`
- [ ] Register all providers via `FACILITY_PROVIDER_TOKEN`

### Phase 3 — OTA Adapters
- [ ] Create `src/channel/adapters/adapter.interface.ts`
- [ ] Implement `TravelbookAdapter` with full publish/availability/remove lifecycle
- [ ] Implement `BookingComAdapter` (rooms only, extend to facilities later)
- [ ] Create `AdapterRegistry` injectable

### Phase 4 — External API (TravelBook-facing)
- [ ] Create `src/ota/` module with public endpoints
- [ ] Implement `/ota/properties/:id/listings`
- [ ] Implement `/ota/listings/:id/availability`
- [ ] Implement `/ota/bookings` (inbound booking handler)
- [ ] Implement webhook dispatcher (Singularity OS → TravelBook)
- [ ] Add per-OTA API key authentication

### Phase 5 — UI
- [ ] Channel Manager redesign: facility grid with per-channel toggles
- [ ] Listing config drawer: per-facility pricing, photos, descriptions
- [ ] Availability calendar (extends existing room calendar to all facility types)
- [ ] Sync status dashboard with retry UI

---

## 10. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Facility registry pattern | `FACILITY_PROVIDER_TOKEN` multi-provider | Modules self-register; no central hardcoding |
| Availability model | Generic `FacilityAvailabilitySlot` with optional `startTime` | Covers rooms (all-day) and timed facilities (spa, dining) |
| External ID storage | `externalId` on `FacilityChannelListing` | Allows cross-reference for updates/cancellations without OTA coupling |
| Booking ingest | Module `handleInboundBooking()` | Each module owns its booking logic; channel layer stays thin |
| Sync queue | Extend Bull queue with `facilityType` discriminator | Reuses existing retry/backoff infrastructure |
| Multi-OTA | Adapter pattern with `ChannelProvider` enum | Adding a new OTA = new adapter class + enum value, zero other changes |
| TravelBook channel | `ChannelProvider.TRAVELBOOK` + dedicated adapter | TravelBook is a first-class OTA, not a special case |
