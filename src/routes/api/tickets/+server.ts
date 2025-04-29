import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';

export const GET: RequestHandler = async () => {
  try {
    const tickets = await prisma.ticket.findMany({
      include: {
        status: true,
        client: true,
        addons: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    return json(tickets);
  } catch (error) {
    console.error('Failed to fetch tickets:', error);
    return json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.title || !data.clientId || !data.statusId) {
      return json(
        { error: 'Title, client ID, and status ID are required' }, 
        { status: 400 }
      );
    }

    // Create ticket with basic fields
    const ticket = await prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        clientId: data.clientId,
        statusId: data.statusId
      },
      include: {
        status: true,
        client: true
      }
    });
    
    return json(ticket);
  } catch (error) {
    console.error('Failed to create ticket:', error);
    return json({ error: 'Failed to create ticket' }, { status: 500 });
  }
};