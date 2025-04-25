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

  return {
    subscribe,
    
    async load() {
      if (initialized) return;
      
      try {
        const clients = await api.getClients();
        set(clients || []); // Ensure we always set an array
        initialized = true;
      } catch (error) {
        console.error('Failed to load clients:', error);
        set([]); // Set empty array on error
        throw error;
      }
    },
    
    async add(client: NewClientData) {
      try {
        const newClient = await api.createClient(client);
        update(clients => [...clients, newClient]);
        return newClient;
      } catch (error) {
        console.error('Failed to add client:', error);
        throw error;
      }
    },
    
    async update(id: string, client: UpdateClientData) {
      try {
        const updatedClient = await api.updateClient(id, client);
        update(clients => clients.map(c => c.id === id ? updatedClient : c));
        return updatedClient;
      } catch (error) {
        console.error('Failed to update client:', error);
        throw error;
      }
    },
    
    async remove(id: string) {
      try {
        await api.deleteClient(id);
        update(clients => clients.filter(c => c.id !== id));
      } catch (error) {
        console.error('Failed to delete client:', error);
        throw error;
      }
    },

    getBillingRate(clientId: string, baseClientId: string): number {
      let rate = 0;
      update(clients => {
        const client = clients.find(c => c.id === clientId);
        if (!client) return clients;

        // Check for rate override
        const override = client.billingRateOverrides?.find(o => o.baseRateId === baseClientId);
        if (override) {
          rate = override.value;
        }
        return clients;
      });
      return rate;
    },
    
    reset() {
      set([]);
      initialized = false;
    }
  };
}

export const clientStore = createClientStore();