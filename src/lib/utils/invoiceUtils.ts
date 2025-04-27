import type { Invoice, TimeEntry, InvoiceAddon, BillingRate, ClientBillingRateOverride, Client } from '$lib/types';
import * as api from '$lib/services/api';
import { timeEntryStore } from '$lib/stores/timeEntryStore';
import { hoursToFormatted, hoursToMinutes, minutesToFormatted, minutesToHours } from './timeUtils';

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
 * Format time
 */
export function formatTime(minutes: number, format: 'minutes' | 'hours' | 'formatted' = 'minutes'): string {
  switch (format) {
    case 'minutes':
      return `${minutes} min`;
    case 'formatted':
      return minutesToFormatted(minutes);
    default:
      return `${minutesToHours(minutes).toFixed(2)} hrs`;
  }
}

/**
 * Calculate effective billing rate
 */
export function calculateEffectiveRate(billingRate: BillingRate, overrides?: ClientBillingRateOverride[]): number {
  if (!overrides?.length) return billingRate.rate;
  
  const override = overrides.find(o => o.baseRateId === billingRate.id);
  if (!override) return billingRate.rate;
  
  return override.overrideType === 'percentage'
    ? billingRate.rate * (override.value / 100)
    : override.value;
}

/**
 * Calculate the effective amount, cost, and profit for a time entry
 */
export function calculateTimeEntryAmount(entry: TimeEntry & { client?: Client, billingRate?: BillingRate }): { amount: number; cost: number; profit: number } {
  if (!entry.billable || !entry.client || !entry.billingRate) {
    return { amount: 0, cost: 0, profit: 0 };
  }

  // Get client billing rate override if it exists
  let effectiveRate = entry.billingRate.rate;
  
  // Add null check for billingRateOverrides
  if (entry.client.billingRateOverrides && entry.client.billingRateOverrides.length > 0) {
    const override = entry.client.billingRateOverrides.find(o => o.baseRateId === entry.billingRate!.id);
    if (override) {
      effectiveRate = override.overrideType === 'fixed' 
        ? override.value 
        : entry.billingRate.rate * (override.value / 100);
    }
  }

  const hours = entry.minutes / 60; // Convert minutes to hours for rate calculation
  const amount = effectiveRate * hours;
  const cost = entry.billingRate.cost * hours;
  const profit = amount - cost;

  return { amount, cost, profit };
}

/**
 * Calculate addon amount
 */
export function calculateAddonAmount(addon: InvoiceAddon): {
  amount: number;
  cost: number;
  profit: number;
} {
  const total = addon.amount * addon.quantity;
  const totalCost = addon.cost * addon.quantity;
  
  return {
    amount: total,
    cost: totalCost,
    profit: total - totalCost
  };
}

/**
 * Generate invoice number
 */
export function generateInvoiceNumber(prefix: string, nextNumber: number): string {
  return `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
}

/**
 * Calculate total minutes, amount, cost, and profit for a set of time entries and addons
 */
export function calculateTotals(
  entries: Array<TimeEntry & { client?: Client, billingRate?: BillingRate }>,
  addons: InvoiceAddon[]
): { minutes: number; amount: number; cost: number; profit: number } {
  const entryTotals = entries.reduce(
    (acc, entry) => {
      const { amount, cost, profit } = calculateTimeEntryAmount(entry);
      return {
        minutes: acc.minutes + entry.minutes,
        amount: acc.amount + amount,
        cost: acc.cost + cost,
        profit: acc.profit + profit
      };
    },
    { minutes: 0, amount: 0, cost: 0, profit: 0 }
  );

  const addonTotals = addons.reduce(
    (acc, addon) => {
      const { amount, cost, profit } = calculateAddonAmount(addon);
      return {
        minutes: acc.minutes,
        amount: acc.amount + amount,
        cost: acc.cost + cost,
        profit: acc.profit + profit
      };
    },
    { minutes: 0, amount: 0, cost: 0, profit: 0 }
  );

  return {
    minutes: entryTotals.minutes,
    amount: entryTotals.amount + addonTotals.amount,
    cost: entryTotals.cost + addonTotals.cost,
    profit: entryTotals.profit + addonTotals.profit
  };
}

export { minutesToFormatted };
