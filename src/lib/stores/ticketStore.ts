import { derived, type Writable } from 'svelte/store';
import type { Ticket, NewTicket } from '$lib/types';
import * as api from '$lib/services/api';
import { baseClientStore, baseTicketStore } from './storeInitializer';

interface TicketStore {
  subscribe: Writable<Ticket[]>['subscribe'];
  load: (force?: boolean) => Promise<void>;
  add: (ticket: NewTicket) => Promise<Ticket>;
  update: (id: string, ticket: Partial<Ticket>) => Promise<Ticket>;
  remove: (id: string) => Promise<void>;
  getAll: () => Ticket[];
  getByClientId: (clientId: string, includeSubClients?: boolean) => Ticket[];
}

function createTicketStore(): TicketStore {
  const { subscribe, set, update } = baseTicketStore;
  let initialized = false;
  let loadPromise: Promise<void> | null = null;

  function logDebug(action: string, data?: any) {
    console.debug(`🎫 TicketStore [${action}]`, data || '');
  }

  function formatTicket(ticket: Ticket): Ticket {
    // Ensure we have properly formatted dates
    return {
      ...ticket,
      createdAt: ticket.createdAt ? new Date(ticket.createdAt) : new Date(),
      updatedAt: ticket.updatedAt ? new Date(ticket.updatedAt) : new Date()
    };
  }

  const store: TicketStore = {
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
          const tickets = await api.getTickets();
          logDebug('load:success', { ticketCount: tickets?.length });
          set(tickets?.map(formatTicket) || []);
          initialized = true;
        })();
        
        await loadPromise;
      } catch (error) {
        logDebug('load:error', error);
        console.error('Failed to load tickets:', error);
        set([]);
        initialized = false;
        throw error;
      } finally {
        loadPromise = null;
      }
    },

    async add(ticket: NewTicket) {
      logDebug('add:start', { title: ticket.title });
      try {
        const newTicket = await api.createTicket(ticket);
        logDebug('add:success', { id: newTicket.id, title: newTicket.title });
        update(tickets => [...tickets, formatTicket(newTicket)]);
        return newTicket;
      } catch (error) {
        logDebug('add:error', error);
        console.error('Failed to add ticket:', error);
        throw error;
      }
    },

    async update(id: string, ticket: Partial<Ticket>) {
      logDebug('update:start', { id, changes: ticket });
      try {
        const updatedTicket = await api.updateTicket(id, ticket);
        logDebug('update:success', { id, title: updatedTicket.title });
        update(tickets => tickets.map(t => t.id === id ? formatTicket(updatedTicket) : t));
        return updatedTicket;
      } catch (error) {
        logDebug('update:error', error);
        console.error('Failed to update ticket:', error);
        throw error;
      }
    },

    async remove(id: string) {
      logDebug('remove:start', { id });
      try {
        await api.deleteTicket(id);
        logDebug('remove:success', { id });
        update(tickets => tickets.filter(t => t.id !== id));
      } catch (error) {
        logDebug('remove:error', error);
        console.error('Failed to delete ticket:', error);
        throw error;
      }
    },

    getAll() {
      let tickets: Ticket[] = [];
      store.subscribe(value => {
        tickets = value;
      })();
      return tickets;
    },

    getByClientId(clientId: string, includeSubClients = false) {
      logDebug('getByClientId:start', { clientId, includeSubClients });
      let tickets: Ticket[] = [];
      let clients: any[] = [];
      
      store.subscribe(value => { tickets = value; })();
      
      if (!includeSubClients) {
        return tickets.filter(ticket => ticket.clientId === clientId);
      }
      
      // For sub-clients, we need to get the client hierarchy
      baseClientStore.subscribe(value => { clients = value; })();
      
      // Get all sub-client IDs (direct children only for now)
      const subClientIds = clients
        .filter(client => client.parentId === clientId)
        .map(client => client.id);
      
      // Include the main client
      const allClientIds = [clientId, ...subClientIds];
      
      return tickets.filter(ticket => allClientIds.includes(ticket.clientId));
    }
  };

  return store;
}

export const ticketStore = createTicketStore();

// Create a derived store that includes client info
export const ticketsWithClientInfo = derived(
  [baseTicketStore, baseClientStore],
  ([$tickets, $clients]) => {
    return $tickets.map(ticket => {
      const client = ticket.clientId ? $clients.find(c => c.id === ticket.clientId) : null;
      return {
        ...ticket,
        client
      };
    });
  }
);