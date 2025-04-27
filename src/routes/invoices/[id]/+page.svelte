<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { GlassCard, TimeEntryList } from '$lib/components';
  import { formatCurrency, formatDate, formatTime } from '$lib/utils/invoiceUtils';
  import { clientStore } from '$lib/stores/clientStore';
  import * as api from '$lib/services/api';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { DocumentText, ArrowLeft, Printer } from '@steeze-ui/heroicons';
  import type { Invoice, TimeEntry } from '$lib/types';

  let invoice: Invoice | null = null;
  let isLoading = true;
  let error: string | null = null;
  
  const invoiceId = $page.params.id;

  onMount(async () => {
    try {
      await clientStore.load();
      const invoices = await api.getInvoices();
      invoice = invoices.find(inv => inv.id === invoiceId) || null;
      
      if (!invoice) {
        error = 'Invoice not found';
      }
    } catch (err) {
      console.error('Failed to load invoice:', err);
      error = err instanceof Error ? err.message : 'Failed to load invoice';
    } finally {
      isLoading = false;
    }
  });

  function printInvoice() {
    window.print();
  }
</script>

<svelte:head>
  <title>Invoice {invoice?.invoiceNumber || invoiceId}</title>
  <style media="print">
    body * {
      visibility: hidden;
    }
    .print-section, .print-section * {
      visibility: visible;
    }
    .print-section {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
    }
    .no-print {
      display: none !important;
    }
    .page-break {
      page-break-after: always;
    }
  </style>
</svelte:head>

<div class="space-y-6">
  <!-- Page Header (no-print) -->
  <GlassCard className="p-6 no-print">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div class="flex items-center space-x-3">
        <Icon src={DocumentText} class="w-8 h-8 text-blue-500" />
        <h1 class="text-2xl font-bold">Invoice Details</h1>
      </div>
      <div class="flex gap-3">
        <a href="/invoices" class="btn btn-secondary">
          <Icon src={ArrowLeft} class="w-4 h-4 mr-2" />
          Back to Invoices
        </a>
        <button on:click={printInvoice} class="btn btn-primary">
          <Icon src={Printer} class="w-4 h-4 mr-2" />
          Print Invoice
        </button>
      </div>
    </div>
  </GlassCard>

  <!-- Loading State -->
  {#if isLoading}
    <GlassCard className="p-6 no-print">
      <div class="text-center py-12">
        <div class="text-gray-400 animate-pulse">Loading invoice details...</div>
      </div>
    </GlassCard>
  {:else if error}
    <GlassCard className="p-6 no-print">
      <div class="text-center py-12 text-red-400">
        {error}
      </div>
    </GlassCard>
  {:else if invoice}
    <!-- Printable Invoice Section -->
    <div class="print-section">
      <GlassCard className="p-6">
        <div class="flex flex-col gap-6">
          <!-- Invoice Header -->
          <div class="flex flex-col md:flex-row justify-between">
            <div>
              <h2 class="text-xl font-bold">Invoice</h2>
              <div class="text-2xl font-bold text-blue-400 mt-1">
                #{invoice.invoiceNumber || 'Draft'}
              </div>
              <div class="text-sm text-gray-400 mt-2">
                Date: {formatDate(invoice.date)}
              </div>
            </div>
            <div class="mt-4 md:mt-0 md:text-right">
              <div class="text-lg font-semibold">
                {invoice.client?.name || 'Unknown Client'}
              </div>
              <div class="text-sm text-gray-400 mt-1">
                Client ID: {invoice.clientId}
              </div>
            </div>
          </div>

          <!-- Summary -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div class="p-4 bg-white/5 rounded-lg">
              <div class="text-sm text-gray-400">Total Hours</div>
              <div class="font-medium text-lg">{formatTime(invoice.totalMinutes / 60, 'formatted')}</div>
            </div>
            <div class="p-4 bg-white/5 rounded-lg">
              <div class="text-sm text-gray-400">Total Amount</div>
              <div class="font-medium text-lg">{formatCurrency(invoice.totalAmount)}</div>
            </div>
            <div class="p-4 bg-white/5 rounded-lg">
              <div class="text-sm text-gray-400">Total Cost</div>
              <div class="font-medium text-lg">{formatCurrency(invoice.totalCost)}</div>
            </div>
            <div class="p-4 bg-white/5 rounded-lg">
              <div class="text-sm text-gray-400">Total Profit</div>
              <div class="font-medium text-lg">{formatCurrency(invoice.totalProfit)}</div>
            </div>
          </div>

          <!-- Time Entries Section -->
          <div class="mt-6">
            <h3 class="text-lg font-semibold mb-4">Time Entries</h3>
            <div class="overflow-hidden">
              <table class="data-table">
                <thead class="data-table-header">
                  <tr>
                    <th>Description</th>
                    <th>Date</th>
                    <th class="right-aligned">Duration</th>
                    <th class="right-aligned">Rate</th>
                    <th class="right-aligned">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {#each invoice.entries as entry}
                    <tr class="data-table-row">
                      <td>
                        <div class="font-medium">{entry.description}</div>
                      </td>
                      <td>{formatDate(entry.date)}</td>
                      <td class="right-aligned">
                        {formatTime(entry.minutes / 60, 'formatted')}
                      </td>
                      <td class="right-aligned">
                        {formatCurrency(entry.billingRate?.rate || 0)}/hr
                      </td>
                      <td class="right-aligned">
                        {formatCurrency((entry.billingRate?.rate || 0) * (entry.minutes / 60))}
                      </td>
                    </tr>
                  {/each}
                </tbody>
                <tfoot class="data-table-footer">
                  <tr>
                    <td colspan="2">Total Time Entries</td>
                    <td class="right-aligned">{formatTime(invoice.totalMinutes / 60, 'formatted')}</td>
                    <td></td>
                    <td class="right-aligned">{formatCurrency(invoice.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          
          <!-- Addons Section -->
          {#if invoice.addons && invoice.addons.length > 0}
            <div class="mt-6 page-break">
              <h3 class="text-lg font-semibold mb-4">Additional Items</h3>
              <div class="overflow-hidden">
                <table class="data-table">
                  <thead class="data-table-header">
                    <tr>
                      <th>Description</th>
                      <th class="right-aligned">Price</th>
                      <th class="right-aligned">Quantity</th>
                      <th class="right-aligned">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each invoice.addons as addon}
                      <tr class="data-table-row">
                        <td>
                          <div class="font-medium">{addon.description}</div>
                        </td>
                        <td class="right-aligned">
                          {formatCurrency(addon.amount)}
                        </td>
                        <td class="right-aligned">
                          {addon.quantity}
                        </td>
                        <td class="right-aligned">
                          {formatCurrency(addon.amount * addon.quantity)}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                  <tfoot class="data-table-footer">
                    <tr>
                      <td colspan="3">Total Additional Items</td>
                      <td class="right-aligned">
                        {formatCurrency(invoice.addons.reduce((sum, addon) => sum + addon.amount * addon.quantity, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          {/if}
          
          <!-- Invoice Total -->
          <div class="mt-6">
            <div class="p-6 bg-blue-900/20 rounded-lg">
              <div class="flex justify-between items-center">
                <div class="text-xl font-bold">Invoice Total</div>
                <div class="text-2xl font-bold">{formatCurrency(invoice.totalAmount)}</div>
              </div>
            </div>
          </div>
          
          <!-- Notes/Terms -->
          <div class="mt-6 text-sm text-gray-400">
            <p>Payment is due within 30 days of receipt. Thank you for your business.</p>
          </div>
        </div>
      </GlassCard>
    </div>
  {/if}
</div>