import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { timeEntrySchema } from '$lib/types';
import { timeEntryStore } from '$lib/stores/timeEntryStore';

export const load = async () => {
  const form = await superValidate(zod(timeEntrySchema));
  return { form };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, zod(timeEntrySchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }

    try {
      await timeEntryStore.add({
        description: form.data.description,
        hours: form.data.hours,
        date: new Date(form.data.date),
        clientId: form.data.clientId,
        ticketId: form.data.ticketId,
        billable: form.data.billable
      });
      return { form };
    } catch (err) {
      console.error('Failed to create time entry:', err);
      return fail(500, { 
        form,
        error: 'Failed to create time entry'
      });
    }
  }
};