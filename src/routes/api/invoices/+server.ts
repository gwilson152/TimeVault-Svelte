import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
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
  const { clientId, entries, invoiceNumber, addons = [] } = await request.json();

  if (!clientId || !entries?.length) {
    throw error(400, 'Client ID and at least one time entry are required');
  }
  
  return await prisma.$transaction(async (tx) => {
    // Calculate totals for time entries
    const timeEntriesTotal = entries.reduce((acc: InvoiceTotals, entry: TimeEntry) => {
      // Convert duration from minutes to hours for rate calculations
      const hours = entry.minutes / 60;
      const amount = entry.billingRate?.rate ? entry.billingRate.rate * hours : 0;
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
          connect: entries.map((entry: TimeEntry) => ({ id: entry.id }))
        },
        addons: {
          create: addons.map((addon: InvoiceAddon) => ({
            description: addon.description,
            amount: addon.amount,
            cost: addon.cost,
            quantity: addon.quantity,
            profit: (addon.amount - addon.cost) * addon.quantity,
            ticketAddonId: addon.ticketAddonId
          }))
        }
      },
      include: {
        entries: true,
        addons: true
      }
    });

    // Mark entries as billed
    await tx.timeEntry.updateMany({
      where: {
        id: {
          in: entries.map((entry: TimeEntry) => entry.id)
        }
      },
      data: {
        billed: true,
        locked: true, // Lock entries when they're included in an invoice
        invoiceId: invoice.id
      }
    });

    // If any addons are from tickets, mark them as billed
    if (addons.some((a: InvoiceAddon) => a.ticketAddonId)) {
      await tx.ticketAddon.updateMany({
        where: {
          id: {
            in: addons.filter((a: InvoiceAddon) => a.ticketAddonId).map((a: InvoiceAddon) => a.ticketAddonId!)
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