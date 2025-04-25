import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export async function PUT({ params, request }) {
  try {
    const { description, hours, date, clientId, billable, ticketId } = await request.json();
    const parsedDate = new Date(date);

    if (isNaN(parsedDate.getTime())) {
      return json({ error: 'Invalid date format' }, { status: 400 });
    }

    const entry = await prisma.timeEntry.update({
      where: { id: params.id },
      data: {
        description,
        hours,
        date: parsedDate,
        clientId,
        billable,
        ticketId
      },
      include: { client: true, ticket: true }
    });
    return json(entry);
  } catch (error) {
    console.error('Failed to update time entry:', error);
    return json({ error: 'Failed to update time entry' }, { status: 500 });
  }
}

export async function DELETE({ params }) {
  try {
    await prisma.timeEntry.delete({
      where: { id: params.id }
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete time entry:', error);
    return json({ error: 'Failed to delete time entry' }, { status: 500 });
  }
}