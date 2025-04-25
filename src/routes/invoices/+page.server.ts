import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/db';
import type { TimeEntry } from '$lib/types';

interface InvoiceAddon {
  description: string;
  amount: number;
  cost?: number;
  quantity?: number;
  ticketAddonId?: string;
}

interface InvoiceData {
  clientId: string;
  entries: TimeEntry[];
  invoiceNumber: string;
  addons?: InvoiceAddon[];
}

export const load: PageServerLoad = async ({ url }) => {
  try {
    const clientId = url.searchParams.get('clientId');
    
    // Get all billing rates (needed for rate calculations)
    const billingRates = await prisma.billingRate.findMany({
      orderBy: { name: 'asc' }
    });

    // Get specified client and their sub-clients if a clientId is provided
    let selectedClient = null;
    let clientHierarchy = [];
    
    if (clientId) {
      selectedClient = await prisma.client.findUnique({
        where: { id: clientId },
        include: {
          billingRateOverrides: true
        }
      });

      if (!selectedClient) {
        throw error(404, 'Client not found');
      }

      // Get all child clients recursively
      const getChildClients = async (parentId: string): Promise<any[]> => {
        const children = await prisma.client.findMany({
          where: { parentId },
          include: {
            billingRateOverrides: true
          }
        });

        const allChildren = [...children];
        for (const child of children) {
          const grandchildren = await getChildClients(child.id);
          allChildren.push(...grandchildren);
        }

        return allChildren;
      };

      clientHierarchy = [selectedClient, ...await getChildClients(clientId)];
    }

    // Get all unbilled time entries for the client hierarchy
    const timeEntries = clientId ? await prisma.timeEntry.findMany({
      where: {
        clientId: { in: clientHierarchy.map(c => c.id) },
        billable: true,
        billed: false,
        OR: [
          { invoiceId: null },
          { invoice: { id: null } }
        ]
      },
      include: {
        client: {
          include: {
            billingRateOverrides: true
          }
        },
        billingRate: true
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' }
      ]
    }) : [];

    // Get unbilled ticket add-ons for the client hierarchy
    const ticketAddons = clientId ? await prisma.ticketAddon.findMany({
      where: {
        ticket: {
          clientId: { in: clientHierarchy.map(c => c.id) }
        },
        billed: false
      },
      include: {
        ticket: {
          include: {
            client: true
          }
        }
      }
    }) : [];

    return {
      billingRates,
      selectedClient,
      clientHierarchy,
      timeEntries,
      ticketAddons
    };
  } catch (e) {
    console.error('Error loading invoice data:', e);
    throw error(500, 'Failed to load invoice data');
  }
};

export const actions = {
  generateInvoice: async ({ request }) => {
    const data = await request.json() as InvoiceData;
    const { clientId, entries, invoiceNumber, addons } = data;
    
    // Calculate totals from time entries
    const timeEntriesTotals = entries.reduce((acc: { hours: number; amount: number; cost: number; profit: number }, entry: TimeEntry & { client?: { rate: number } }) => {
      const rate = entry.client?.rate || 0;
      const amount = entry.hours * rate;
      const cost = entry.hours * 50;
      
      return {
        hours: acc.hours + entry.hours,
        amount: acc.amount + amount,
        cost: acc.cost + cost,
        profit: acc.profit + (amount - cost)
      };
    }, { hours: 0, amount: 0, cost: 0, profit: 0 });

    // Calculate totals from addons
    const addonTotals = addons?.reduce((acc: { amount: number; cost: number; profit: number }, addon: InvoiceAddon) => {
      const addonAmount = addon.amount * (addon.quantity || 1);
      const addonCost = (addon.cost || 0) * (addon.quantity || 1);
      
      return {
        amount: acc.amount + addonAmount,
        cost: acc.cost + addonCost,
        profit: acc.profit + (addonAmount - addonCost)
      };
    }, { amount: 0, cost: 0, profit: 0 }) || { amount: 0, cost: 0, profit: 0 };

    // Create invoice with total amounts
    const invoice = await prisma.invoice.create({
      data: {
        clientId,
        invoiceNumber,
        totalHours: timeEntriesTotals.hours,
        totalAmount: timeEntriesTotals.amount + addonTotals.amount,
        totalCost: timeEntriesTotals.cost + addonTotals.cost,
        totalProfit: timeEntriesTotals.profit + addonTotals.profit,
        entries: {
          connect: entries.map((entry: TimeEntry) => ({ id: entry.id }))
        },
        addons: {
          create: addons?.map((addon: InvoiceAddon) => ({
            description: addon.description,
            amount: addon.amount,
            cost: addon.cost || 0,
            quantity: addon.quantity || 1,
            profit: (addon.amount * (addon.quantity || 1)) - ((addon.cost || 0) * (addon.quantity || 1)),
            ticketAddonId: addon.ticketAddonId
          }))
        }
      },
      include: {
        client: true,
        entries: true,
        addons: true
      }
    });

    // Update ticket addons if they were included in the invoice
    if (addons?.some((addon: InvoiceAddon) => addon.ticketAddonId)) {
      await prisma.ticketAddon.updateMany({
        where: {
          id: {
            in: addons
              .filter((addon: InvoiceAddon) => addon.ticketAddonId)
              .map((addon: InvoiceAddon) => addon.ticketAddonId!)
          }
        },
        data: {
          billed: true
        }
      });
    }

    return { invoice };
  }
};