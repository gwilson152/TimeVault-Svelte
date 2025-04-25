import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { formattedToHours, minutesToHours } from '$lib/utils/timeUtils';

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

export async function POST({ request }) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.description || typeof data.description !== 'string') {
      return json({ error: 'Description is required' }, { status: 400 });
    }

    if (!data.date) {
      return json({ error: 'Date is required' }, { status: 400 });
    }

    // Handle different time formats
    let hours = 0;
    if (data.minutes) {
      hours = minutesToHours(data.minutes);
    } else if (data.timeFormatted) {
      const hoursFromFormatted = formattedToHours(data.timeFormatted);
      if (hoursFromFormatted === null) {
        return json({ error: 'Invalid time format' }, { status: 400 });
      }
      hours = hoursFromFormatted;
    } else if (typeof data.hours === 'number' && data.hours > 0) {
      hours = data.hours;
    } else {
      return json({ error: 'Invalid time value' }, { status: 400 });
    }

    // Create time entry with validated hours
    const timeEntry = await prisma.timeEntry.create({
      data: {
        description: data.description,
        date: new Date(data.date),
        hours: hours,
        clientId: data.clientId || null,
        ticketId: data.ticketId || null,
        billable: data.billable ?? true,
        billed: false,
        billingRateId: data.billingRateId || null
      },
      include: {
        client: true,
        billingRate: true
      }
    });

    return json(timeEntry);
  } catch (error) {
    console.error('Failed to create time entry:', error);
    return json({ error: 'Failed to create time entry' }, { status: 500 });
  }
}