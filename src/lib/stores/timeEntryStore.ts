import { writable, derived } from 'svelte/store';
import type { TimeEntry } from '$lib/types';
import { get, post, put, del } from '$lib/services/api';
import { clientStore } from './clientStore';
import { settingsStore } from './settingsStore';

function createTimeEntryStore() {
  const { subscribe, set, update } = writable<TimeEntry[]>([]);
  const { subscribe: subscribeToLoading, set: setLoading } = writable(false);
  let initialized = false;

  return {
    subscribe,
    loading: { subscribe: subscribeToLoading },
    
    async load(force = false) {
      if (initialized && !force) return;
      
      try {
        setLoading(true);
        const entries = await get<TimeEntry[]>('/time-entries');
        set(entries || []);
        initialized = true;
      } catch (error) {
        console.error('Failed to load time entries:', error);
        set([]);
      } finally {
        setLoading(false);
      }
    },

    async add(entry: Omit<TimeEntry, 'id' | 'billed' | 'invoiceId' | 'createdAt' | 'updatedAt'>) {
      try {
        const newEntry = await post<TimeEntry>('/time-entries', entry);
        update(entries => [...entries, newEntry]);
        return newEntry;
      } catch (error) {
        console.error('Failed to add time entry:', error);
        throw error;
      }
    },

    async update(id: string, entry: Partial<TimeEntry>) {
      try {
        const updatedEntry = await put<TimeEntry>(`/time-entries/${id}`, entry);
        update(entries => entries.map(e => e.id === id ? updatedEntry : e));
        return updatedEntry;
      } catch (error) {
        console.error('Failed to update time entry:', error);
        throw error;
      }
    },

    async remove(id: string) {
      try {
        await del(`/time-entries/${id}`);
        update(entries => entries.filter(e => e.id !== id));
      } catch (error) {
        console.error('Failed to delete time entry:', error);
        throw error;
      }
    },

    getByClientId(clientId: string): TimeEntry[] {
      let entries: TimeEntry[] = [];
      update(currentEntries => {
        entries = currentEntries.filter(entry => entry.clientId === clientId);
        return currentEntries;
      });
      return entries;
    },

    getUnbilledByClientId(clientId: string): TimeEntry[] {
      let unbilledEntries: TimeEntry[] = [];
      update(currentEntries => {
        unbilledEntries = currentEntries.filter(entry => entry.clientId === clientId && !entry.billed);
        return currentEntries;
      });
      return unbilledEntries;
    },

    async markAsBilled(entryIds: string[]) {
      try {
        await Promise.all(
          entryIds.map(id => 
            put<TimeEntry>(`/time-entries/${id}`, { billed: true })
          )
        );
        update(entries => 
          entries.map(entry => 
            entryIds.includes(entry.id) ? { ...entry, billed: true } : entry
          )
        );
      } catch (error) {
        console.error('Failed to mark entries as billed:', error);
        throw error;
      }
    },

    reset() {
      set([]);
      initialized = false;
    }
  };
}

export const timeEntryStore = createTimeEntryStore();

// Derived store that includes client and billing rate information
export const entriesWithClientInfo = derived(
  [timeEntryStore, clientStore, settingsStore.billingRates],
  ([$timeEntries, $clients, $billingRates]) => {
    if (!$timeEntries || !$clients || !$billingRates) return [];
    
    return $timeEntries.map(entry => {
      if (!entry) return null;
      const client = entry.clientId ? $clients.find(c => c.id === entry.clientId) : null;
      const billingRate = entry.billingRateId ? $billingRates.find(r => r.id === entry.billingRateId) : null;
      
      // Get client billing rate override if it exists
      let effectiveRate = billingRate?.rate ?? 0;
      if (client && billingRate) {
        const override = client.billingRateOverrides.find(o => o.baseRateId === billingRate.id);
        if (override) {
          effectiveRate = override.overrideType === 'fixed' 
            ? override.value 
            : billingRate.rate * (override.value / 100);
        }
      }
      
      return {
        ...entry,
        clientName: client?.name || 'Unknown Client',
        billingRate: billingRate ? {
          ...billingRate,
          rate: effectiveRate
        } : undefined
      };
    }).filter(Boolean);
  }
);