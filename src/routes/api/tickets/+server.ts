import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export async function GET() {
  try {
    const tickets = await prisma.ticket.findMany({
      include: { 
        client: true,
        status: true 
      }
    });
    return json(tickets);
  } catch (error) {
    console.error('Failed to fetch tickets:', error);
    return json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const { title, description, clientId, statusId } = await request.json();

    // Get default status if statusId is not provided
    let finalStatusId = statusId;
    if (!finalStatusId) {
      const defaultStatus = await prisma.ticketStatus.findFirst({
        where: { isDefault: true }
      });
      if (!defaultStatus) {
        const firstStatus = await prisma.ticketStatus.findFirst();
        finalStatusId = firstStatus?.id;
      } else {
        finalStatusId = defaultStatus.id;
      }
    }

    // Validate that clientId and statusId are provided
    if (!clientId) {
      return json({ error: 'Client ID is required' }, { status: 400 });
    }

    if (!finalStatusId) {
      return json({ error: 'No ticket status found. Please create a status first.' }, { status: 400 });
    }

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        clientId,
        statusId: finalStatusId
      },
      include: { 
        client: true,
        status: true
      }
    });
    return json(ticket);
  } catch (error) {
    console.error('Failed to create ticket:', error);
    return json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}