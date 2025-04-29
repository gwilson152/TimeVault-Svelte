import { derived, type Writable } from 'svelte/store';
import type { TimeEntry, NewTimeEntry, Client } from '$lib/types';
import * as api from '$lib/services/api';
import { settingsStore } from './settingsStore';
import { calculateDurationInMinutes, calculateEndTime } from '$lib/utils/timeUtils';
import { getClientHierarchy, getEffectiveBillingRateOverride } from '$lib/utils/clientUtils';
import { baseTimeEntryStore, baseClientStore } from './storeInitializer';

interface TimeEntryStore {
  subscribe: Writable<TimeEntry[]>['subscribe'];
  load: () => Promise<void>;
  add: (entry: NewTimeEntry) => Promise<TimeEntry>;
  update: (id: string, entry: Partial<NewTimeEntry>) => Promise<TimeEntry>;
  remove: (id: string) => Promise<void>;
  markAsBilled: (entryIds: string[]) => Promise<void>;
  getByClientId: (clientId: string) => TimeEntry[];
  getUnbilledByClientId: (clientId: string, includeSubClients?: boolean) => TimeEntry[];
  reset: () => void;
}

function createTimeEntryStore(): TimeEntryStore {
  const { subscribe, set, update } = baseTimeEntryStore;
  let initialized = false;

  function logDebug(action: string, data?: any) {
    console.debug(`⏱️ TimeEntryStore [${action}]`, data || '');
  }

  function formatTimeEntry(entry: TimeEntry): TimeEntry {
    // Ensure we have properly formatted dates
    const startTime = entry.startTime ? new Date(entry.startTime) : new Date();
    const endTime = entry.endTime ? new Date(entry.endTime) : null;
    const minutes = entry.minutes || (endTime ? calculateDurationInMinutes(startTime, endTime) : 0);

    logDebug('formatTimeEntry', { 
      id: entry.id,
      startTime,
      endTime,
      minutes
    });

    return {
      ...entry,
      startTime,
      endTime,
      minutes,
      date: entry.date ? new Date(entry.date) : startTime
    };
  }

  const store: TimeEntryStore = {
    subscribe,

    async load() {
      logDebug('load:start', { initialized });
      if (initialized) return;

      try {
        const entries = await api.getTimeEntries();
        logDebug('load:success', { entryCount: entries.length });
        set(entries.map(formatTimeEntry));
        initialized = true;
      } catch (error) {
        logDebug('load:error', error);
        console.error('Failed to load time entries:', error);
        set([]);
        throw error;
      }
    },

    async add(entry: NewTimeEntry) {
      logDebug('add:start', { 
        description: entry.description,
        clientId: entry.clientId,
        minutes: entry.minutes 
      });

      try {
        // Ensure all date fields are proper Date objects
        const formattedEntry = {
          ...entry,
          startTime: entry.startTime instanceof Date ? entry.startTime : new Date(entry.startTime || new Date()),
          endTime: entry.endTime ? (entry.endTime instanceof Date ? entry.endTime : new Date(entry.endTime)) : null,
          minutes: entry.minutes || 0,
          date: entry.date instanceof Date ? entry.date : new Date(entry.date || new Date())
        };

        // Calculate minutes or end time if needed
        if (!formattedEntry.minutes && formattedEntry.endTime) {
          formattedEntry.minutes = calculateDurationInMinutes(formattedEntry.startTime, formattedEntry.endTime);
        } else if (formattedEntry.minutes && !formattedEntry.endTime) {
          formattedEntry.endTime = calculateEndTime(formattedEntry.startTime, formattedEntry.minutes);
        }

        logDebug('add:formatted', {
          ...formattedEntry,
          startTime: formattedEntry.startTime instanceof Date ? 'Date object' : typeof formattedEntry.startTime,
          endTime: formattedEntry.endTime instanceof Date ? 'Date object' : typeof formattedEntry.endTime,
          date: formattedEntry.date instanceof Date ? 'Date object' : typeof formattedEntry.date
        });

        const newEntry = await api.createTimeEntry(formattedEntry);
        logDebug('add:success', { id: newEntry.id });
        update(entries => [...entries, formatTimeEntry(newEntry)]);
        return newEntry;
      } catch (error) {
        logDebug('add:error', error);
        console.error('Failed to add time entry:', error);
        throw error;
      }
    },

    async update(id: string, entry: Partial<NewTimeEntry>) {
      logDebug('update:start', { id, changes: entry });
      try {
        // Get the current entry to check if it's locked
        let entries: TimeEntry[] = [];
        store.subscribe(value => {
          entries = value;
        })();
        
        const currentEntry = entries.find(e => e.id === id);
        
        // Prevent updates to locked or billed entries
        if (currentEntry && (currentEntry.locked || currentEntry.billed)) {
          const errorMessage = 'Cannot update a locked time entry. This entry is associated with an invoice.';
          logDebug('update:error', errorMessage);
          throw new Error(errorMessage);
        }

        let updatedFields: Partial<NewTimeEntry> = { ...entry };

        // If we have both start and end time, calculate minutes
        if (entry.startTime && entry.endTime) {
          updatedFields.minutes = calculateDurationInMinutes(entry.startTime, entry.endTime);
          logDebug('update:calculatedminutes', { 
            minutes: updatedFields.minutes,
            startTime: entry.startTime,
            endTime: entry.endTime
          });
        }
        // If we have start time and minutes, calculate end time
        else if (entry.startTime && entry.minutes) {
          updatedFields.endTime = calculateEndTime(entry.startTime, entry.minutes);
          logDebug('update:calculatedEndTime', {
            endTime: updatedFields.endTime,
            startTime: entry.startTime,
            minutes: entry.minutes
          });
        }

        const updatedEntry = await api.updateTimeEntry(id, updatedFields);
        logDebug('update:success', { id });

        update(entries => entries.map(e =>
          e.id === id ? formatTimeEntry(updatedEntry) : e
        ));

        return updatedEntry;
      } catch (error) {
        logDebug('update:error', error);
        console.error('Failed to update time entry:', error);
        throw error;
      }
    },

    async remove(id: string) {
      logDebug('remove:start', { id });
      try {
        // Get the current entry to check if it's locked
        let entries: TimeEntry[] = [];
        store.subscribe(value => {
          entries = value;
        })();
        
        const currentEntry = entries.find(e => e.id === id);
        
        // Prevent deletion of locked or billed entries
        if (currentEntry && (currentEntry.locked || currentEntry.billed)) {
          const errorMessage = 'Cannot delete a locked time entry. This entry is associated with an invoice.';
          logDebug('remove:error', errorMessage);
          throw new Error(errorMessage);
        }
        
        await api.deleteTimeEntry(id);
        logDebug('remove:success', { id });
        update(entries => entries.filter(e => e.id !== id));
      } catch (error) {
        logDebug('remove:error', error);
        console.error('Failed to delete time entry:', error);
        throw error;
      }
    },

    async markAsBilled(entryIds: string[]) {
      logDebug('markAsBilled:start', { count: entryIds.length });
      try {
        await Promise.all(entryIds.map(id =>
          api.updateTimeEntry(id, { 
            billed: true, 
            locked: true // Also lock entries when they're marked as billed
          })
        ));

        logDebug('markAsBilled:success', { entryIds });
        update(entries => entries.map(entry =>
          entryIds.includes(entry.id)
            ? { ...entry, billed: true, locked: true }
            : entry
        ));
      } catch (error) {
        logDebug('markAsBilled:error', error);
        console.error('Failed to mark entries as billed:', error);
        throw error;
      }
    },

    getByClientId(clientId: string) {
      logDebug('getByClientId:start', { clientId });
      let entries: TimeEntry[] = [];
      store.subscribe(value => {
        entries = value;
      })();

      const filtered = entries.filter(entry => 
        entry.clientId === clientId && entry.billable && !entry.billed
      );
      logDebug('getByClientId:complete', { 
        clientId, 
        entriesFound: filtered.length 
      });
      return filtered;
    },

    getUnbilledByClientId(clientId: string, includeSubClients = true) {
      logDebug('getUnbilledByClientId:start', { 
        clientId, 
        includeSubClients 
      });

      let entries: TimeEntry[] = [];
      store.subscribe(value => { entries = value; })();

      let clients: Client[] = [];
      baseClientStore.subscribe(value => { clients = value; })();

      const clientIds = includeSubClients
        ? getClientHierarchy(clients, clientId).map(c => c.id)
        : [clientId];

      const filtered = entries.filter(entry =>
        entry.clientId && 
        clientIds.includes(entry.clientId) && 
        entry.billable && 
        !entry.billed
      );

      logDebug('getUnbilledByClientId:complete', { 
        clientId,
        totalEntries: filtered.length,
        clientCount: clientIds.length
      });

      return filtered;
    },

    reset() {
      logDebug('reset');
      set([]);
      initialized = false;
    }
  };

  return store;
}

export const timeEntryStore = createTimeEntryStore();

// Derived store that includes client and billing rate information with inherited overrides
export const entriesWithClientInfo = derived(
  [baseTimeEntryStore, baseClientStore, settingsStore.billingRates],
  ([$timeEntryStore, $clientStore, $billingRates]) => {
    return $timeEntryStore.map(entry => {
      const client = entry.clientId ? $clientStore.find(c => c.id === entry.clientId) : null;
      const billingRate = entry.billingRateId ? $billingRates.find(r => r.id === entry.billingRateId) : null;

      // Get effective billing rate with parent client inheritance
      let effectiveRate = billingRate?.rate ?? 0;
      if (client && billingRate) {
        // Get the effective override considering parent hierarchy
        const override = getEffectiveBillingRateOverride($clientStore, entry.clientId, billingRate.id);
        
        if (override) {
          effectiveRate = override.overrideType === 'fixed'
            ? override.value
            : billingRate.rate * (override.value / 100);
        }
      }

      // Calculate duration in hours for display
      const durationHours = entry.minutes ? entry.minutes / 60 : 0;

      return {
        ...entry,
        clientName: client?.name || 'Unknown Client',
        client,
        durationHours,
        billingRate: billingRate ? {
          ...billingRate,
          rate: effectiveRate
        } : undefined,
        // Add invoice info if entry is billed
        invoice: entry.invoiceId ? {
          id: entry.invoiceId,
          // Invoice number will be fetched from the server when needed
          invoiceNumber: undefined
        } : undefined
      };
    });
  }
);