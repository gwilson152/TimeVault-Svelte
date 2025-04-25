import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export async function GET() {
  try {
    const tickets = await prisma.ticket.findMany({
      include: { client: true }
    });
    return json(tickets);
  } catch (error) {
    console.error('Failed to fetch tickets:', error);
    return json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const { title, description, clientId } = await request.json();

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        clientId
      },
      include: { client: true }
    });
    return json(ticket);
  } catch (error) {
    console.error('Failed to create ticket:', error);
    return json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}