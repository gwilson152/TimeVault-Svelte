import { writable, derived, type Readable } from 'svelte/store';
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

interface SettingsStore extends Readable<Settings[]> {
  ticketSettings: Readable<TicketSettings>;
  billingRates: Readable<BillingRate[]>;
  load: () => Promise<void>;
  createTicketStatus: (status: Omit<TicketStatus, 'id' | 'createdAt' | 'updatedAt'>) => Promise<TicketStatus>;
  updateTicketStatus: (status: TicketStatus) => Promise<TicketStatus>;
  deleteTicketStatus: (id: string) => Promise<void>;
  createBillingRate: (rate: NewBillingRate) => Promise<BillingRate>;
  updateBillingRate: (id: string, rate: Partial<BillingRate>) => Promise<BillingRate>;
  deleteBillingRate: (id: string) => Promise<void>;
}

function createSettingsStore(): SettingsStore {
  const { subscribe, update } = writable<Settings[]>([]);
  const ticketStatuses = writable<TicketStatus[]>([]);
  const billingRates = writable<BillingRate[]>([]);

  function logDebug(action: string, data?: any) {
    console.debug(`⚙️ SettingsStore [${action}]`, data || '');
  }

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

  let initialized = false;

  return {
    subscribe,
    ticketSettings,
    billingRates: {
      subscribe: billingRates.subscribe,
    },

    async load() {
      logDebug('load:start', { initialized });
      if (initialized) return;
      
      try {
        // Load settings, ticket statuses, and billing rates in parallel
        const [settingsResult, statusesResult, ratesResult] = await Promise.allSettled([
          getSettings(),
          getTicketStatuses(),
          getBillingRates()
        ]);

        // Handle settings
        if (settingsResult.status === 'fulfilled') {
          logDebug('load:settings success', { count: settingsResult.value.length });
          update(() => settingsResult.value);
        } else {
          logDebug('load:settings error', settingsResult.reason);
          console.error('Failed to load settings:', settingsResult.reason);
        }

        // Handle ticket statuses
        if (statusesResult.status === 'fulfilled') {
          logDebug('load:statuses success', { count: statusesResult.value.length });
          ticketStatuses.set(statusesResult.value);
        } else {
          logDebug('load:statuses error', statusesResult.reason);
          console.error('Failed to load ticket statuses:', statusesResult.reason);
          ticketStatuses.set([]);
        }

        // Handle billing rates
        if (ratesResult.status === 'fulfilled') {
          logDebug('load:rates success', { count: ratesResult.value.length });
          billingRates.set(ratesResult.value);
        } else {
          logDebug('load:rates error', ratesResult.reason);
          console.error('Failed to load billing rates:', ratesResult.reason);
          billingRates.set([]);
        }

        initialized = true;
      } catch (error) {
        logDebug('load:error', error);
        console.error('Settings store load failed:', error);
        throw error;
      }
    },

    // Ticket status management
    async createTicketStatus(status: Omit<TicketStatus, 'id' | 'createdAt' | 'updatedAt'>) {
      logDebug('createTicketStatus:start', status);
      try {
        const newStatus = await createTicketStatus(status);
        logDebug('createTicketStatus:success', { id: newStatus.id });
        ticketStatuses.update(statuses => [...statuses, newStatus]);
        return newStatus;
      } catch (error) {
        logDebug('createTicketStatus:error', error);
        throw error;
      }
    },

    async updateTicketStatus(status: TicketStatus) {
      logDebug('updateTicketStatus:start', { id: status.id });
      try {
        const updatedStatus = await updateTicketStatus(status.id, status);
        logDebug('updateTicketStatus:success', { id: status.id });
        ticketStatuses.update(statuses =>
          statuses.map(s => s.id === status.id ? updatedStatus : s)
        );
        return updatedStatus;
      } catch (error) {
        logDebug('updateTicketStatus:error', error);
        throw error;
      }
    },

    async deleteTicketStatus(id: string) {
      logDebug('deleteTicketStatus:start', { id });
      try {
        await deleteTicketStatus(id);
        logDebug('deleteTicketStatus:success', { id });
        ticketStatuses.update(statuses => 
          statuses.filter(s => s.id !== id)
        );
      } catch (error) {
        logDebug('deleteTicketStatus:error', error);
        throw error;
      }
    },

    // Billing rates management
    async createBillingRate(rate: NewBillingRate) {
      logDebug('createBillingRate:start', rate);
      try {
        const newRate = await createBillingRate(rate);
        logDebug('createBillingRate:success', { id: newRate.id });
        billingRates.update(rates => [...rates, newRate]);
        return newRate;
      } catch (error) {
        logDebug('createBillingRate:error', error);
        throw error;
      }
    },

    async updateBillingRate(id: string, rate: Partial<BillingRate>) {
      logDebug('updateBillingRate:start', { id, changes: rate });
      try {
        const updatedRate = await updateBillingRate(id, rate);
        logDebug('updateBillingRate:success', { id });
        billingRates.update(rates =>
          rates.map(r => r.id === id ? updatedRate : r)
        );
        return updatedRate;
      } catch (error) {
        logDebug('updateBillingRate:error', error);
        throw error;
      }
    },

    async deleteBillingRate(id: string) {
      logDebug('deleteBillingRate:start', { id });
      try {
        await deleteBillingRate(id);
        logDebug('deleteBillingRate:success', { id });
        billingRates.update(rates => 
          rates.filter(r => r.id !== id)
        );
      } catch (error) {
        logDebug('deleteBillingRate:error', error);
        throw error;
      }
    }
  };
}

export const settingsStore = createSettingsStore();