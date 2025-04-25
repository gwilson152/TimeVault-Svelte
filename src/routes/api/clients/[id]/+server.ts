import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import type { NewBillingRateOverride } from '$lib/types';

export async function PUT({ params, request }) {
  try {
    const { id } = params;
    const { billingRateOverrides, ...clientData } = await request.json();

    if (clientData.name && typeof clientData.name !== 'string') {
      return json({ error: 'Client name must be a string' }, { status: 400 });
    }

    if (clientData.type && !['business', 'individual', 'organization'].includes(clientData.type)) {
      return json({ error: 'Invalid client type' }, { status: 400 });
    }

    // If parentId is being updated, validate the parent exists and is a valid type
    if (clientData.parentId) {
      // Prevent self-referential parent
      if (clientData.parentId === id) {
        return json({ error: 'Client cannot be its own parent' }, { status: 400 });
      }

      const parentClient = await prisma.client.findUnique({
        where: { id: clientData.parentId }
      });
      
      if (!parentClient) {
        return json({ error: 'Parent client not found' }, { status: 400 });
      }

      // Only business or organization clients can be parents
      if (!['business', 'organization'].includes(parentClient.type)) {
        return json(
          { error: 'Only business or organization clients can have sub-clients' }, 
          { status: 400 }
        );
      }

      // Prevent circular references - check if the proposed parent is a descendant
      const isDescendant = async (parentId: string, childId: string): Promise<boolean> => {
        const parent = await prisma.client.findUnique({
          where: { id: parentId },
          select: { parentId: true }
        });

        if (!parent || !parent.parentId) return false;
        if (parent.parentId === childId) return true;
        return isDescendant(parent.parentId, childId);
      };

      if (await isDescendant(clientData.parentId, id)) {
        return json({ error: 'Cannot create circular parent-child relationship' }, { status: 400 });
      }
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...clientData,
        billingRateOverrides: billingRateOverrides && {
          deleteMany: {},
          create: billingRateOverrides.map((override: NewBillingRateOverride) => ({
            baseRateId: override.baseRateId,
            overrideType: override.overrideType,
            value: override.value
          }))
        }
      },
      include: { billingRateOverrides: true }
    });

    return json(client);
  } catch (error) {
    console.error('Failed to update client:', error);
    return json({ error: 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE({ params }) {
  try {
    await prisma.client.delete({
      where: { id: params.id }
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete client:', error);
    return json({ error: 'Failed to delete client' }, { status: 500 });
  }
}