import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export async function PUT({ params, request }) {
  try {
    const { title, description, clientId } = await request.json();

    const ticket = await prisma.ticket.update({
      where: { id: params.id },
      data: {
        title,
        description,
        clientId
      },
      include: { client: true }
    });
    return json(ticket);
  } catch (error) {
    console.error('Failed to update ticket:', error);
    return json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}

export async function DELETE({ params }) {
  try {
    await prisma.ticket.delete({
      where: { id: params.id }
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete ticket:', error);
    return json({ error: 'Failed to delete ticket' }, { status: 500 });
  }
}