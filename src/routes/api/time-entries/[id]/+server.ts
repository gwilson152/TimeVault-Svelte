import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';
import { timeEntrySchema } from '$lib/types';
import { ZodError, z } from 'zod';
import { error } from '@sveltejs/kit';

// Create a base schema without refinement and then make it partial
const timeEntryBaseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  startTime: z.date(),
  endTime: z.date().nullable(),
  minutes: z.number().min(1, 'Duration must be greater than 0').optional(),
  duration: z.number().min(0.01, 'Duration must be greater than 0').optional(),
  date: z.date(),
  clientId: z.string().nullable(),
  ticketId: z.string().nullable(),
  billable: z.boolean().default(true),
  billingRateId: z.string().nullable(),
  billed: z.boolean().optional().default(false),
  billedRate: z.number().optional(),
  locked: z.boolean().optional().default(false)
});

// Create a partial schema for updates
const partialTimeEntrySchema = timeEntryBaseSchema.partial();

export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    // First check if the time entry is locked or associated with an invoice
    const existingEntry = await prisma.timeEntry.findUnique({
      where: { id: params.id }
    });
    
    if (!existingEntry) {
      return json({ error: 'Time entry not found' }, { status: 404 });
    }
    
    // Prevent updates to locked or billed entries
    if (existingEntry.locked || existingEntry.billed) {
      throw error(403, 'Cannot update a locked time entry. This entry is associated with an invoice.');
    }
    
    const data = await request.json();
    
    // Parse and validate the update data
    const validatedData = partialTimeEntrySchema.parse({
      ...data,
      date: data.date ? new Date(data.date) : undefined,
      startTime: data.startTime ? new Date(data.startTime) : undefined,
      endTime: data.endTime ? new Date(data.endTime) : null
    });
    
    // Create a clean updates object with Prisma-compatible fields
    const updates: any = { ...validatedData };
    
    // Convert duration to minutes if it exists and remove duration field
    if (updates.duration !== undefined) {
      updates.minutes = Math.round(updates.duration * 60);
      delete updates.duration;
    }

    const entry = await prisma.timeEntry.update({
      where: { id: params.id },
      data: updates,
      include: {
        client: true,
        billingRate: true
      }
    });

    return json(entry);
  } catch (err: unknown) {
    console.error('Failed to update time entry:', err);
    
    if (err instanceof ZodError) {
      return json({ 
        error: 'Invalid time entry data', 
        details: err.errors 
      }, { status: 400 });
    }
    
    // Return appropriate error based on the type
    if (err && typeof err === 'object' && 'status' in err && err.status === 403) {
      // This is an error thrown by SvelteKit's error function
      const svelteKitError = err as { status: number; body: { message: string } };
      return json({ error: svelteKitError.body.message }, { status: 403 });
    }
    
    return json({ error: 'Failed to update time entry' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  try {
    // First check if the time entry is locked or associated with an invoice
    const existingEntry = await prisma.timeEntry.findUnique({
      where: { id: params.id }
    });
    
    if (!existingEntry) {
      return json({ error: 'Time entry not found' }, { status: 404 });
    }
    
    // Prevent deletion of locked or billed entries
    if (existingEntry.locked || existingEntry.billed) {
      throw error(403, 'Cannot delete a locked time entry. This entry is associated with an invoice.');
    }
    
    await prisma.timeEntry.delete({
      where: { id: params.id }
    });
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    console.error('Failed to delete time entry:', err);
    
    // Return appropriate error based on the type
    if (err && typeof err === 'object' && 'status' in err && err.status === 403) {
      // This is an error thrown by SvelteKit's error function
      const svelteKitError = err as { status: number; body: { message: string } };
      return json({ error: svelteKitError.body.message }, { status: 403 });
    }
    
    return json({ error: 'Failed to delete time entry' }, { status: 500 });
  }
};