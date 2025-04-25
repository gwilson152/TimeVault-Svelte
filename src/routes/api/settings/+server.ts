import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export async function GET({ url }) {
  try {
    const category = url.searchParams.get('category');
    const where = category ? { category } : {};

    const settings = await prisma.settings.findMany({
      where,
      orderBy: { category: 'asc' }
    });
    return json(settings);
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const data = await request.json();
    const setting = await prisma.settings.create({ data });
    return json(setting);
  } catch (error) {
    console.error('Failed to create setting:', error);
    return json({ error: 'Failed to create setting' }, { status: 500 });
  }
}