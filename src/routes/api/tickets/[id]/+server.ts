import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { id } = params;
    
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        status: true,
        client: true,
        addons: true,
        notes: {
          include: {
            user: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        timeEntries: {
          include: {
            billingRate: true
          },
          orderBy: {
            date: 'desc'
          }
        }
      }
    });
    
    if (!ticket) {
      throw error(404, 'Ticket not found');
    }
    
    return json(ticket);
  } catch (err) {
    console.error('Error fetching ticket:', err);
    if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
      throw err;
    }
    throw error(500, 'Failed to fetch ticket');
  }
};

export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const { id } = params;
    const data = await request.json();
    
    // Check if ticket exists
    const existingTicket = await prisma.ticket.findUnique({
      where: { id }
    });
    
    if (!existingTicket) {
      throw error(404, 'Ticket not found');
    }
    
    // Update the ticket
    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        title: data.title !== undefined ? data.title : undefined,
        description: data.description !== undefined ? data.description : undefined,
        statusId: data.statusId !== undefined ? data.statusId : undefined,
        clientId: data.clientId !== undefined ? data.clientId : undefined
      },
      include: {
        status: true,
        client: true
      }
    });
    
    return json(ticket);
  } catch (err) {
    console.error('Failed to update ticket:', err);
    if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
      throw err;
    }
    throw error(500, 'Failed to update ticket');
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const { id } = params;
    
    // Check if ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        timeEntries: true
      }
    });
    
    if (!ticket) {
      throw error(404, 'Ticket not found');
    }
    
    // Check for time entries
    if (ticket.timeEntries && ticket.timeEntries.length > 0) {
      throw error(400, 'Cannot delete ticket with associated time entries');
    }
    
    // Delete ticket addons first
    await prisma.ticketAddon.deleteMany({
      where: { ticketId: id }
    });
    
    // Delete ticket notes
    await prisma.ticketNote.deleteMany({
      where: { ticketId: id }
    });
    
    // Delete the ticket
    await prisma.ticket.delete({
      where: { id }
    });
    
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('Failed to delete ticket:', err);
    if (err && typeof err === 'object' && 'status' in err && (err.status === 404 || err.status === 400)) {
      throw err;
    }
    throw error(500, 'Failed to delete ticket');
  }
};