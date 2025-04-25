import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export async function GET({ url }) {
  try {
    const clientId = url.searchParams.get('clientId');
    const query = clientId ? { clientId } : {};

    const invoices = await prisma.invoice.findMany({
      where: query,
      include: {
        client: true,
        entries: {
          include: {
            billingRate: true
          }
        },
        addons: true
      },
      orderBy: { date: 'desc' }
    });
    
    return json(invoices);
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
    return json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const { 
      clientId, 
      entries: selectedEntries,
      invoiceNumber,
      addons = []
    } = await request.json();

    if (!clientId) {
      return json({ error: 'Client ID is required' }, { status: 400 });
    }

    // Start a transaction since we need to update multiple records
    const invoice = await prisma.$transaction(async (tx) => {
      // Calculate total hours and amount from time entries
      const timeEntriesTotal = selectedEntries.reduce((acc, entry) => {
        const rate = entry.billingRate?.rate || 0;
        const amount = entry.hours * rate;
        return {
          hours: acc.hours + entry.hours,
          amount: acc.amount + amount,
          cost: acc.cost + (entry.hours * (entry.billingRate?.cost || 0))
        };
      }, { hours: 0, amount: 0, cost: 0 });

      // Calculate totals for addons
      const addonsTotal = addons.reduce((acc, addon) => {
        const total = addon.amount * addon.quantity;
        const cost = addon.cost * addon.quantity;
        return {
          amount: acc.amount + total,
          cost: acc.cost + cost
        };
      }, { amount: 0, cost: 0 });

      // Create the invoice
      const invoice = await tx.invoice.create({
        data: {
          clientId,
          invoiceNumber,
          totalHours: timeEntriesTotal.hours,
          totalAmount: timeEntriesTotal.amount + addonsTotal.amount,
          totalCost: timeEntriesTotal.cost + addonsTotal.cost,
          totalProfit: (timeEntriesTotal.amount + addonsTotal.amount) - 
                      (timeEntriesTotal.cost + addonsTotal.cost),
          date: new Date(),
          addons: {
            create: addons.map(addon => ({
              description: addon.description,
              amount: addon.amount,
              cost: addon.cost,
              quantity: addon.quantity,
              profit: (addon.amount * addon.quantity) - (addon.cost * addon.quantity),
              ticketAddonId: addon.ticketAddonId || null
            }))
          }
        }
      });

      // Update time entries to mark them as billed
      if (selectedEntries.length > 0) {
        await tx.timeEntry.updateMany({
          where: {
            id: {
              in: selectedEntries.map(e => e.id)
            }
          },
          data: {
            billed: true,
            invoiceId: invoice.id
          }
        });
      }

      // If any entries are from ticket addons, mark them as billed
      const ticketAddonIds = addons
        .map(a => a.ticketAddonId)
        .filter((id): id is string => id !== null && id !== undefined);

      if (ticketAddonIds.length > 0) {
        await tx.ticketAddon.updateMany({
          where: {
            id: {
              in: ticketAddonIds
            }
          },
          data: {
            billed: true
          }
        });
      }

      // Return the complete invoice with all related data
      return tx.invoice.findUnique({
        where: { id: invoice.id },
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
    });

    return json(invoice);
  } catch (error) {
    console.error('Failed to generate invoice:', error);
    return json({ error: 'Failed to generate invoice' }, { status: 500 });
  }
}