import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import type { NewBillingRateOverride } from '$lib/types';

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      include: { billingRateOverrides: true },
      orderBy: { name: 'asc' }
    });
    return json(clients);
  } catch (error) {
    console.error('Failed to fetch clients:', error);
    return json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const { billingRateOverrides, ...clientData } = await request.json();

    if (!clientData.name || typeof clientData.name !== 'string') {
      return json({ error: 'Client name is required and must be a string' }, { status: 400 });
    }

    if (clientData.type && !['business', 'individual', 'organization'].includes(clientData.type)) {
      return json({ error: 'Invalid client type' }, { status: 400 });
    }

    // Ensure rate is a number
    if (typeof clientData.rate !== 'number') {
      clientData.rate = 0;
    }

    // If parentId is provided, validate the parent exists and is a valid type
    if (clientData.parentId) {
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
    }

    const client = await prisma.client.create({
      data: {
        ...clientData,
        billingRateOverrides: {
          create: billingRateOverrides?.map((override: NewBillingRateOverride) => ({
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
    console.error('Failed to create client:', error);
    return json({ error: 'Failed to create client' }, { status: 500 });
  }
}