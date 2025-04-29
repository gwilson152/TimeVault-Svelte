import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { id } = params;
    
    // Check if ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id }
    });
    
    if (!ticket) {
      throw error(404, 'Ticket not found');
    }
    
    // Get notes for this ticket
    const notes = await prisma.ticketNote.findMany({
      where: { 
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return json(notes);
  } catch (err) {
    console.error('Error fetching ticket notes:', err);
    if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
      throw err;
    }
    throw error(500, 'Failed to fetch ticket notes');
  }
};

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const { id } = params;
    const data = await request.json();
    
    // Validate required fields
    if (!data.content || !data.userId) {
      return json({ 
        error: 'Content and userId are required' 
      }, { status: 400 });
    }
    
    // Check if ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id }
    });
    
    if (!ticket) {
      throw error(404, 'Ticket not found');
    }
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: data.userId }
    });
    
    if (!user) {
      throw error(404, 'User not found');
    }
    
    // Create note
    const note = await prisma.ticketNote.create({
      data: {
        content: data.content,
        isInternal: data.isInternal || false,
        ticketId: id,
        userId: data.userId
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
  } catch (err) {
    console.error('Failed to create ticket note:', err);
    if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
      throw err;
    }
    throw error(500, 'Failed to create ticket note');
  }
};