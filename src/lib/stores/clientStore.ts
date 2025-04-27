import { writable } from 'svelte/store';
import type { Client, NewClient, ClientBillingRateOverride, NewBillingRateOverride } from '$lib/types';
import * as api from '$lib/services/api';

type NewClientData = Omit<Client, 'id' | 'children' | 'billingRateOverrides' | 'createdAt' | 'updatedAt'> & { 
  billingRateOverrides?: NewBillingRateOverride[];
};

type UpdateClientData = Partial<Omit<Client, 'id' | 'children' | 'billingRateOverrides' | 'createdAt' | 'updatedAt'>> & { 
  billingRateOverrides?: NewBillingRateOverride[];
};

function createClientStore() {
  const { subscribe, set, update } = writable<Client[]>([]);
  let initialized = false;
  let loadPromise: Promise<void> | null = null;

  function logDebug(action: string, data?: any) {
    console.debug(`🏢 ClientStore [${action}]`, data || '');
  }

  return {
    subscribe,
    
    async load(force = false) {
      logDebug('load', { force, initialized, hasLoadPromise: !!loadPromise });
      
      if (initialized && !force) return;
      
      if (loadPromise) {
        logDebug('load:waiting for existing load');
        await loadPromise;
        return;
      }
      
      try {
        loadPromise = (async () => {
          const clients = await api.getClients();
          logDebug('load:success', { clientCount: clients?.length });
          set(clients || []);
          initialized = true;
        })();
        
        await loadPromise;
      } catch (error) {
        logDebug('load:error', error);
        console.error('Failed to load clients:', error);
        set([]);
        throw error;
      } finally {
        loadPromise = null;
      }
    },
    
    async add(client: NewClientData) {
      logDebug('add:start', { clientName: client.name, type: client.type });
      try {
        const newClient = await api.createClient(client);
        logDebug('add:success', { id: newClient.id, name: newClient.name });
        update(clients => [...clients, newClient]);
        return newClient;
      } catch (error) {
        logDebug('add:error', error);
        console.error('Failed to add client:', error);
        throw error;
      }
    },
    
    async update(id: string, client: UpdateClientData) {
      logDebug('update:start', { id, changes: client });
      try {
        const updatedClient = await api.updateClient(id, client);
        logDebug('update:success', { id, name: updatedClient.name });
        update(clients => clients.map(c => c.id === id ? updatedClient : c));
        return updatedClient;
      } catch (error) {
        logDebug('update:error', error);
        console.error('Failed to update client:', error);
        throw error;
      }
    },
    
    async remove(id: string) {
      logDebug('remove:start', { id });
      try {
        await api.deleteClient(id);
        logDebug('remove:success', { id });
        update(clients => clients.filter(c => c.id !== id));
      } catch (error) {
        logDebug('remove:error', error);
        console.error('Failed to delete client:', error);
        throw error;
      }
    },

    getBillingRate(clientId: string, baseClientId: string): number {
      let rate = 0;
      update(clients => {
        const client = clients.find(c => c.id === clientId);
        if (!client) {
          logDebug('getBillingRate:clientNotFound', { clientId });
          return clients;
        }

        const override = client.billingRateOverrides?.find(o => o.baseRateId === baseClientId);
        if (override) {
          rate = override.value;
          logDebug('getBillingRate:found', { clientId, baseClientId, rate });
        } else {
          logDebug('getBillingRate:noOverride', { clientId, baseClientId });
        }
        return clients;
      });
      return rate;
    },
    
    reset() {
      logDebug('reset');
      set([]);
      initialized = false;
      loadPromise = null;
    }
  };
}

export const clientStore = createClientStore();