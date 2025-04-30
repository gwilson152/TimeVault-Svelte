import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { calculateEffectiveRate } from '$lib/utils/invoiceUtils';
import type { TimeEntry, InvoiceAddon, Client, BillingRate } from '$lib/types';

interface TimeEntryWithDetails extends Omit<TimeEntry, 'client' | 'billingRate'> {
  client?: {
    id: string;
    name: string;
    rate: number;
    duration: number;
    billingRateOverrides: {
      baseRateId: string;
      value: number;
      overrideType: 'percentage' | 'fixed';
    }[];
  };
  billingRate?: {
    id: string;
    name: string;
    rate: number;
    cost: number;
  };
}

interface InvoiceTotals {
  minutes: number;
  amount: number;
  cost: number;
  profit: number;
}

interface InvoiceRequest {
  clientId: string;
  entries: TimeEntry[];
  invoiceNumber?: string;
  addons?: InvoiceAddon[];
}

export async function GET({ url }) {
  try {
    const clientId = url.searchParams.get('clientId');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');

    // Build where clause based on filters
    const where: any = {};

    if (clientId) {
      where.clientId = clientId;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        where.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.date.lte = new Date(dateTo);
      }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        client: true,
        entries: true,
        addons: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    return json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST({ request }) {
  const { clientId, entries, invoiceNumber, addons = [] } = await request.json() as InvoiceRequest;

  if (!clientId || !entries?.length) {
    throw error(400, 'Client ID and at least one time entry are required');
  }
  
  return await prisma.$transaction(async (tx) => {
    // Get all clients for billing rate override calculations
    const allClients = await tx.client.findMany({
      include: {
        billingRateOverrides: true,
        children: {
          include: {
            billingRateOverrides: true,
            children: true
          }
        }
      }
    });

    // Helper function to convert Prisma client to Client type
    function convertToClient(prismaClient: any): Client {
      return {
        ...prismaClient,
        type: prismaClient.type as 'business' | 'container' | 'individual',
        children: prismaClient.children?.map(convertToClient) || []
      };
    }

    const typedClients = allClients.map(convertToClient);

    // Calculate effective rates for each entry
    const entriesWithRates = await Promise.all(entries.map(async (entry: TimeEntry) => {
      const billingRate = entry.billingRateId ? 
        await tx.billingRate.findUnique({ 
          where: { id: entry.billingRateId },
          select: {
            id: true,
            name: true,
            rate: true,
            cost: true,
            description: true,
            isDefault: true,
            createdAt: true,
            updatedAt: true
          }
        }) 
        : null;

      if (!billingRate) return entry;

      // Calculate effective rate considering client overrides
      const effectiveRate = calculateEffectiveRate(
        { ...billingRate, description: billingRate.description || undefined } as BillingRate,
        typedClients,
        entry.clientId
      );

      return {
        ...entry,
        billedRate: effectiveRate
      };
    }));

    // Calculate totals for time entries
    const timeEntriesTotal = entriesWithRates.reduce((acc: InvoiceTotals, entry: TimeEntry) => {
      // Convert duration from minutes to hours for rate calculations
      const hours = entry.minutes / 60;
      const amount = entry.billedRate ? entry.billedRate * hours : 0;
      const cost = entry.billingRate?.cost ? entry.billingRate.cost * hours : 0;
      const profit = amount - cost;

      return {
        minutes: acc.minutes + entry.minutes,
        amount: acc.amount + amount,
        cost: acc.cost + cost,
        profit: acc.profit + profit
      };
    }, { minutes: 0, amount: 0, cost: 0, profit: 0 });

    // Calculate totals for addons
    const addonTotals = addons.reduce((acc: Omit<InvoiceTotals, 'minutes'>, addon: InvoiceAddon) => {
      const addonAmount = addon.amount * addon.quantity;
      const addonCost = addon.cost * addon.quantity;
      
      return {
        amount: acc.amount + addonAmount,
        cost: acc.cost + addonCost,
        profit: acc.profit + (addonAmount - addonCost)
      };
    }, { amount: 0, cost: 0, profit: 0 });

    // Create the invoice
    const invoice = await tx.invoice.create({
      data: {
        clientId,
        invoiceNumber,
        totalMinutes: timeEntriesTotal.minutes,
        totalAmount: timeEntriesTotal.amount + addonTotals.amount,
        totalCost: timeEntriesTotal.cost + addonTotals.cost,
        totalProfit: timeEntriesTotal.profit + addonTotals.profit,
        entries: {
          connect: entriesWithRates.map((entry) => ({ id: entry.id }))
        },
        addons: {
          create: addons.map((addon: InvoiceAddon) => ({
            description: addon.description,
            amount: addon.amount,
            cost: addon.cost,
            quantity: addon.quantity,
            profit: (addon.amount * addon.quantity) - (addon.cost * addon.quantity),
            ticketAddonId: addon.ticketAddonId
          }))
        }
      },
      include: {
        client: true,
        entries: {
          include: {
            billingRate: true
          }
        },
        addons: true
      }
    });

    // Lock time entries and store their billing rates
    await tx.timeEntry.updateMany({
      where: {
        id: {
          in: entriesWithRates.map((entry) => entry.id)
        }
      },
      data: {
        billed: true,
        locked: true,
        invoiceId: invoice.id
      }
    });

    // Update each entry individually to store the billed rate
    await Promise.all(entriesWithRates.map(entry => 
      tx.timeEntry.update({
        where: { id: entry.id },
        data: { billedRate: entry.billedRate }
      })
    ));

    // If any addons are from tickets, mark them as billed
    const ticketAddons = addons.filter((addon: InvoiceAddon) => addon.ticketAddonId);
    if (ticketAddons.length > 0) {
      await tx.ticketAddon.updateMany({
        where: {
          id: {
            in: ticketAddons.map(addon => addon.ticketAddonId!),
          }
        },
        data: {
          billed: true
        }
      });
    }

    return json(invoice);
  });
}