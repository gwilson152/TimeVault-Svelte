import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';

export const GET: RequestHandler = async () => {
  const rates = await prisma.billingRate.findMany({
    orderBy: { name: 'asc' }
  });
  return json(rates);
};

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();
  
  // If this is being set as default, unset any existing default
  if (data.isDefault) {
    await prisma.billingRate.updateMany({
      where: { isDefault: true },
      data: { isDefault: false }
    });
  }
  
  const rate = await prisma.billingRate.create({
    data
  });
  
  return json(rate);
};