// filepath: /srv/timevault/src/routes/api/invoices/[id]/+server.ts
import { json, error, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { id } = params;
    
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        entries: {
          include: {
            billingRate: true,
            ticket: true
          },
          orderBy: {
            date: 'desc'
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
    if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
      throw err;
    }
    throw error(500, 'Failed to fetch invoice');
  }
};

export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const { id } = params;
    const data = await request.json();
    
    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id }
    });
    
    if (!existingInvoice) {
      throw error(404, 'Invoice not found');
    }
    
    // Update the invoice
    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        invoiceNumber: data.invoiceNumber !== undefined ? data.invoiceNumber : undefined,
        totalMinutes: data.totalMinutes !== undefined ? data.totalMinutes : undefined,
        totalAmount: data.totalAmount !== undefined ? data.totalAmount : undefined,
        totalCost: data.totalCost !== undefined ? data.totalCost : undefined,
        totalProfit: data.totalProfit !== undefined ? data.totalProfit : undefined,
        date: data.date !== undefined ? new Date(data.date) : undefined,
        sent: data.sent !== undefined ? data.sent : undefined,
        // Add ability to update addons if needed
        addons: data.addons ? {
          deleteMany: {}, // Delete existing addons
          create: data.addons.map(addon => ({
            description: addon.description,
            amount: addon.amount,
            cost: addon.cost || 0,
            quantity: addon.quantity || 1,
            profit: (addon.amount * (addon.quantity || 1)) - ((addon.cost || 0) * (addon.quantity || 1)),
            ticketAddonId: addon.ticketAddonId
          }))
        } : undefined
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
    
    return json(invoice);
  } catch (err) {
    console.error('Failed to update invoice:', err);
    if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
      throw err;
    }
    throw error(500, 'Failed to update invoice');
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const { id } = params;
    
    // Check if invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        entries: true
      }
    });
    
    if (!invoice) {
      throw error(404, 'Invoice not found');
    }
    
    await prisma.$transaction(async (tx) => {
      // First unlock all time entries
      if (invoice.entries.length > 0) {
        await tx.timeEntry.updateMany({
          where: { invoiceId: id },
          data: {
            invoiceId: null,
            billed: false,
            locked: false,
            billedRate: null
          }
        });
      }
      
      // Delete invoice addons
      await tx.invoiceAddon.deleteMany({
        where: { invoiceId: id }
      });
      
      // Delete the invoice
      await tx.invoice.delete({
        where: { id }
      });
    });
    
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('Failed to delete invoice:', err);
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    throw error(500, 'Failed to delete invoice');
  }
};