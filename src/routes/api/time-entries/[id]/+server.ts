import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';
import { timeEntrySchema } from '$lib/types';
import { z } from 'zod';

// Base schema for validating time entry updates
const timeEntryBaseSchema = z.object({
  description: z.string().optional(),
  startTime: z.date().optional(),
  endTime: z.date().nullable().optional(),
  minutes: z.number().optional(),
  date: z.date().optional(),
  clientId: z.string().nullable().optional(),
  ticketId: z.string().nullable().optional(),
  billable: z.boolean().optional(),
  billingRateId: z.string().nullable().optional(),
  billed: z.boolean().optional(),
  invoiceId: z.string().nullable().optional(),
  billedRate: z.number().optional(),
  locked: z.boolean().optional()
});

// Create a partial schema for updates
const partialTimeEntrySchema = timeEntryBaseSchema.partial();

export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    // Check if the time entry exists with its invoice status
    const existingEntry = await prisma.timeEntry.findUnique({
      where: { id: params.id },
      include: {
        invoice: true
      }
    });
    
    if (!existingEntry) {
      return json({ error: 'Time entry not found' }, { status: 404 });
    }
    
    const data = await request.json();
    
    // If we're trying to update an entry associated with a sent invoice, block it
    if (existingEntry.invoice?.sent) {
      throw error(403, 'Cannot modify a time entry that is part of a sent invoice');
    }

    // Special handling for removing from invoice
    if (data.invoiceId === null) {
      // Allow removing from draft invoice
      const result = await prisma.timeEntry.update({
        where: { id: params.id },
        data: {
          invoiceId: null,
          billed: false,
          locked: false,
          billedRate: null
        },
        include: {
          client: true,
          billingRate: true
        }
      });

      return json(result);
    }
    
    // For all other updates, prevent changes to locked or billed entries
    // unless we're explicitly unlocking it by removing from an invoice
    if (existingEntry.locked || existingEntry.billed) {
      throw error(403, 'Cannot update a locked time entry. This entry is associated with an invoice.');
    }
    
    // Parse and validate the update data
    const validatedData = partialTimeEntrySchema.parse({
      ...data,
      date: data.date ? new Date(data.date) : undefined,
      startTime: data.startTime ? new Date(data.startTime) : undefined,
      endTime: data.endTime ? new Date(data.endTime) : null
    });

    // Update the time entry
    const result = await prisma.timeEntry.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        client: true,
        billingRate: true
      }
    });

    return json(result);
  } catch (err) {
    console.error('Error updating time entry:', err);
    if (err instanceof z.ZodError) {
      return json({ error: 'Invalid time entry data', details: err.errors }, { status: 400 });
    }
    if (err.status) {
      return json({ error: err.body?.message || 'Failed to update time entry' }, { status: err.status });
    }
    return json({ error: 'Failed to update time entry' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  try {
    // Check if the time entry exists and its invoice status
    const existingEntry = await prisma.timeEntry.findUnique({
      where: { id: params.id },
      include: {
        invoice: true
      }
    });
    
    if (!existingEntry) {
      return json({ error: 'Time entry not found' }, { status: 404 });
    }
    
    // Block deletion if entry is part of a sent invoice
    if (existingEntry.invoice?.sent) {
      throw error(403, 'Cannot delete a time entry that is part of a sent invoice');
    }
    
    // For all other cases, prevent deletion of locked or billed entries
    if (existingEntry.locked || existingEntry.billed) {
      throw error(403, 'Cannot delete a locked time entry. This entry is associated with an invoice.');
    }
    
    await prisma.timeEntry.delete({
      where: { id: params.id }
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('Failed to delete time entry:', err);
    
    if (err.status) {
      return json({ error: err.body?.message || 'Failed to delete time entry' }, { status: err.status });
    }
    
    return json({ error: 'Failed to delete time entry' }, { status: 500 });
  }
};