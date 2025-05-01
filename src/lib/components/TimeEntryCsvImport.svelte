<script lang="ts">
  import { onMount } from 'svelte';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { ticketStore } from '$lib/stores/ticketStore';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  import { minutesToFormatted, formattedToMinutes } from '$lib/utils/timeUtils';
  import type { NewTimeEntry, NewTicket, Ticket } from '$lib/types';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { DataTable } from '$lib/components';
  import { 
    CloudArrowUp,
    DocumentCheck,
    ExclamationTriangle,
    Check,
    XMark
  } from '@steeze-ui/heroicons';

  const { onClose, onComplete } = $props<{
    onClose?: () => void;
    onComplete?: () => void;
  }>();

  // State management
  let fileInput = $state<HTMLInputElement | null>(null);
  let isProcessing = $state(false);
  let errorMessage = $state<string | null>(null);
  let successCount = $state(0);
  let parsedEntries = $state<Array<NewTimeEntry & { valid: boolean; errors: string[]; actionId: string }>>([]);
  let currentPage = $state(1);
  let pageSize = $state(10);

  // Define DataTable columns
  const previewColumns = [
    {
      key: 'description',
      title: 'Description',
      sortable: true,
      render: (value: string, row: any) => {
        const statusIcon = row.valid ? 
          `<span class="text-green-400 mr-2">✓</span>` : 
          `<span class="text-amber-400 mr-2">⚠</span>`;

        const clientStatus = row.clientMatched ? 
          `<span class="text-xs text-gray-400">Client: <span class="text-blue-400">${row.clientName || 'Unknown'}</span> (Matched)</span>` :
          row.clientName || row.clientEmail ? 
          `<span class="text-xs text-gray-400">Client: <span class="text-amber-400">${row.clientName || row.clientEmail}</span> (Will create)</span>` :
          `<span class="text-xs text-gray-400">Client: <span class="text-gray-400">None</span></span>`;

        const ticketStatus = row.ticketMatched ? 
          `<span class="text-xs text-gray-400">Ticket: <span class="text-blue-400">#${row.ticketNumber}</span> (Matched)</span>` :
          row.ticketNumber ? 
          `<span class="text-xs text-gray-400">Ticket: <span class="text-amber-400">#${row.ticketNumber}</span> (Will create)</span>` :
          '';

        return `<div class="space-y-1">
          <div class="flex items-center">
            ${statusIcon}${value || 'No description'}
          </div>
          <div class="flex flex-col gap-0.5 pl-6">
            ${clientStatus}
            ${ticketStatus}
          </div>
        </div>`;
      }
    },
    {
      key: 'date',
      title: 'Date',
      sortable: true,
      formatter: (value: Date | null) => value ? value.toLocaleDateString() : '-'
    },
    {
      key: 'minutes',
      title: 'Duration',
      sortable: true,
      align: 'right' as const,
      formatter: (value: number | null) => value ? minutesToFormatted(value) : '-'
    },
    {
      key: 'billable',
      title: 'Status',
      sortable: true,
      render: (value: boolean, row: any) => {
        const badge = value ? 
          `<button class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" data-action="toggle-billable" data-action-id="${row.actionId}">
            Billable
          </button>` :
          `<button class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-500/10 text-gray-400 hover:bg-gray-500/20" data-action="toggle-billable" data-action-id="${row.actionId}">
            Non-Billable
          </button>`;

        const rateInfo = row.billingRateId ? 
          `<div class="text-xs text-gray-400 mt-1">Rate: ${row.billingRateName}</div>` : 
          '';

        return `<div>${badge}${rateInfo}</div>`;
      }
    },
    {
      key: 'errors',
      title: 'Validation',
      render: (errors: string[], row: any) => {
        if (!row.valid && Array.isArray(errors) && errors.length > 0) {
          return `<div class="text-amber-400 text-sm">${errors.join(', ')}</div>`;
        }
        return '';
      }
    }
  ];

  let csvMappings = $state<Record<string, string>>({
    description: '',
    date: '',
    minutes: '',
    clientName: '',
    clientEmail: '',
    billingRateName: '',
    billable: '',
    ticketNumber: '',
    ticketTitle: ''
  });

  let csvHeaders = $state<string[]>([]);
  let rawData = $state<string[][]>([]);

  // Reference data columns to ignore during processing
  const REFERENCE_COLUMNS = ['__REF_AVAILABLE_BILLING_RATES', '__REF_AVAILABLE_CLIENTS'];

  // Add types for billing rates and settings
  interface BillingRate {
    id: string;
    name: string;
    rate: number;
    isDefault?: boolean;
  }

  interface TicketData extends Ticket {
    ticketNumber: string;
  }

  interface Settings {
    billingRates: Array<{
      id: string;
      name: string;
      rate: number;
      isDefault?: boolean;
    }>;
  }

  // Load required data
  onMount(() => {
    clientStore.load();
    settingsStore.load();
  });

  function handleFileSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        parseCsv(csv);
      } catch (error) {
        errorMessage = 'Failed to read CSV file';
        console.error('CSV parse error:', error);
      }
    };
    reader.readAsText(file);
  }

  function handleFileClick() {
    if (fileInput) {
      fileInput.click();
    }
  }

  function parseCsv(csv: string) {
    // Simple CSV parsing (can be enhanced for more complex CSVs)
    const lines = csv.split('\n');
    if (lines.length < 2) {
      errorMessage = 'CSV file must contain headers and at least one data row';
      return;
    }

    // Get headers and remove quotes/whitespace, filter out reference columns
    csvHeaders = lines[0]
      .split(',')
      .map(header => header.trim().replace(/["']/g, ''))
      .filter(header => !REFERENCE_COLUMNS.includes(header));

    // Parse data rows
    rawData = lines
      .slice(1)
      .filter(line => line.trim())
      .map(line => {
        const columns = line.split(',').map(cell => cell.trim().replace(/["']/g, ''));
        // Only keep non-reference columns
        return columns.slice(0, csvHeaders.length);
      });

    // Auto-map columns based on headers
    csvMappings = {
      description: '',
      date: '',
      minutes: '',
      clientName: '',
      clientEmail: '',
      billingRateName: '',
      billable: '',
      ticketNumber: '',
      ticketTitle: ''
    };

    // Try to match headers with mapping fields
    csvHeaders.forEach(header => {
      const headerLower = header.toLowerCase();
      if (headerLower === 'description') csvMappings.description = header;
      else if (headerLower === 'date') csvMappings.date = header;
      else if (headerLower === 'minutes' || headerLower === 'duration') csvMappings.minutes = header;
      else if (headerLower.includes('client') && headerLower.includes('name')) csvMappings.clientName = header;
      else if (headerLower.includes('client') && headerLower.includes('email')) csvMappings.clientEmail = header;
      else if (headerLower.includes('billing') && headerLower.includes('rate')) csvMappings.billingRateName = header;
      else if (headerLower === 'billable') csvMappings.billable = header;
      else if (headerLower.includes('ticket') && headerLower.includes('number')) csvMappings.ticketNumber = header;
      else if (headerLower.includes('ticket') && headerLower.includes('title')) csvMappings.ticketTitle = header;
    });

    // Reset any previous state
    parsedEntries = [];
    errorMessage = null;
  }

  async function validateAndParseEntries() {
    if (!csvMappings.description || !csvMappings.minutes || !csvMappings.date) {
      errorMessage = 'Description, Minutes and Date are required mappings';
      return;
    }

    const parsed = rawData.map(row => {
      const entry: NewTimeEntry & { 
        valid: boolean; 
        errors: string[]; 
        actionId: string;
        clientName?: string;
        clientEmail?: string;
        clientMatched: boolean;
        ticketNumber?: string;
        ticketTitle?: string;
        ticketMatched: boolean;
      } = {
        description: '',
        date: new Date(),
        minutes: 0,
        startTime: new Date(),
        endTime: null,
        clientId: null,
        ticketId: null,
        billable: true,
        billingRateId: null,
        billed: false,
        locked: false,
        valid: true,
        errors: [],
        actionId: crypto.randomUUID(),
        clientMatched: false,
        ticketMatched: false
      };

      try {
        // Required fields
        entry.description = row[csvHeaders.indexOf(csvMappings.description)];
        if (!entry.description) {
          entry.errors.push('Description is required');
          entry.valid = false;
        }

        // Handle date if provided
        if (csvMappings.date) {
          const dateStr = row[csvHeaders.indexOf(csvMappings.date)];
          if (!dateStr) {
            entry.valid = false;
            entry.errors.push('Date is required');
          } else {
            // Try to parse the date
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
              entry.errors.push('Invalid date format');
              entry.valid = false;
            } else {
              // Validate that the date is not too far in the past or future (optional)
              const now = new Date();
              const oneYearAgo = new Date();
              oneYearAgo.setFullYear(now.getFullYear() - 1);
              const oneYearFromNow = new Date();
              oneYearFromNow.setFullYear(now.getFullYear() + 1);

              if (date < oneYearAgo || date > oneYearFromNow) {
                entry.errors.push('Date must be within one year of current date');
                entry.valid = false;
              }

              entry.date = date;
              entry.startTime = date;
            }
          }
        } else {
          // No date mapping provided
          entry.valid = false;
          entry.errors.push('Date mapping is required');
        }

        // Handle minutes/duration
        if (csvMappings.minutes) {
          const durationStr = row[csvHeaders.indexOf(csvMappings.minutes)];
          if (!durationStr) {
            entry.errors.push('Duration is required');
            entry.valid = false;
          } else {
            // Try parsing as HH:MM first
            const parsedMinutes = formattedToMinutes(durationStr);
            if (parsedMinutes !== null) {
              entry.minutes = parsedMinutes;
            } else {
              // Try parsing as plain minutes
              const minutes = parseInt(durationStr, 10);
              if (isNaN(minutes) || minutes <= 0) {
                entry.errors.push('Invalid duration format (use minutes as a number)');
                entry.valid = false;
              } else {
                entry.minutes = minutes;
              }
            }
          }
        } else {
          entry.errors.push('Duration is required');
          entry.valid = false;
        }

        // Handle client lookup by name or email (match only, don't create)
        let foundClient = null;
        
        if (csvMappings.clientName) {
          const clientName = row[csvHeaders.indexOf(csvMappings.clientName)];
          entry.clientName = clientName;
          
          if (clientName) {
            foundClient = $clientStore.find(c => 
              c.name.toLowerCase() === clientName.toLowerCase()
            );
            
            if (foundClient) {
              entry.clientMatched = true;
              entry.clientId = foundClient.id;
            }
          }
        }
        
        if (!foundClient && csvMappings.clientEmail) {
          const clientEmail = row[csvHeaders.indexOf(csvMappings.clientEmail)];
          entry.clientEmail = clientEmail;
          
          if (clientEmail) {
            foundClient = $clientStore.find(c => 
              c.email?.toLowerCase() === clientEmail.toLowerCase()
            );
            
            if (foundClient) {
              entry.clientMatched = true;
              entry.clientId = foundClient.id;
            }
          }
        }

        // Handle billing rate by name
        const billingRates = $settingsStore?.billingRates || [];
        
        if (csvMappings.billingRateName) {
          const rateName = row[csvHeaders.indexOf(csvMappings.billingRateName)];
          if (rateName) {
            const billingRate = billingRates.find((r) => 
              r.name.toLowerCase() === rateName.toLowerCase()
            );
            entry.billingRateId = billingRate?.id || null;
            if (!billingRate) {
              entry.errors.push('Billing rate not found');
            }
          }
        }

        // Handle billable flag
        if (csvMappings.billable) {
          const billable = row[csvHeaders.indexOf(csvMappings.billable)].toLowerCase();
          entry.billable = billable === 'true' || billable === 'yes' || billable === '1';
          // If billable but no rate specified, try to use default rate
          if (entry.billable && !entry.billingRateId) {
            const defaultRate = billingRates.find((r) => r.isDefault);
            entry.billingRateId = defaultRate?.id || null;
          }
        }

        // Handle ticket lookup (match only, don't create)
        if (csvMappings.ticketNumber) {
          const ticketNumber = row[csvHeaders.indexOf(csvMappings.ticketNumber)];
          entry.ticketNumber = ticketNumber;
          
          if (ticketNumber) {
            const existingTicket = $ticketStore.find((t): t is TicketData => 
              'ticketNumber' in t && t.ticketNumber === ticketNumber
            );
            
            if (existingTicket) {
              entry.ticketMatched = true;
              entry.ticketId = existingTicket.id;
            }
          }
        }
        
        if (csvMappings.ticketTitle) {
          const ticketTitle = row[csvHeaders.indexOf(csvMappings.ticketTitle)];
          entry.ticketTitle = ticketTitle;
        }

        entry.valid = entry.errors.length === 0;
      } catch (error) {
        entry.valid = false;
        entry.errors.push('Failed to parse entry');
      }

      return entry;
    });

    parsedEntries = parsed;
    validateEntries();
  }

  function validateEntries() {
    const validCount = parsedEntries.filter(e => e.valid).length;
    if (validCount === 0) {
      errorMessage = 'No valid entries found in CSV';
      return false;
    }
    return true;
  }

  async function importEntries() {
    if (!validateEntries() || isProcessing) return;

    try {
      isProcessing = true;
      errorMessage = null;

      // Filter out invalid entries
      const validEntries = parsedEntries.filter(e => e.valid);
      
      // Process entries and create missing clients/tickets first
      for (const entry of validEntries) {
        // Create client if needed
        if (!entry.clientMatched && (entry.clientName || entry.clientEmail)) {
          try {
            const newClient = await clientStore.add({
              name: entry.clientName || 'Unknown Client',
              email: entry.clientEmail || null,
              phone: null,
              address: null,
              notes: null,
              contactName: null,
              contactTitle: null
            });
            entry.clientId = newClient.id;
          } catch (error) {
            console.error('Failed to create client:', error);
            entry.errors.push('Failed to create client');
            entry.valid = false;
            continue;
          }
        }
        
        // Create ticket if needed
        if (!entry.ticketMatched && entry.ticketNumber && entry.clientId && entry.ticketTitle) {
          try {
            const newTicket = await ticketStore.add({
              title: entry.ticketTitle,
              description: '',
              clientId: entry.clientId,
              status: 'open',
              addons: {
                ticketNumber: entry.ticketNumber
              }
            });
            entry.ticketId = newTicket.id;
          } catch (error) {
            console.error('Failed to create ticket:', error);
            entry.errors.push('Failed to create ticket');
            entry.valid = false;
            continue;
          }
        }
      }

      // Submit all valid entries
      const results = await Promise.allSettled(
        validEntries.filter(e => e.valid).map(entry => {
          // Remove our added properties before submission
          const { 
            valid, errors, actionId, clientMatched, ticketMatched, 
            clientName, clientEmail, ticketNumber, ticketTitle, 
            ...submitEntry 
          } = entry;
          return timeEntryStore.add(submitEntry);
        })
      );

      // Count successes
      successCount = results.filter(r => r.status === 'fulfilled').length;

      // Refresh time entries store
      await timeEntryStore.load();

      // Notify completion
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to import time entries:', error);
      errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to import time entries';
    } finally {
      isProcessing = false;
    }
  }

  // Handle cell clicks for toggling billable status
  function handleTableCellClick(event: CustomEvent<any>) {
    // Extract the target element from the custom event
    const target = event.detail.originalEvent?.target || event.detail.target;
    if (!target) return;
    
    // Find the closest button with the toggle-billable action
    const button = target.closest('button[data-action="toggle-billable"]');
    if (!button) return;
    
    // Get the action ID of the entry to toggle
    const actionId = button.getAttribute('data-action-id');
    if (!actionId) return;
    
    // Find the entry in our parsed entries array
    const entryIndex = parsedEntries.findIndex(e => e.actionId === actionId);
    if (entryIndex < 0) return;
    
    // Toggle the billable state and update the entry
    parsedEntries[entryIndex].billable = !parsedEntries[entryIndex].billable;
    
    // Force a UI update (Svelte 5 reactive update)
    parsedEntries = [...parsedEntries];
    
    console.log(`Toggled billable state for entry ${actionId} to ${parsedEntries[entryIndex].billable}`);
  }

  // Generate CSV template for download
  function generateCsvTemplate() {
    // Create headers for required and optional columns
    const headers = [
      'description',
      'date',
      'minutes',
      'clientName',
      'clientEmail',
      'billable',
      'billingRateName',
      'ticketNumber',
      'ticketTitle'
    ];
    
    // Create example rows
    const today = new Date();
    const exampleRow = [
      'Example time entry description',
      today.toISOString().split('T')[0], // YYYY-MM-DD
      '15', // Minutes as a plain number
      'Acme Inc.',
      'contact@acme.com',
      'true',
      '', // Billing rate placeholder (will be filled with actual values later)
      'TICKET-123',
      'Fix navigation issues'
    ];
    
    const billingRates = $settingsStore?.billingRates || [];
    
    // Build CSV content following TimeVault development guidelines
    let csvContent = headers.join(',') + '\n';
    
    // Add examples of each billing rate for easy copying
    if (billingRates.length > 0) {
      // First add a commented reference section without hash symbols in rate names
      csvContent += '# Available billing rates - copy these exact names:\n';
      
      // Add each billing rate name on its own line for easy copying
      billingRates.forEach(rate => {
        csvContent += `${rate.name}\n`;
      });
      
      csvContent += '\n';
      
      // Add example rows with each billing rate 
      billingRates.forEach(rate => {
        const rateExample = [...exampleRow];
        rateExample[0] = `Example with ${rate.name} rate`;
        rateExample[6] = rate.name; // Use the exact rate name for direct copying
        
        csvContent += rateExample.join(',') + '\n';
      });
      
      // Add a simple example with no billing rate for non-billable entries
      const nonBillableExample = [...exampleRow];
      nonBillableExample[0] = 'Example non-billable entry';
      nonBillableExample[5] = 'false';
      nonBillableExample[6] = '';
      csvContent += nonBillableExample.join(',') + '\n';
    } else {
      // Just add the basic example if no rates exist
      csvContent += exampleRow.join(',') + '\n';
    }
    
    return csvContent;
  }
  
  // Download the CSV template
  function downloadCsvTemplate() {
    const csv = generateCsvTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'time-entries-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<div class="space-y-6">
  {#if errorMessage}
    <div class="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-20 text-red-400 p-4 rounded-lg">
      {errorMessage}
      <button class="ml-2 underline" onclick={() => errorMessage = null}>Dismiss</button>
    </div>
  {/if}

  {#if successCount > 0}
    <div class="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-20 text-green-400 p-4 rounded-lg">
      Successfully imported {successCount} time {successCount === 1 ? 'entry' : 'entries'}!
    </div>
  {:else}
    <div class="rounded-lg bg-amber-100 p-3 text-amber-800">
      <p class="text-sm">
        Import time entries from a CSV file. The CSV should contain headers and the following columns:
        description, date, and minutes (enter as a number, e.g. 15 for 15 minutes). Optional columns: client name, client email, billable status, billing rate name, ticket number, and ticket title.
      </p>
    </div>

    <!-- File Upload -->
    {#if !csvHeaders.length}
      <div class="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
        <Icon src={CloudArrowUp} class="w-12 h-12 mx-auto text-gray-500 mb-4" />
        <p class="text-gray-400 mb-4">Upload a CSV file to get started</p>
        <input
          type="file"
          accept=".csv"
          class="hidden"
          bind:this={fileInput}
          onchange={handleFileSelect}
        />
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <button 
            class="btn btn-primary"
            onclick={handleFileClick}
          >
            Select CSV File
          </button>
          <button 
            class="btn btn-secondary"
            onclick={downloadCsvTemplate}
          >
            Download Template
          </button>
        </div>
        <p class="text-xs text-gray-400 mt-4">
          The template includes sample time entries with all available billing rates for easy copying.
        </p>
      </div>
    {:else}
      <!-- CSV Mapping -->
      <div class="container-glass rounded-lg p-6">
        <h3 class="text-lg font-medium mb-4">Map CSV Columns</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Required Fields -->
          <div class="form-field">
            <label for="description-map" class="form-label">Description *</label>
            <select
              id="description-map"
              class="form-select"
              bind:value={csvMappings.description}
              required
            >
              <option value="">Select column</option>
              {#each csvHeaders as header}
                <option value={header}>{header}</option>
              {/each}
            </select>
          </div>

          <div class="form-field">
            <label for="date-map" class="form-label">Date *</label>
            <select
              id="date-map"
              class="form-select"
              bind:value={csvMappings.date}
              required
            >
              <option value="">Select column</option>
              {#each csvHeaders as header}
                <option value={header}>{header}</option>
              {/each}
            </select>
          </div>

          <div class="form-field">
            <label for="minutes-map" class="form-label">Minutes *</label>
            <select
              id="minutes-map"
              class="form-select"
              bind:value={csvMappings.minutes}
              required
            >
              <option value="">Select column</option>
              {#each csvHeaders as header}
                <option value={header}>{header}</option>
              {/each}
            </select>
          </div>

          <!-- Optional Fields -->
          <div class="form-field">
            <label for="client-name-map" class="form-label">Client Name</label>
            <select
              id="client-name-map"
              class="form-select"
              bind:value={csvMappings.clientName}
            >
              <option value="">Select column</option>
              {#each csvHeaders as header}
                <option value={header}>{header}</option>
              {/each}
            </select>
          </div>

          <div class="form-field">
            <label for="client-email-map" class="form-label">Client Email</label>
            <select
              id="client-email-map"
              class="form-select"
              bind:value={csvMappings.clientEmail}
            >
              <option value="">Select column</option>
              {#each csvHeaders as header}
                <option value={header}>{header}</option>
              {/each}
            </select>
          </div>

          <div class="form-field">
            <label for="billable-map" class="form-label">Billable</label>
            <select
              id="billable-map"
              class="form-select"
              bind:value={csvMappings.billable}
            >
              <option value="">Select column</option>
              {#each csvHeaders as header}
                <option value={header}>{header}</option>
              {/each}
            </select>
          </div>

          <div class="form-field">
            <label for="billing-rate-map" class="form-label">Billing Rate Name</label>
            <select
              id="billing-rate-map"
              class="form-select"
              bind:value={csvMappings.billingRateName}
            >
              <option value="">Select column</option>
              {#each csvHeaders as header}
                <option value={header}>{header}</option>
              {/each}
            </select>
          </div>

          <div class="form-field">
            <label for="ticket-number-map" class="form-label">Ticket Number</label>
            <select
              id="ticket-number-map"
              class="form-select"
              bind:value={csvMappings.ticketNumber}
            >
              <option value="">Select column</option>
              {#each csvHeaders as header}
                <option value={header}>{header}</option>
              {/each}
            </select>
          </div>

          <div class="form-field">
            <label for="ticket-title-map" class="form-label">Ticket Title</label>
            <select
              id="ticket-title-map"
              class="form-select"
              bind:value={csvMappings.ticketTitle}
            >
              <option value="">Select column</option>
              {#each csvHeaders as header}
                <option value={header}>{header}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="flex justify-end mt-6">
          <button
            class="btn btn-primary"
            onclick={validateAndParseEntries}
            disabled={!csvMappings.description}
          >
            Validate CSV
          </button>
        </div>
      </div>

      {#if parsedEntries.length > 0}
        <!-- Preview -->
        <div class="container-glass">
          <div class="p-6 border-b border-gray-700/20">
            <h3 class="text-lg font-medium">Preview</h3>
            <p class="text-sm text-gray-400 mt-1">
              {parsedEntries.filter(e => e.valid).length} of {parsedEntries.length} entries valid
            </p>
          </div>

          <DataTable
            data={parsedEntries}
            columns={previewColumns}
            pageable={true}
            searchable={true}
            bind:currentPage
            bind:pageSize
            searchPlaceholder="Search entries..."
            on:cellClick={handleTableCellClick}
          />

          <div class="flex justify-end gap-3 p-6 border-t border-gray-700/20">
            <button
              class="btn btn-secondary"
              onclick={() => {
                csvHeaders = [];
                parsedEntries = [];
                rawData = [];
                csvMappings = {
                  description: '',
                  date: '',
                  minutes: '',
                  clientName: '',
                  clientEmail: '',
                  billingRateName: '',
                  billable: '',
                  ticketNumber: '',
                  ticketTitle: ''
                };
              }}
            >
              Start Over
            </button>
            <button
              class="btn btn-primary"
              onclick={importEntries}
              disabled={!parsedEntries.some(e => e.valid) || isProcessing}
            >
              {#if isProcessing}
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Importing...
              {:else}
                <Icon src={DocumentCheck} class="w-4 h-4 mr-2" />
                Import Valid Entries ({parsedEntries.filter(e => e.valid).length})
              {/if}
            </button>
          </div>
        </div>
      {/if}
    {/if}
  {/if}
</div>