export enum Permission {
  // Front desk & calendar
  BOOKINGS_VIEW = 'bookings:view',
  BOOKINGS_MANAGE = 'bookings:manage',

  // Inventory (rooms, rates, availability)
  INVENTORY_VIEW = 'inventory:view',
  INVENTORY_MANAGE = 'inventory:manage',

  // Guests
  GUESTS_VIEW = 'guests:view',
  GUESTS_MANAGE = 'guests:manage',

  // Payments & invoices
  PAYMENTS_VIEW = 'payments:view',
  PAYMENTS_MANAGE = 'payments:manage',

  // Reports
  REPORTS_VIEW = 'reports:view',

  // Housekeeping
  HOUSEKEEPING_VIEW = 'housekeeping:view',
  HOUSEKEEPING_MANAGE = 'housekeeping:manage',

  // Channels (OTA connections, iCal sync)
  CHANNELS_VIEW = 'channels:view',
  CHANNELS_MANAGE = 'channels:manage',

  // Pricing rules
  PRICING_VIEW = 'pricing:view',
  PRICING_MANAGE = 'pricing:manage',

  // Property settings
  SETTINGS_VIEW = 'settings:view',
  SETTINGS_MANAGE = 'settings:manage',

  // Staff management
  STAFF_VIEW = 'staff:view',
  STAFF_MANAGE = 'staff:manage',

  // Audit log
  AUDIT_VIEW = 'audit:view',

  // Front desk / folio
  FRONTDESK_VIEW = 'frontdesk:view',
  FRONTDESK_MANAGE = 'frontdesk:manage',

  // Notifications
  NOTIFICATIONS_VIEW = 'notifications:view',
  NOTIFICATIONS_MANAGE = 'notifications:manage',
}

export const ALL_PERMISSIONS = Object.values(Permission);

export const DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  owner: [...ALL_PERMISSIONS],

  manager: [
    Permission.BOOKINGS_VIEW,
    Permission.BOOKINGS_MANAGE,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_MANAGE,
    Permission.GUESTS_VIEW,
    Permission.GUESTS_MANAGE,
    Permission.PAYMENTS_VIEW,
    Permission.PAYMENTS_MANAGE,
    Permission.REPORTS_VIEW,
    Permission.HOUSEKEEPING_VIEW,
    Permission.HOUSEKEEPING_MANAGE,
    Permission.CHANNELS_VIEW,
    Permission.CHANNELS_MANAGE,
    Permission.PRICING_VIEW,
    Permission.PRICING_MANAGE,
    Permission.SETTINGS_VIEW,
    Permission.FRONTDESK_VIEW,
    Permission.FRONTDESK_MANAGE,
    Permission.NOTIFICATIONS_VIEW,
    Permission.NOTIFICATIONS_MANAGE,
    Permission.STAFF_VIEW,
    Permission.AUDIT_VIEW,
  ],

  staff: [
    Permission.BOOKINGS_VIEW,
    Permission.BOOKINGS_MANAGE,
    Permission.INVENTORY_VIEW,
    Permission.GUESTS_VIEW,
    Permission.HOUSEKEEPING_VIEW,
    Permission.HOUSEKEEPING_MANAGE,
    Permission.FRONTDESK_VIEW,
    Permission.FRONTDESK_MANAGE,
    Permission.NOTIFICATIONS_VIEW,
  ],
};

export const PERMISSION_GROUPS = [
  {
    label: 'Bookings & Calendar',
    permissions: [Permission.BOOKINGS_VIEW, Permission.BOOKINGS_MANAGE],
  },
  {
    label: 'Inventory & Rates',
    permissions: [Permission.INVENTORY_VIEW, Permission.INVENTORY_MANAGE],
  },
  {
    label: 'Guests',
    permissions: [Permission.GUESTS_VIEW, Permission.GUESTS_MANAGE],
  },
  {
    label: 'Payments & Invoices',
    permissions: [Permission.PAYMENTS_VIEW, Permission.PAYMENTS_MANAGE],
  },
  {
    label: 'Reports',
    permissions: [Permission.REPORTS_VIEW],
  },
  {
    label: 'Housekeeping',
    permissions: [Permission.HOUSEKEEPING_VIEW, Permission.HOUSEKEEPING_MANAGE],
  },
  {
    label: 'Channel Manager',
    permissions: [Permission.CHANNELS_VIEW, Permission.CHANNELS_MANAGE],
  },
  {
    label: 'Pricing Rules',
    permissions: [Permission.PRICING_VIEW, Permission.PRICING_MANAGE],
  },
  {
    label: 'Property Settings',
    permissions: [Permission.SETTINGS_VIEW, Permission.SETTINGS_MANAGE],
  },
  {
    label: 'Staff Management',
    permissions: [Permission.STAFF_VIEW, Permission.STAFF_MANAGE],
  },
  {
    label: 'Audit Log',
    permissions: [Permission.AUDIT_VIEW],
  },
  {
    label: 'Front Desk & Folio',
    permissions: [Permission.FRONTDESK_VIEW, Permission.FRONTDESK_MANAGE],
  },
  {
    label: 'Notifications',
    permissions: [Permission.NOTIFICATIONS_VIEW, Permission.NOTIFICATIONS_MANAGE],
  },
];
