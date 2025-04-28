// filepath: /srv/timevault/src/routes/api/invoices/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export async function GET({ params }) {
  try {
    const { id } = params;
    
    const invoice = await prisma.invoice.findUnique({
      where: { id },
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
    
    if (!invoice) {
      throw error(404, 'Invoice not found');
    }
    
    return json(invoice);
  } catch (err) {
    console.error('Error fetching invoice:', err);
    if (err.status === 404) {
      throw err;
    }
    throw error(500, 'Failed to fetch invoice');
  }
}

export async function PUT({ params, request }) {
  try {
    const { id } = params;
    const data = await request.json();
    
    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { 
        addons: true,
        entries: true
      }
    });
    
    if (!existingInvoice) {
      throw error(404, 'Invoice not found');
    }
    
    // Check if invoice can be updated (not sent yet)
    if (existingInvoice.sent) {
      throw error(403, 'Cannot update a sent invoice');
    }
    
    return await prisma.$transaction(async (tx) => {
      // Handle addon updates
      if (data.addons) {
        // Find addons to delete (ones in DB but not in the update)
        const addonIdsToKeep = data.addons
          .filter(a => !a.id.toString().startsWith('temp-'))
          .map(a => a.id);
        
        // Delete addons that aren't in the new list
        await tx.invoiceAddon.deleteMany({
          where: {
            invoiceId: id,
            id: {
              notIn: addonIdsToKeep
            }
          }
        });
        
        // Update or create addons
        for (const addon of data.addons) {
          const addonData = {
            description: addon.description,
            amount: Number(addon.amount),
            cost: Number(addon.cost),
            quantity: Number(addon.quantity),
            profit: (Number(addon.amount) * Number(addon.quantity)) - (Number(addon.cost) * Number(addon.quantity)),
            invoiceId: id
          };
          
          // If it's a new addon (temp ID), create it
          if (addon.id.toString().startsWith('temp-')) {
            await tx.invoiceAddon.create({
              data: addonData
            });
          } else {
            // Otherwise update the existing one
            await tx.invoiceAddon.update({
              where: { id: addon.id },
              data: addonData
            });
          }
        }
      }
      
      // Recalculate invoice totals based on time entries and addons
      const updatedInvoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          entries: {
            include: {
              billingRate: true
            }
          },
          addons: true
        }
      });
      
      if (!updatedInvoice) {
        throw error(500, 'Failed to update invoice');
      }
      
      // Calculate time entry totals
      const timeEntriesTotal = updatedInvoice.entries.reduce(
        (acc, entry) => {
          const hours = entry.minutes / 60;
          const rate = entry.billingRate?.rate || 0;
          const cost = entry.billingRate?.cost || 0;
          const amount = rate * hours;
          const entryProfit = amount - (cost * hours);
          
          return {
            minutes: acc.minutes + entry.minutes,
            amount: acc.amount + amount,
            cost: acc.cost + (cost * hours),
            profit: acc.profit + entryProfit
          };
        },
        { minutes: 0, amount: 0, cost: 0, profit: 0 }
      );
      
      // Calculate addon totals
      const addonTotal = updatedInvoice.addons.reduce(
        (acc, addon) => {
          const addonAmount = addon.amount * addon.quantity;
          const addonCost = addon.cost * addon.quantity;
          
          return {
            amount: acc.amount + addonAmount,
            cost: acc.cost + addonCost,
            profit: acc.profit + (addonAmount - addonCost)
          };
        },
        { amount: 0, cost: 0, profit: 0 }
      );
      
      // Update invoice with new totals
      const finalInvoice = await tx.invoice.update({
        where: { id },
        data: {
          totalMinutes: timeEntriesTotal.minutes,
          totalAmount: timeEntriesTotal.amount,
          totalCost: timeEntriesTotal.cost + addonTotal.cost,
          totalProfit: timeEntriesTotal.profit + addonTotal.profit
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
      
      return json(finalInvoice);
    });
  } catch (err) {
    console.error('Error updating invoice:', err);
    if (err.status) {
      throw err;
    }
    throw error(500, 'Failed to update invoice');
  }
}

export async function DELETE({ params }) {
  try {
    const { id } = params;
    
    // Check if invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { entries: true }
    });
    
    if (!invoice) {
      throw error(404, 'Invoice not found');
    }
    
    // Check if invoice can be deleted (not sent yet)
    if (invoice.sent) {
      throw error(403, 'Cannot delete a sent invoice');
    }
    
    return await prisma.$transaction(async (tx) => {
      // Update time entries to be unbilled
      await tx.timeEntry.updateMany({
        where: { invoiceId: id },
        data: {
          billed: false,
          locked: false,
          invoiceId: null
        }
      });
      
      // Delete all addons associated with this invoice
      await tx.invoiceAddon.deleteMany({
        where: { invoiceId: id }
      });
      
      // Delete the invoice
      await tx.invoice.delete({
        where: { id }
      });
      
      return json({ success: true });
    });
  } catch (err) {
    console.error('Error deleting invoice:', err);
    if (err.status) {
      throw err;
    }
    throw error(500, 'Failed to delete invoice');
  }
}