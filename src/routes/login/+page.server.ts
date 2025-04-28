import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // If user is already authenticated, redirect to home
  if (locals.user) {
    throw redirect(302, '/');
  }

  return {};
};