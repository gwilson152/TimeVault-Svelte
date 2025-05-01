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

  function formatTimeEntry(entry: TimeEntry): TimeEntry {
    // Ensure we have properly formatted dates
    const startTime = entry.startTime && (typeof entry.startTime === 'string' || entry.startTime instanceof Date)
      ? new Date(entry.startTime)
      : new Date();
    if (isNaN(startTime.getTime())) {
      console.warn('Invalid startTime:', { id: entry.id, startTime: entry.startTime, type: typeof entry.startTime });
      startTime.setTime(new Date().getTime());
    }
    const endTime = entry.endTime && (typeof entry.endTime === 'string' || entry.endTime instanceof Date)
      ? new Date(entry.endTime)
      : null;
    if (endTime && isNaN(endTime.getTime())) {
      console.warn('Invalid endTime:', { id: entry.id, endTime: entry.endTime, type: typeof entry.endTime });
      return {
        ...entry,
        startTime,
        endTime: null,
        minutes: entry.minutes || 0,
        date: entry.date ? new Date(entry.date) : startTime
      };
    }
    const minutes = entry.minutes || (endTime ? calculateDurationInMinutes(startTime, endTime) : 0);
    const date = entry.date && (typeof entry.date === 'string' || entry.date instanceof Date)
      ? new Date(entry.date)
      : startTime;
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', { id: entry.id, date: entry.date, type: typeof entry.date });
      date.setTime(startTime.getTime());
    }

    console.log('TimeEntryStore formatTimeEntry:', { 
      id: entry.id,
      startTime,
      endTime,
      minutes,
      date
    });

    return {
      ...entry,
      startTime,
      endTime,
      minutes,
      date
    };
  }

  const store: TimeEntryStore = {
    subscribe,

    async load() {
      console.log('TimeEntryStore load:start', { initialized });
      if (initialized) return;

      try {
        const entries = await api.getTimeEntries();
        console.log('TimeEntryStore load:success', { entryCount: entries.length });
        set(entries.map(formatTimeEntry));
        initialized = true;
      } catch (error) {
        console.error('TimeEntryStore load:error', error);
        set([]);
        throw error;
      }
    },

    async add(entry: NewTimeEntry) {
      console.log('TimeEntryStore add:start', { 
        description: entry.description,
        clientId: entry.clientId,
        minutes: entry.minutes 
      });

      try {
        // Ensure all date fields are proper Date objects
        const formattedEntry = {
          ...entry,
          startTime: entry.startTime && (typeof entry.startTime === 'string' || entry.startTime instanceof Date)
            ? new Date(entry.startTime)
            : new Date(),
          endTime: entry.endTime && (typeof entry.endTime === 'string' || entry.endTime instanceof Date)
            ? new Date(entry.endTime)
            : null,
          minutes: entry.minutes || 0,
          date: entry.date && (typeof entry.date === 'string' || entry.date instanceof Date)
            ? new Date(entry.date)
            : new Date()
        };

        // Validate dates
        if (isNaN(formattedEntry.startTime.getTime())) {
          console.warn('Invalid startTime in add:', formattedEntry.startTime);
          formattedEntry.startTime = new Date();
        }
        if (formattedEntry.endTime && isNaN(formattedEntry.endTime.getTime())) {
          console.warn('Invalid endTime in add:', formattedEntry.endTime);
          formattedEntry.endTime = null;
        }
        if (isNaN(formattedEntry.date.getTime())) {
          console.warn('Invalid date in add:', formattedEntry.date);
          formattedEntry.date = formattedEntry.startTime;
        }

        // Calculate minutes or end time if needed
        if (!formattedEntry.minutes && formattedEntry.endTime) {
          formattedEntry.minutes = calculateDurationInMinutes(formattedEntry.startTime, formattedEntry.endTime);
        } else if (formattedEntry.minutes && !formattedEntry.endTime) {
          formattedEntry.endTime = calculateEndTime(formattedEntry.startTime, formattedEntry.minutes);
        }

        console.log('TimeEntryStore add:formatted', {
          ...formattedEntry,
          startTime: formattedEntry.startTime instanceof Date ? 'Date object' : typeof formattedEntry.startTime,
          endTime: formattedEntry.endTime instanceof Date ? 'Date object' : typeof formattedEntry.endTime,
          date: formattedEntry.date instanceof Date ? 'Date object' : typeof formattedEntry.date
        });

        const newEntry = await api.createTimeEntry(formattedEntry);
        console.log('TimeEntryStore add:success', { id: newEntry.id });
        update(entries => [...entries, formatTimeEntry(newEntry)]);
        return newEntry;
      } catch (error) {
        console.error('TimeEntryStore add:error', error);
        throw error;
      }
    },

    async update(id: string, entry: Partial<NewTimeEntry>) {
      console.log('TimeEntryStore update:start', { id, changes: entry });
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
          console.error('TimeEntryStore update:error', errorMessage);
          throw new Error(errorMessage);
        }

        let updatedFields: Partial<NewTimeEntry> = { ...entry };

        // Validate date fields
        if (updatedFields.startTime) {
          updatedFields.startTime = updatedFields.startTime && (typeof updatedFields.startTime === 'string' || updatedFields.startTime instanceof Date)
            ? new Date(updatedFields.startTime)
            : new Date();
          if (isNaN(updatedFields.startTime.getTime())) {
            console.warn('Invalid startTime in update:', updatedFields.startTime);
            updatedFields.startTime = new Date();
          }
        }
        if (updatedFields.endTime) {
          updatedFields.endTime = updatedFields.endTime && (typeof updatedFields.endTime === 'string' || updatedFields.endTime instanceof Date)
            ? new Date(updatedFields.endTime)
            : null;
          if (updatedFields.endTime && isNaN(updatedFields.endTime.getTime())) {
            console.warn('Invalid endTime in update:', updatedFields.endTime);
            updatedFields.endTime = null;
          }
        }
        if (updatedFields.date) {
          updatedFields.date = updatedFields.date && (typeof updatedFields.date === 'string' || updatedFields.date instanceof Date)
            ? new Date(updatedFields.date)
            : new Date();
          if (isNaN(updatedFields.date.getTime())) {
            console.warn('Invalid date in update:', updatedFields.date);
            updatedFields.date = updatedFields.startTime || new Date();
          }
        }

        // If we have both start and end time, calculate minutes
        if (updatedFields.startTime && updatedFields.endTime) {
          updatedFields.minutes = calculateDurationInMinutes(updatedFields.startTime, updatedFields.endTime);
          console.log('TimeEntryStore update:calculatedminutes', { 
            minutes: updatedFields.minutes,
            startTime: updatedFields.startTime,
            endTime: updatedFields.endTime
          });
        }
        // If we have start time and minutes, calculate end time
        else if (updatedFields.startTime && updatedFields.minutes) {
          updatedFields.endTime = calculateEndTime(updatedFields.startTime, updatedFields.minutes);
          console.log('TimeEntryStore update:calculatedEndTime', {
            endTime: updatedFields.endTime,
            startTime: updatedFields.startTime,
            minutes: updatedFields.minutes
          });
        }

        const updatedEntry = await api.updateTimeEntry(id, updatedFields);
        console.log('TimeEntryStore update:success', { id });

        update(entries => entries.map(e =>
          e.id === id ? formatTimeEntry(updatedEntry) : e
        ));

        return updatedEntry;
      } catch (error) {
        console.error('TimeEntryStore update:error', error);
        throw error;
      }
    },

    async remove(id: string) {
      console.log('TimeEntryStore remove:start', { id });
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
          console.error('TimeEntryStore remove:error', errorMessage);
          throw new Error(errorMessage);
        }
        
        await api.deleteTimeEntry(id);
        console.log('TimeEntryStore remove:success', { id });
        update(entries => entries.filter(e => e.id !== id));
      } catch (error) {
        console.error('TimeEntryStore remove:error', error);
        throw error;
      }
    },

    async markAsBilled(entryIds: string[]) {
      console.log('TimeEntryStore markAsBilled:start', { count: entryIds.length });
      try {
        await Promise.all(entryIds.map(id =>
          api.updateTimeEntry(id, { 
            billed: true, 
            locked: true // Also lock entries when they're marked as billed
          })
        ));

        console.log('TimeEntryStore markAsBilled:success', { entryIds });
        update(entries => entries.map(entry =>
          entryIds.includes(entry.id)
            ? { ...entry, billed: true, locked: true }
            : entry
        ));
      } catch (error) {
        console.error('TimeEntryStore markAsBilled:error', error);
        throw error;
      }
    },

    getByClientId(clientId: string) {
      console.log('TimeEntryStore getByClientId:start', { clientId });
      let entries: TimeEntry[] = [];
      store.subscribe(value => {
        entries = value;
      })();

      const filtered = entries.filter(entry => 
        entry.clientId === clientId && entry.billable && !entry.billed
      );
      console.log('TimeEntryStore getByClientId:complete', { 
        clientId, 
        entriesFound: filtered.length 
      });
      return filtered;
    },

    getUnbilledByClientId(clientId: string, includeSubClients = true) {
      console.log('TimeEntryStore getUnbilledByClientId:start', { 
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

      console.log('TimeEntryStore getUnbilledByClientId:complete', { 
        clientId,
        totalEntries: filtered.length,
        clientCount: clientIds.length
      });

      return filtered;
    },

    reset() {
      console.log('TimeEntryStore reset');
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