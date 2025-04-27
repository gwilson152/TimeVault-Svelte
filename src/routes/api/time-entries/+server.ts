import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { prisma } from '$lib/server/db';
import { timeEntrySchema } from '$lib/types';
import { ZodError } from 'zod';

export async function GET() {
  try {
    const timeEntries = await prisma.timeEntry.findMany({
      include: {
        client: true,
        billingRate: true
      },
      orderBy: { date: 'desc' }
    });
    return json(timeEntries);
  } catch (error) {
    console.error('Failed to fetch time entries:', error);
    return json({ error: 'Failed to fetch time entries' }, { status: 500 });
  }
}

export async function POST({ request }: RequestEvent) {
  try {
    const data = await request.json();
    console.log('🔍 Received time entry data:', data);
    
    // Convert duration to minutes if provided
    let processedData = { ...data };
    if (data.duration !== undefined && data.minutes === undefined) {
      processedData.minutes = Math.round(data.duration * 60);
    } else if (data.minutes !== undefined && data.duration === undefined) {
      processedData.duration = data.minutes / 60;
    }
    
    // Parse and validate the input data
    const timeEntry = timeEntrySchema.parse({
      description: processedData.description,
      startTime: new Date(processedData.startTime),
      endTime: processedData.endTime ? new Date(processedData.endTime) : null,
      minutes: processedData.minutes,
      duration: processedData.duration,
      date: new Date(processedData.date),
      clientId: processedData.clientId || null,
      ticketId: processedData.ticketId || null,
      billable: processedData.billable ?? true,
      billingRateId: processedData.billingRateId || null,
      billed: false,
      locked: false,
      billedRate: undefined
    });

    console.log('✅ Validated time entry data:', timeEntry);

    // Ensure we have minutes calculated (prefer using duration if available)
    const minutesValue = timeEntry.duration !== undefined 
      ? Math.round(timeEntry.duration * 60) 
      : (timeEntry.minutes || 0);

    // Create the time entry - only use fields that exist in the Prisma schema
    const entry = await prisma.timeEntry.create({
      data: {
        description: timeEntry.description,
        startTime: timeEntry.startTime,
        endTime: timeEntry.endTime,
        minutes: minutesValue,
        date: timeEntry.date,
        clientId: timeEntry.clientId,
        ticketId: timeEntry.ticketId,
        billable: timeEntry.billable,
        billingRateId: timeEntry.billingRateId,
        billed: timeEntry.billed,
        locked: timeEntry.locked,
        billedRate: timeEntry.billedRate
      },
      include: {
        client: true,
        billingRate: true
      }
    });

    return json(entry);
  } catch (error) {
    console.error('❌ Failed to create time entry:', error);
    
    if (error instanceof ZodError) {
      return json({ 
        error: 'Invalid time entry data', 
        details: error.errors 
      }, { status: 400 });
    }
    
    return json({ error: 'Failed to create time entry' }, { status: 500 });
  }
}