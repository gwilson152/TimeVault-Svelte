import type { Invoice } from '$lib/types';
import { timeEntryStore } from '$lib/stores/timeEntryStore';
import { clientStore } from '$lib/stores/clientStore';
import { get } from 'svelte/store';

/**
 * Generate an invoice for a client
 */
export function generateInvoice(clientId: string): Invoice | null {
  const clients = get(clientStore);
  const client = clients.find(c => c.id === clientId);
  
  if (!client) {
    console.error(`Client with ID ${clientId} not found`);
    return null;
  }
  
  // Get unbilled entries for this client
  const unbilledEntries = timeEntryStore.getUnbilledByClientId(clientId);
  
  if (unbilledEntries.length === 0) {
    console.info(`No unbilled entries found for client ${client.name}`);
    return null;
  }
  
  // Calculate totals
  const totalHours = unbilledEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const totalAmount = totalHours * client.rate;
  
  // Create invoice object
  const invoice: Invoice = {
    clientId,
    entries: unbilledEntries,
    totalHours,
    totalAmount,
    date: new Date()
  };
  
  return invoice;
}

/**
 * Process an invoice by marking all entries as billed
 */
export function processInvoice(invoice: Invoice): void {
  if (!invoice || !invoice.entries.length) {
    return;
  }
  
  // Mark all entries as billed
  const entryIds = invoice.entries.map(entry => entry.id);
  timeEntryStore.markAsBilled(entryIds);
}

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

/**
 * Format hours
 */
export function formatHours(hours: number): string {
  return hours.toFixed(2);
}