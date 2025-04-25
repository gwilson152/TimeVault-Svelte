import type { Invoice, TimeEntry, InvoiceAddon, BillingRate, ClientBillingRateOverride } from '$lib/types';
import * as api from '$lib/services/api';
import { timeEntryStore } from '$lib/stores/timeEntryStore';
import { hoursToFormatted, hoursToMinutes } from './timeUtils';

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
export function formatTime(hours: number, format: 'minutes' | 'hours' | 'formatted' = 'minutes'): string {
  switch (format) {
    case 'minutes':
      return `${hoursToMinutes(hours)} min`;
    case 'formatted':
      return hoursToFormatted(hours);
    default:
      return `${hours.toFixed(2)} hrs`;
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
 * Calculate time entry amount
 */
export function calculateTimeEntryAmount(entry: TimeEntry, billingRate?: BillingRate, overrides?: ClientBillingRateOverride[]): {
  amount: number;
  cost: number;
  profit: number;
} {
  if (!billingRate) {
    return { amount: 0, cost: 0, profit: 0 };
  }

  const rate = calculateEffectiveRate(billingRate, overrides);
  const amount = entry.hours * rate;
  const cost = entry.hours * billingRate.cost;
  
  return {
    amount,
    cost,
    profit: amount - cost
  };
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
 * Calculate totals for time entries and addons
 */
export function calculateTotals(timeEntries: TimeEntry[], addons: InvoiceAddon[] = []): {
  hours: number;
  amount: number;
  cost: number;
  profit: number;
} {
  const timeTotals = timeEntries.reduce((acc, entry) => {
    const { amount, cost, profit } = calculateTimeEntryAmount(
      entry,
      entry.billingRate,
      entry.client?.billingRateOverrides
    );
    
    return {
      hours: acc.hours + entry.hours,
      amount: acc.amount + amount,
      cost: acc.cost + cost,
      profit: acc.profit + profit
    };
  }, { hours: 0, amount: 0, cost: 0, profit: 0 });

  const addonTotals = addons.reduce((acc, addon) => {
    const { amount, cost, profit } = calculateAddonAmount(addon);
    return {
      amount: acc.amount + amount,
      cost: acc.cost + cost,
      profit: acc.profit + profit
    };
  }, { amount: 0, cost: 0, profit: 0 });

  return {
    hours: timeTotals.hours,
    amount: timeTotals.amount + addonTotals.amount,
    cost: timeTotals.cost + addonTotals.cost,
    profit: timeTotals.profit + addonTotals.profit
  };
}