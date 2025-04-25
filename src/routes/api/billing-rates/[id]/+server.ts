import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';

export const PUT: RequestHandler = async ({ params, request }) => {
  const { id } = params;
  const data = await request.json();
  
  // If this is being set as default, unset any existing default
  if (data.isDefault) {
    await prisma.billingRate.updateMany({
      where: { 
        isDefault: true,
        id: { not: id }
      },
      data: { isDefault: false }
    });
  }
  
  const rate = await prisma.billingRate.update({
    where: { id },
    data
  });
  
  return json(rate);
};

export const DELETE: RequestHandler = async ({ params }) => {
  const { id } = params;
  
  // First check if this is the default rate
  const rate = await prisma.billingRate.findUnique({
    where: { id }
  });
  
  if (!rate) {
    return json({ error: 'Rate not found' }, { status: 404 });
  }
  
  if (rate.isDefault) {
    return json({ 
      error: 'Cannot delete the default billing rate' 
    }, { status: 400 });
  }
  
  await prisma.billingRate.delete({
    where: { id }
  });
  
  return json({ success: true });
};