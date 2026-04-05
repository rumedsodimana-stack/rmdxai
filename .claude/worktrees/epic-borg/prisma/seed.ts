// ──────────────────────────────────────────────────────────────────────────────
//  Singularity PMS — Database Seed
//  Creates: 1 demo property, 1 GM user, and sample data for all modules.
// ──────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding Singularity PMS...');

  // ───────────────────────────────────────────
  //  PROPERTY
  // ───────────────────────────────────────────
  const property = await prisma.property.upsert({
    where: { slug: 'singularity-demo' },
    update: {},
    create: {
      name: 'Hotel Singularity Demo',
      slug: 'singularity-demo',
      address: '1 Infinity Loop',
      city: 'Cape Town',
      country: 'South Africa',
      phone: '+27 21 000 0000',
      email: 'info@singularitypms.com',
      website: 'https://singularitypms.com',
      timezone: 'Africa/Johannesburg',
      currency: 'ZAR',
      starRating: 5,
    },
  });
  console.log(`  ✓ Property: ${property.name} (${property.id})`);

  // ───────────────────────────────────────────
  //  GM USER
  // ───────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo1234!', 10);

  const gmUser = await prisma.user.upsert({
    where: { propertyId_email: { propertyId: property.id, email: 'demo@singularitypms.com' } },
    update: {},
    create: {
      propertyId: property.id,
      email: 'demo@singularitypms.com',
      passwordHash,
      firstName: 'Demo',
      lastName: 'GM',
      role: 'GM',
    },
  });
  console.log(`  ✓ GM User: ${gmUser.email} (password: Demo1234!)`);

  // Extra staff user for messaging/handover demos
  const staffUser = await prisma.user.upsert({
    where: { propertyId_email: { propertyId: property.id, email: 'staff@singularitypms.com' } },
    update: {},
    create: {
      propertyId: property.id,
      email: 'staff@singularitypms.com',
      passwordHash,
      firstName: 'Front',
      lastName: 'Desk',
      role: 'STAFF',
    },
  });
  console.log(`  ✓ Staff User: ${staffUser.email}`);

  // ───────────────────────────────────────────
  //  PMS — Room Types & Rooms
  // ───────────────────────────────────────────
  const rtDeluxe = await prisma.roomType.upsert({
    where: { propertyId_code: { propertyId: property.id, code: 'DELUXE' } },
    update: {},
    create: {
      propertyId: property.id,
      code: 'DELUXE',
      name: 'Deluxe Room',
      maxOccupancy: 2,
      baseRate: 1500,
      amenities: ['WiFi', 'Mini Bar', 'Sea View', 'Safe'],
      bedType: 'King',
      sizeSqm: 35,
    },
  });

  const rtSuite = await prisma.roomType.upsert({
    where: { propertyId_code: { propertyId: property.id, code: 'SUITE' } },
    update: {},
    create: {
      propertyId: property.id,
      code: 'SUITE',
      name: 'Executive Suite',
      maxOccupancy: 3,
      baseRate: 3200,
      amenities: ['WiFi', 'Full Bar', 'Private Balcony', 'Jacuzzi', 'Butler Service'],
      bedType: 'King',
      sizeSqm: 75,
    },
  });
  console.log('  ✓ Room types created');

  // Create rooms
  const rooms = await Promise.all([
    prisma.room.upsert({
      where: { propertyId_number: { propertyId: property.id, number: '101' } },
      update: {},
      create: { propertyId: property.id, roomTypeId: rtDeluxe.id, number: '101', floor: 1 },
    }),
    prisma.room.upsert({
      where: { propertyId_number: { propertyId: property.id, number: '102' } },
      update: {},
      create: { propertyId: property.id, roomTypeId: rtDeluxe.id, number: '102', floor: 1 },
    }),
    prisma.room.upsert({
      where: { propertyId_number: { propertyId: property.id, number: '501' } },
      update: {},
      create: { propertyId: property.id, roomTypeId: rtSuite.id, number: '501', floor: 5 },
    }),
  ]);
  console.log(`  ✓ ${rooms.length} rooms created`);

  // ───────────────────────────────────────────
  //  CRM — Guest Profile & Reservation
  // ───────────────────────────────────────────
  const guestProfile = await prisma.guestProfile.upsert({
    where: { id: 'seed-guest-001' },
    update: {},
    create: {
      id: 'seed-guest-001',
      propertyId: property.id,
      firstName: 'Jane',
      lastName: 'Singularity',
      email: 'jane@example.com',
      phone: '+27 82 000 0001',
      nationality: 'ZA',
      loyaltyTier: 'GOLD',
      loyaltyPoints: 1500,
      totalStays: 4,
      isVip: true,
      vipReason: 'Repeat guest — 4 stays',
    },
  });
  console.log(`  ✓ Guest profile: ${guestProfile.firstName} ${guestProfile.lastName}`);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);
  const checkOut = new Date(tomorrow);
  checkOut.setDate(checkOut.getDate() + 3);

  const reservation = await prisma.reservation.upsert({
    where: { confirmationNo: 'SPM-SEED-001' },
    update: {},
    create: {
      propertyId: property.id,
      guestProfileId: guestProfile.id,
      roomTypeId: rtDeluxe.id,
      confirmationNo: 'SPM-SEED-001',
      status: 'CONFIRMED',
      source: 'DIRECT',
      checkInDate: tomorrow,
      checkOutDate: checkOut,
      adults: 2,
      children: 0,
      rateCode: 'BAR',
      rateAmount: 1500,
      totalAmount: 4500,
      specialRequests: 'Late check-in, high floor preferred',
      arrivalTime: '22:00',
    },
  });
  console.log(`  ✓ Reservation: ${reservation.confirmationNo}`);

  // ───────────────────────────────────────────
  //  COMMS — Announcement & Message
  // ───────────────────────────────────────────
  const announcement = await prisma.announcement.create({
    data: {
      propertyId: property.id,
      authorId: gmUser.id,
      title: 'Welcome to Hotel Singularity PMS',
      body: 'The system is now live. Please review your department dashboards and report any issues to IT.',
      targetRoles: ['GM', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF'],
      targetDepts: [],
      isPinned: true,
    },
  });
  console.log(`  ✓ Announcement: "${announcement.title}"`);

  const message = await prisma.message.create({
    data: {
      propertyId: property.id,
      senderId: gmUser.id,
      recipientIds: [staffUser.id],
      subject: 'VIP Arrival Tomorrow',
      body: 'Jane Singularity (GOLD) arriving tomorrow at 22:00. Please ensure room 101 is ready with welcome amenities.',
      priority: 'urgent',
      status: 'SENT',
    },
  });
  console.log(`  ✓ Message created (${message.id})`);

  // ───────────────────────────────────────────
  //  GUEST APP — Service Request & Feedback
  // ───────────────────────────────────────────
  const serviceRequest = await prisma.serviceRequest.create({
    data: {
      propertyId: property.id,
      guestProfileId: guestProfile.id,
      category: 'housekeeping',
      title: 'Extra Pillows',
      description: 'Please provide 2 extra feather pillows for room 101.',
      status: 'OPEN',
      priority: 'normal',
    },
  });
  console.log(`  ✓ Service request: "${serviceRequest.title}"`);

  await prisma.guestFeedback.create({
    data: {
      propertyId: property.id,
      guestProfileId: guestProfile.id,
      overallRating: 9,
      cleanlinessRating: 10,
      serviceRating: 9,
      locationRating: 10,
      valueRating: 8,
      facilityRating: 9,
      comments: 'Exceptional experience. The sea view from room 101 was breathtaking.',
      isPublic: true,
    },
  });
  console.log('  ✓ Guest feedback created');

  // ───────────────────────────────────────────
  //  OS KERNEL — Automation Task & Event Log
  // ───────────────────────────────────────────
  await prisma.automationTask.create({
    data: {
      propertyId: property.id,
      name: 'Send Pre-arrival Email',
      description: 'Automatically send pre-arrival email 24h before check-in',
      triggerEvent: 'reservation.confirmed',
      automationLevel: 'L2',
      status: 'PENDING',
      payload: {
        reservationId: reservation.id,
        templateId: 'pre-arrival-v1',
        sendAt: tomorrow.toISOString(),
      },
      maxAttempts: 3,
      requiresHuman: false,
    },
  });

  await prisma.eventLog.create({
    data: {
      propertyId: property.id,
      eventType: 'reservation.confirmed',
      entityType: 'reservation',
      entityId: reservation.id,
      payload: {
        confirmationNo: reservation.confirmationNo,
        guestName: `${guestProfile.firstName} ${guestProfile.lastName}`,
        checkIn: tomorrow.toISOString(),
      },
      publishedBy: gmUser.id,
      processedBy: [],
    },
  });
  console.log('  ✓ Automation task + event log created');

  // ───────────────────────────────────────────
  //  MULTI-PROPERTY — Group
  // ───────────────────────────────────────────
  const propertyGroup = await prisma.propertyGroup.create({
    data: {
      name: 'Singularity Portfolio',
      description: 'Demo portfolio group for multi-property management',
      headOffice: 'Cape Town, South Africa',
    },
  });

  await prisma.propertyGroupMember.create({
    data: {
      propertyGroupId: propertyGroup.id,
      propertyId: property.id,
      role: 'flagship',
    },
  });
  console.log(`  ✓ Property group: "${propertyGroup.name}"`);

  // ───────────────────────────────────────────
  //  EVENTS — Event Booking, Function Sheet, Banquet Order
  // ───────────────────────────────────────────
  const eventStart = new Date();
  eventStart.setDate(eventStart.getDate() + 14);
  eventStart.setHours(9, 0, 0, 0);
  const eventEnd = new Date(eventStart);
  eventEnd.setHours(17, 0, 0, 0);

  const eventBooking = await prisma.eventBooking.create({
    data: {
      propertyId: property.id,
      bookingNumber: 'EVT-SEED-001',
      organizerName: 'Tech Summit Africa',
      organizerEmail: 'events@techsummit.co.za',
      organizerPhone: '+27 11 000 0002',
      eventName: 'Tech Summit Africa 2026',
      eventType: 'conference',
      status: 'CONFIRMED',
      startDateTime: eventStart,
      endDateTime: eventEnd,
      attendeesCount: 120,
      venueRooms: ['Grand Ballroom', 'Breakout Room A', 'Breakout Room B'],
      totalAmount: 85000,
      depositAmount: 25000,
      depositPaid: true,
    },
  });
  console.log(`  ✓ Event booking: "${eventBooking.eventName}"`);

  const functionSheet = await prisma.functionSheet.create({
    data: {
      propertyId: property.id,
      eventBookingId: eventBooking.id,
      venueName: 'Grand Ballroom',
      setupStyle: 'THEATER',
      capacityUsed: 120,
      startTime: eventStart,
      endTime: eventEnd,
      decorNotes: 'Corporate branding banners, centrepiece floral arrangements',
      avNotes: '2x projectors, 4x wireless mics, livestream setup required',
      cateringNotes: 'Morning tea + lunch buffet for 120 pax',
      staffNotes: 'Assign 2 event coordinators and 4 F&B staff',
      setupTime: new Date(eventStart.getTime() - 3 * 60 * 60 * 1000), // 3h before
      breakdownTime: new Date(eventEnd.getTime() + 2 * 60 * 60 * 1000), // 2h after
    },
  });

  await prisma.eventEquipment.createMany({
    data: [
      { functionSheetId: functionSheet.id, itemName: 'Projector Screen (16:9)', category: 'av', quantity: 2, unitCost: 500 },
      { functionSheetId: functionSheet.id, itemName: 'Wireless Microphone', category: 'av', quantity: 4, unitCost: 200 },
      { functionSheetId: functionSheet.id, itemName: 'Podium with Lectern', category: 'staging', quantity: 1, unitCost: 350 },
    ],
  });

  await prisma.roomSetupConfig.createMany({
    data: [
      { functionSheetId: functionSheet.id, roomName: 'Grand Ballroom', setupStyle: 'THEATER', capacity: 120 },
      { functionSheetId: functionSheet.id, roomName: 'Breakout Room A', setupStyle: 'CLASSROOM', capacity: 30 },
      { functionSheetId: functionSheet.id, roomName: 'Breakout Room B', setupStyle: 'BOARDROOM', capacity: 20 },
    ],
  });

  await prisma.banquetOrder.create({
    data: {
      propertyId: property.id,
      eventBookingId: eventBooking.id,
      orderNumber: 'BO-SEED-001',
      menuPackage: 'Conference Silver Package',
      perPersonCost: 350,
      totalGuests: 120,
      totalCost: 42000,
      dietaryNotes: '15 vegetarian, 3 vegan, 2 gluten-free',
      beveragePackage: 'Non-alcoholic full-day',
      staffRequired: 6,
    },
  });
  console.log('  ✓ Function sheet, equipment, room setups, banquet order created');

  // ───────────────────────────────────────────
  //  PROCUREMENT — Supplier, Inventory, PO
  // ───────────────────────────────────────────
  const supplier = await prisma.supplier.create({
    data: {
      propertyId: property.id,
      name: 'Cape Linen Supply Co.',
      contactName: 'Thabo Mokoena',
      email: 'orders@capelinen.co.za',
      phone: '+27 21 555 1234',
      address: '12 Textile Way, Woodstock, Cape Town',
      taxId: 'ZA4012345678',
      paymentTerms: 'Net 30',
    },
  });
  console.log(`  ✓ Supplier: ${supplier.name}`);

  const [itemLinen, itemTowel, itemShampoo] = await Promise.all([
    prisma.inventoryItem.upsert({
      where: { propertyId_sku: { propertyId: property.id, sku: 'LINEN-KING-WHITE' } },
      update: {},
      create: {
        propertyId: property.id,
        supplierId: supplier.id,
        sku: 'LINEN-KING-WHITE',
        name: 'King Bed Sheet Set (White)',
        category: 'linen',
        unit: 'set',
        currentStock: 24,
        reorderPoint: 10,
        reorderQty: 20,
        unitCost: 320,
      },
    }),
    prisma.inventoryItem.upsert({
      where: { propertyId_sku: { propertyId: property.id, sku: 'TOWEL-BATH-LG' } },
      update: {},
      create: {
        propertyId: property.id,
        supplierId: supplier.id,
        sku: 'TOWEL-BATH-LG',
        name: 'Bath Towel (Large, 700gsm)',
        category: 'linen',
        unit: 'each',
        currentStock: 8, // below reorder point — triggers alert
        reorderPoint: 20,
        reorderQty: 40,
        unitCost: 95,
      },
    }),
    prisma.inventoryItem.upsert({
      where: { propertyId_sku: { propertyId: property.id, sku: 'AMENITY-SHAMPOO-30ML' } },
      update: {},
      create: {
        propertyId: property.id,
        sku: 'AMENITY-SHAMPOO-30ML',
        name: 'Shampoo (30ml, Branded)',
        category: 'amenities',
        unit: 'each',
        currentStock: 200,
        reorderPoint: 100,
        reorderQty: 500,
        unitCost: 12,
      },
    }),
  ]);
  console.log('  ✓ Inventory items created (1 item below reorder point for alerts demo)');

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      propertyId: property.id,
      supplierId: supplier.id,
      orderNumber: 'PO-SEED-001',
      status: 'APPROVED',
      orderDate: new Date(),
      expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
      totalAmount: 4600,
      notes: 'Urgent restock — TOWEL-BATH-LG critically low',
      createdById: gmUser.id,
      approvedById: gmUser.id,
      approvedAt: new Date(),
      items: {
        create: [
          {
            inventoryItemId: itemTowel.id,
            quantity: 40,
            unitPrice: 95,
            totalPrice: 3800,
          },
          {
            inventoryItemId: itemLinen.id,
            quantity: 5,
            unitPrice: 160,
            totalPrice: 800,
          },
        ],
      },
    },
  });
  console.log(`  ✓ Purchase order: ${purchaseOrder.orderNumber} (APPROVED, ready to receive)`);

  // ───────────────────────────────────────────
  //  NOTIFICATION LOG
  // ───────────────────────────────────────────
  await prisma.notificationLog.create({
    data: {
      propertyId: property.id,
      recipientId: gmUser.id,
      channel: 'EMAIL',
      subject: 'Purchase Order PO-SEED-001 Approved',
      body: 'Your purchase order PO-SEED-001 has been approved. Expected delivery in 7 days.',
      isDelivered: true,
      deliveredAt: new Date(),
      referenceType: 'purchase_order',
      referenceId: purchaseOrder.id,
    },
  });
  console.log('  ✓ Notification log created');

  console.log('\n✅  Seed complete!');
  console.log('─────────────────────────────────────────────');
  console.log('  GM Login  → demo@singularitypms.com / Demo1234!');
  console.log(`  Property  → ${property.name} (id: ${property.id})`);
  console.log(`  Group     → ${propertyGroup.name} (id: ${propertyGroup.id})`);
  console.log('─────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
