import { writable, derived } from 'svelte/store';
import type { TimeEntry, NewTimeEntry } from '$lib/types';
import * as api from '$lib/services/api';
import { clientStore } from './clientStore';
import { settingsStore } from './settingsStore';
import { formattedToHours, minutesToHours, hoursToMinutes, hoursToFormatted } from '$lib/utils/timeUtils';

function createTimeEntryStore() {
  const { subscribe, set, update } = writable<TimeEntry[]>([]);
  let initialized = false;

  function formatTimeEntry(entry: TimeEntry): TimeEntry {
    return {
      ...entry,
      minutes: hoursToMinutes(entry.hours),
      timeFormatted: hoursToFormatted(entry.hours)
    };
  }

  return {
    subscribe,
    
    async load() {
      if (initialized) return;
      
      try {
        const entries = await api.getTimeEntries();
        set(entries.map(formatTimeEntry));
        initialized = true;
      } catch (error) {
        console.error('Failed to load time entries:', error);
        set([]); // Set empty array on error
        throw error;
      }
    },
    
    async add(entry: NewTimeEntry) {
      try {
        // Convert time to hours based on provided format
        let hours = entry.hours;
        if (entry.minutes !== undefined) {
          hours = minutesToHours(entry.minutes);
        } else if (entry.timeFormatted) {
          const converted = formattedToHours(entry.timeFormatted);
          if (converted === null) {
            throw new Error('Invalid time format');
          }
          hours = converted;
        }

        const newEntry = await api.createTimeEntry({
          ...entry,
          hours
        });
        
        update(entries => [...entries, formatTimeEntry(newEntry)]);
        return newEntry;
      } catch (error) {
        console.error('Failed to add time entry:', error);
        throw error;
      }
    },
    
    async update(id: string, entry: Partial<NewTimeEntry>) {
      try {
        // Convert time if provided
        let hours = entry.hours;
        if (entry.minutes !== undefined) {
          hours = minutesToHours(entry.minutes);
        } else if (entry.timeFormatted) {
          const converted = formattedToHours(entry.timeFormatted);
          if (converted === null) {
            throw new Error('Invalid time format');
          }
          hours = converted;
        }

        const updatedEntry = await api.updateTimeEntry(id, {
          ...entry,
          hours
        });
        
        update(entries => entries.map(e => 
          e.id === id ? formatTimeEntry(updatedEntry) : e
        ));
        
        return updatedEntry;
      } catch (error) {
        console.error('Failed to update time entry:', error);
        throw error;
      }
    },
    
    async remove(id: string) {
      try {
        await api.deleteTimeEntry(id);
        update(entries => entries.filter(e => e.id !== id));
      } catch (error) {
        console.error('Failed to delete time entry:', error);
        throw error;
      }
    },

    getUnbilledByClientId(clientId: string, includeSubClients: boolean = true) {
      const result: TimeEntry[] = [];
      const seen = new Set<string>();

      function addEntry(entry: TimeEntry) {
        if (!seen.has(entry.id)) {
          result.push(entry);
          seen.add(entry.id);
        }
      }

      function processClient(cid: string) {
        this.subscribe(entries => {
          entries
            .filter(e => e.clientId === cid && e.billable && !e.billed)
            .forEach(addEntry);
        });
      }

      // Add entries for the main client
      processClient(clientId);

      if (includeSubClients) {
        // Get all child clients recursively
        function getChildClients(parentId: string): string[] {
          const children: string[] = [];
          this.subscribe(entries => {
            entries.forEach(entry => {
              if (entry.client?.parentId === parentId) {
                children.push(entry.client.id);
                children.push(...getChildClients(entry.client.id));
              }
            });
          });
          return children;
        }

        // Process all child clients
        const childClientIds = getChildClients(clientId);
        childClientIds.forEach(processClient);
      }

      return result;
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