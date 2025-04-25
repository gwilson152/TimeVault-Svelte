import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export async function PUT({ params, request }) {
  try {
    const data = await request.json();
    const setting = await prisma.settings.update({
      where: { key: params.key },
      data
    });
    return json(setting);
  } catch (error) {
    console.error('Failed to update setting:', error);
    return json({ error: 'Failed to update setting' }, { status: 500 });
  }
}

export async function PATCH({ params, request }) {
  try {
    const { value } = await request.json();
    const updated = await prisma.settings.update({
      where: { key: params.key },
      data: { value }
    });
    return json(updated);
  } catch (error) {
    console.error(`Failed to update setting ${params.key}:`, error);
    return json({ error: 'Failed to update setting' }, { status: 500 });
  }
}