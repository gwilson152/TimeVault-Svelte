import type { Invoice, TimeEntry } from '$lib/types';
import * as api from '$lib/services/api';
import { timeEntryStore } from '$lib/stores/timeEntryStore';

/**
 * Generate an invoice for a client
 */
export async function generateInvoice(clientId: string): Promise<Invoice | null> {
  // Get unbilled entries for this client
  const unbilledEntries = timeEntryStore.getUnbilledByClientId(clientId);
  
  if (unbilledEntries.length === 0) {
    console.info('No unbilled entries found for this client');
    return null;
  }
  
  try {
    const invoice = await api.generateInvoice(clientId, unbilledEntries);
    return invoice;
  } catch (error) {
    console.error('Failed to generate invoice:', error);
    return null;
  }
}

/**
 * Process an invoice by marking all entries as billed
 */
export async function processInvoice(invoice: Invoice): Promise<void> {
  if (!invoice || !invoice.entries.length) {
    return;
  }
  
  // Mark entries as billed
  const entryIds = invoice.entries.map(entry => entry.id);
  await timeEntryStore.markAsBilled(entryIds);
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