import { writable, derived } from 'svelte/store';
import type { Settings, TicketStatus, BillingRate, NewBillingRate } from '$lib/types';
import { getSettings, getTicketStatuses, createTicketStatus, updateTicketStatus, deleteTicketStatus, getBillingRates, createBillingRate, updateBillingRate, deleteBillingRate } from '$lib/services/api';

interface TicketSettings {
  statuses: TicketStatus[];
  priorities: string[];
  addonTypes: Array<{
    name: string;
    defaultAmount: number;
    description?: string;
  }>;
}

function createSettingsStore() {
  const { subscribe, update } = writable<Settings[]>([]);
  const ticketStatuses = writable<TicketStatus[]>([]);
  const billingRates = writable<BillingRate[]>([]);

  // Create derived store for ticket settings
  const ticketSettings = derived(
    [ticketStatuses],
    ([$ticketStatuses]) => {
      return {
        statuses: $ticketStatuses,
        priorities: ['Low', 'Medium', 'High', 'Urgent'],
        addonTypes: [
          { name: 'Travel', defaultAmount: 50 },
          { name: 'Materials', defaultAmount: 0 },
          { name: 'Equipment', defaultAmount: 100 }
        ]
      } as TicketSettings;
    }
  );

  return {
    subscribe,
    ticketSettings,
    billingRates: {
      subscribe: billingRates.subscribe,
    },

    async load() {
      const [settings, statuses, rates] = await Promise.all([
        getSettings(),
        getTicketStatuses(),
        getBillingRates()
      ]);

      update(() => settings);
      ticketStatuses.set(statuses);
      billingRates.set(rates);
    },

    // Ticket status management
    async createTicketStatus(status: Omit<TicketStatus, 'id' | 'createdAt' | 'updatedAt'>) {
      const newStatus = await createTicketStatus(status);
      ticketStatuses.update(statuses => [...statuses, newStatus]);
      return newStatus;
    },

    async updateTicketStatus(status: TicketStatus) {
      const updatedStatus = await updateTicketStatus(status.id, status);
      ticketStatuses.update(statuses => 
        statuses.map(s => s.id === status.id ? updatedStatus : s)
      );
      return updatedStatus;
    },

    async deleteTicketStatus(id: string) {
      await deleteTicketStatus(id);
      ticketStatuses.update(statuses => statuses.filter(s => s.id !== id));
    },

    // Billing rates management
    async createBillingRate(rate: NewBillingRate) {
      const newRate = await createBillingRate(rate);
      billingRates.update(rates => [...rates, newRate]);
      return newRate;
    },

    async updateBillingRate(id: string, rate: Partial<BillingRate>) {
      const updatedRate = await updateBillingRate(id, rate);
      billingRates.update(rates => 
        rates.map(r => r.id === id ? updatedRate : r)
      );
      return updatedRate;
    },

    async deleteBillingRate(id: string) {
      await deleteBillingRate(id);
      billingRates.update(rates => rates.filter(r => r.id !== id));
    }
  };
}

export const settingsStore = createSettingsStore();