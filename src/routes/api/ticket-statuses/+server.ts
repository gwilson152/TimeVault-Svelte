import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export async function GET() {
  try {
    const statuses = await prisma.ticketStatus.findMany({
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });
    return json(statuses);
  } catch (error) {
    console.error('Failed to fetch ticket statuses:', error);
    return json({ error: 'Failed to fetch ticket statuses' }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.name || !data.color) {
      return json({ error: 'Name and color are required' }, { status: 400 });
    }

    // If this is being set as default, unset any existing default
    if (data.isDefault) {
      await prisma.ticketStatus.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const status = await prisma.ticketStatus.create({
      data: {
        name: data.name,
        color: data.color,
        isDefault: data.isDefault || false,
        isClosed: data.isClosed || false,
        sortOrder: data.sortOrder || 0
      }
    });
    
    return json(status);
  } catch (error) {
    console.error('Failed to create ticket status:', error);
    return json({ error: 'Failed to create ticket status' }, { status: 500 });
  }
}