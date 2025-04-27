import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export async function PUT({ params, request }) {
  try {
    const { id } = params;
    const data = await request.json();
    
    // If this is being set as default, unset any existing default
    if (data.isDefault) {
      await prisma.ticketStatus.updateMany({
        where: { 
          isDefault: true,
          id: { not: id }
        },
        data: { isDefault: false }
      });
    }
    
    const status = await prisma.ticketStatus.update({
      where: { id },
      data: {
        name: data.name,
        color: data.color,
        isDefault: data.isDefault,
        isClosed: data.isClosed,
        sortOrder: data.sortOrder
      }
    });
    
    return json(status);
  } catch (error) {
    console.error('Failed to update ticket status:', error);
    return json({ error: 'Failed to update ticket status' }, { status: 500 });
  }
}

export async function DELETE({ params }) {
  try {
    const { id } = params;
    
    // First check if this is the default status
    const status = await prisma.ticketStatus.findUnique({
      where: { id }
    });
    
    if (!status) {
      return json({ error: 'Status not found' }, { status: 404 });
    }
    
    if (status.isDefault) {
      return json({ 
        error: 'Cannot delete the default ticket status' 
      }, { status: 400 });
    }
    
    // Check if there are any tickets using this status
    const ticketsWithStatus = await prisma.ticket.count({
      where: { statusId: id }
    });
    
    if (ticketsWithStatus > 0) {
      return json({ 
        error: `Cannot delete status that is used by ${ticketsWithStatus} tickets` 
      }, { status: 400 });
    }
    
    await prisma.ticketStatus.delete({
      where: { id }
    });
    
    return json({ success: true });
  } catch (error) {
    console.error('Failed to delete ticket status:', error);
    return json({ error: 'Failed to delete ticket status' }, { status: 500 });
  }
}