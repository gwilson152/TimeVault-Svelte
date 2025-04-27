import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Add default settings
  const defaultSettings = [
    {
      key: 'default_hourly_cost',
      value: '50',
      category: 'billing',
      label: 'Default Hourly Cost',
      description: 'Internal hourly cost rate used for profit calculations',
      type: 'number'
    },
    {
      key: 'invoice_prefix',
      value: 'INV',
      category: 'invoice',
      label: 'Invoice Number Prefix',
      description: 'Prefix used for automatic invoice numbering',
      type: 'string'
    },
    {
      key: 'next_invoice_number',
      value: '1001',
      category: 'invoice',
      label: 'Next Invoice Number',
      description: 'Next number to be used for automatic invoice numbering',
      type: 'number'
    },
    {
      key: 'company_name',
      value: 'Your Company Name',
      category: 'company',
      label: 'Company Name',
      description: 'Your company name as shown on invoices',
      type: 'string'
    },
    {
      key: 'company_address',
      value: 'Your Address',
      category: 'company',
      label: 'Company Address',
      description: 'Your company address as shown on invoices',
      type: 'string'
    },
    {
      key: 'company_email',
      value: 'your@email.com',
      category: 'company',
      label: 'Company Email',
      description: 'Your company email as shown on invoices',
      type: 'string'
    },
    {
      key: 'time_entry_format',
      value: 'minutes',
      category: 'time',
      label: 'Time Entry Format',
      description: 'Format for tracking time (minutes or hh:mm)',
      type: 'string'
    }
  ];

  for (const setting of defaultSettings) {
    await prisma.settings.upsert({
      where: { key: setting.key },
      update: setting,
      create: setting
    });
  }

  // Add default ticket status
  const defaultStatus = await prisma.ticketStatus.upsert({
    where: { name: 'Open' },
    update: {
      isDefault: true,
      isClosed: false,
      color: '#22C55E',
      sortOrder: 0
    },
    create: {
      name: 'Open',
      isDefault: true,
      isClosed: false,
      color: '#22C55E',
      sortOrder: 0
    }
  });

  // Add expanded list of ticket statuses
  const statusList = [
    {
      name: 'In Progress',
      color: '#3B82F6',
      isDefault: false,
      isClosed: false,
      sortOrder: 1
    },
    {
      name: 'On Hold',
      color: '#F59E0B',
      isDefault: false,
      isClosed: false,
      sortOrder: 2
    },
    {
      name: 'Waiting for Client',
      color: '#8B5CF6',
      isDefault: false,
      isClosed: false,
      sortOrder: 3
    },
    {
      name: 'Pending Review',
      color: '#EC4899',
      isDefault: false,
      isClosed: false,
      sortOrder: 4
    },
    {
      name: 'Ready for Deployment',
      color: '#14B8A6',
      isDefault: false,
      isClosed: false,
      sortOrder: 5
    },
    {
      name: 'Closed',
      color: '#6B7280',
      isDefault: false,
      isClosed: true,
      sortOrder: 6
    },
    {
      name: 'Canceled',
      color: '#DC2626',
      isDefault: false,
      isClosed: true,
      sortOrder: 7
    }
  ];

  for (const status of statusList) {
    await prisma.ticketStatus.upsert({
      where: { name: status.name },
      update: status,
      create: status
    });
  }

  // Add default billing rates
  const billingRates = [
    {
      name: 'Standard Hourly',
      rate: 90,
      cost: 50,
      description: 'Standard hourly billing rate',
      isDefault: true
    },
    {
      name: 'Critical Hourly',
      rate: 130,
      cost: 65,
      description: 'Urgent/critical issue billing rate',
      isDefault: false
    },
    {
      name: 'Maintenance',
      rate: 75,
      cost: 45,
      description: 'Regular maintenance work',
      isDefault: false
    },
    {
      name: 'Project',
      rate: 100,
      cost: 55,
      description: 'Project-based work',
      isDefault: false
    },
    {
      name: 'No Charge',
      rate: 0,
      cost: 0,
      description: 'No charge for this service',
      isDefault: false
    },
  ];

  for (const rate of billingRates) {
    await prisma.billingRate.upsert({
      where: { name: rate.name },
      update: rate,
      create: rate
    });
  }

  console.log('Database has been seeded with default settings, ticket statuses, and billing rates');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });