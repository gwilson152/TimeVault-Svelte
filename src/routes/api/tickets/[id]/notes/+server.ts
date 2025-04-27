import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

// GET /api/tickets/[id]/notes - Retrieves all notes for a ticket
export async function GET({ params }) {
  const { id } = params;
  
  try {
    const notes = await prisma.ticketNote.findMany({
      where: { ticketId: id },
      include: { 
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return json(notes);
  } catch (error) {
    console.error('Failed to fetch ticket notes:', error);
    return json({ error: 'Failed to fetch ticket notes' }, { status: 500 });
  }
}

// POST /api/tickets/[id]/notes - Creates a new note for a ticket
export async function POST({ params, request }) {
  const { id } = params;
  
  try {
    // Validate ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id }
    });
    
    if (!ticket) {
      return json({ error: 'Ticket not found' }, { status: 404 });
    }
    
    const { content, isInternal, userId } = await request.json();
    
    // Validate user exists if userId is provided
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user) {
        return json({ error: 'User not found' }, { status: 404 });
      }
    }
    
    // Create the note
    const note = await prisma.ticketNote.create({
      data: {
        content,
        isInternal: isInternal || false,
        userId,
        ticketId: id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });
    
    return json(note);
  } catch (error) {
    console.error('Failed to create ticket note:', error);
    return json({ error: 'Failed to create ticket note' }, { status: 500 });
  }
}