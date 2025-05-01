<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ticketStore, ticketsWithClientInfo } from '$lib/stores/ticketStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { userStore, userPermissions } from '$lib/stores/userStore';
  import { formatCurrency, formatTime } from '$lib/utils/invoiceUtils';
  import { minutesToFormatted } from '$lib/utils/timeUtils';
  import { Icon } from '@steeze-ui/svelte-icon';
  import {
    ArrowLeft,
    Clock,
    CurrencyDollar,
    DocumentText,
    Pencil,
    Plus,
    Trash,
    User as UserIcon,
    ChatBubbleLeftRight,
    Ticket as TicketIcon,
    InformationCircle
  } from '@steeze-ui/heroicons';
  import { GlassCard, Modal, TimeEntryForm, TicketNotes, StatsCard, TabView } from '$lib/components';
  import type { TimeEntry, Ticket, TicketStatus, User } from '$lib/types';

  // State with runes
  let ticket = $state<Ticket | null>(null);
  let isLoading = $state(true);
  let isUpdating = $state(false);
  let newStatusId = $state<string | null>(null);
  let showTimeEntryForm = $state(false);
  let showDeleteConfirm = $state(false);
  let ticketStatuses = $state<TicketStatus[]>([]);
  let currentUser = $state<User | null>(null);
  let activeTab = $state('info');
  let error = $state<string | null>(null);

  // Props and computed values using runes
  const ticketId = $derived($page.params.id);

  const clientName = $derived(
    ticket?.clientId 
      ? ($clientStore.find(c => c.id === ticket?.clientId)?.name ?? 'Unknown Client')
      : ''
  );

  const ticketEntries = $derived(
    $timeEntryStore.filter(entry => entry.ticketId === ticketId)
  );

  const totalMinutes = $derived(
    ticketEntries.reduce((sum, entry) => sum + (entry.minutes || 0), 0)
  );

  const totalHours = $derived(totalMinutes / 60);

  const totalBillableAmount = $derived(
    ticketEntries
      .filter(entry => entry.billable)
      .reduce((sum, entry) => {
        const rate = entry.billingRate?.rate || 0;
        return sum + (entry.minutes / 60) * rate;
      }, 0)
  );

  // Format date helper
  function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      console.warn('Invalid date in formatDate:', { date, type: typeof date });
      return 'Invalid Date';
    }
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Load initial data
  onMount(async () => {
    try {
      isLoading = true;
      error = null;
      await Promise.all([
        ticketStore.load(),
        clientStore.load(),
        timeEntryStore.load(),
        settingsStore.loadTicketStatuses()
      ]);

      // Get the current user
      userStore.subscribe(state => {
        currentUser = state.user;
      })();

      // Load ticket statuses
      ticketStatuses = $settingsStore.ticketSettings.statuses || [];
    } catch (err) {
      console.error('Failed to load data:', err);
      error = err instanceof Error ? err.message : 'Failed to load ticket data';
    } finally {
      isLoading = false;
    }
  });

  // Update ticket when data changes
  $effect(() => {
    if ($ticketsWithClientInfo.length > 0 && ticketId && !ticket) {
      ticket = $ticketsWithClientInfo.find(t => t.id === ticketId) || null;
      if (ticket) {
        newStatusId = ticket.statusId;
      }
    }
  });

  // Event Handlers
  async function updateStatus() {
    if (!ticket || ticket.statusId === newStatusId || !newStatusId) return;
    
    isUpdating = true;
    try {
      await ticketStore.update(ticket.id, {
        statusId: newStatusId
      });
    } catch (err) {
      console.error('Failed to update ticket status:', err);
      error = err instanceof Error ? err.message : 'Failed to update ticket status';
    } finally {
      isUpdating = false;
    }
  }

  function handleEdit() {
    goto(`/tickets/edit/${ticketId}`);
  }

  async function handleDeleteConfirm() {
    if (!ticket) return;
    
    if (ticketEntries.length > 0) {
      error = `Cannot delete ticket with ${ticketEntries.length} associated time entries`;
      showDeleteConfirm = false;
      return;
    }
    
    try {
      await ticketStore.remove(ticket.id);
      goto('/tickets');
    } catch (err) {
      console.error('Failed to delete ticket:', err);
      error = err instanceof Error ? err.message : 'Failed to delete ticket';
    } finally {
      showDeleteConfirm = false;
    }
  }

  function handleTimeEntryClick() {
    showTimeEntryForm = true;
  }

  function handleTimeEntrySave(entry: TimeEntry) {
    showTimeEntryForm = false;
    timeEntryStore.load();
  }

  function handleTimeEntryEdit(entry: TimeEntry) {
    goto(`/time-entries?edit=${entry.id}`);
  }

  function handleTabChange(tabId: string) {
    activeTab = tabId;
  }

  // Set up tabs for the ticket detail page
  const tabs: { id: string; title: string; icon: () => any }[] = [
    { 
      id: 'info', 
      title: 'Overview', 
      icon: () => InformationCircle 
    },
    { 
      id: 'time', 
      title: 'Time Entries', 
      icon: () => Clock
    },
    { 
      id: 'notes', 
      title: 'Notes', 
      icon: () => ChatBubbleLeftRight
    }
  ];

  // Tab content functions
  type HandlerElement = HTMLElement;
  type HandlerButton = HTMLButtonElement;

  type TabContentConfig = {
    component: any;
    props?: Record<string, any>;
    content: string;
    handlers?: {
      onMount?: (element: HandlerElement) => void | (() => void);
    };
  };

  const tabContent: Record<string, () => TabContentConfig> = {
    info: () => ({
      component: GlassCard,
      props: { className: "p-6" },
      content: `
        <div class="space-y-4">
          <h2 class="text-xl font-semibold mb-4">Ticket Details</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 class="text-sm uppercase text-gray-500 font-medium mb-2">Client</h3>
              <p class="text-lg">${clientName}</p>
            </div>
            
            <div>
              <h3 class="text-sm uppercase text-gray-500 font-medium mb-2">Status</h3>
              <p class="text-lg">
                ${ticket?.status?.name || 'Unknown Status'}
              </p>
            </div>
            
            <div>
              <h3 class="text-sm uppercase text-gray-500 font-medium mb-2">Created</h3>
              <p class="text-lg">${ticket ? formatDate(ticket.createdAt) : ''}</p>
            </div>
            
            <div>
              <h3 class="text-sm uppercase text-gray-500 font-medium mb-2">Last Updated</h3>
              <p class="text-lg">${ticket ? formatDate(ticket.updatedAt) : ''}</p>
            </div>
          </div>
          
          ${ticket?.description ? `
            <div class="mt-6">
              <h3 class="text-sm uppercase text-gray-500 font-medium mb-2">Description</h3>
              <div class="p-4 bg-gray-800/30 rounded-lg whitespace-pre-wrap">
                ${ticket.description}
              </div>
            </div>
          ` : ''}
        </div>
        
        <div class="mt-6">
          <h3 class="text-lg font-medium mb-3">Quick Actions</h3>
          <div class="flex flex-wrap gap-3">
            <button 
              class="btn btn-primary flex items-center gap-2"
              data-action="logTime"
            >
              <Icon src={Plus} class="h-4 w-4" />
              Log Time
            </button>
            <button
              class="btn btn-secondary flex items-center gap-2"
              data-action="editTicket"
            >
              <Icon src={Pencil} class="h-4 w-4" />
              Edit Ticket
            </button>
          </div>
        </div>
      `,
      handlers: {
        onMount: (element) => {
          const logTimeBtn = element.querySelector('[data-action="logTime"]') as HandlerButton;
          const editTicketBtn = element.querySelector('[data-action="editTicket"]') as HandlerButton;
          
          if (logTimeBtn) logTimeBtn.addEventListener('click', handleTimeEntryClick);
          if (editTicketBtn) editTicketBtn.addEventListener('click', handleEdit);
          
          return () => {
            if (logTimeBtn) logTimeBtn.removeEventListener('click', handleTimeEntryClick);
            if (editTicketBtn) editTicketBtn.removeEventListener('click', handleEdit);
          };
        }
      }
    }),
    time: () => ({
      component: GlassCard,
      props: { className: "p-6" },
      content: `
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-semibold">Time Entries</h2>
          <button 
            class="btn btn-primary flex items-center gap-2"
            data-action="addTimeEntry"
          >
            <Icon src={Plus} class="h-4 w-4" />
            Add Time Entry
          </button>
        </div>

        ${ticketEntries.length === 0 ? `
          <div class="text-center py-12 text-gray-400">
            No time entries recorded for this ticket yet.
          </div>
        ` : `
          <div class="overflow-x-auto">
            <table class="data-table w-full">
              <thead class="data-table-header">
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th class="right-aligned">Duration</th>
                  <th class="right-aligned">Rate</th>
                  <th class="right-aligned">Amount</th>
                  <th class="w-16"></th>
                </tr>
              </thead>
              <tbody>
                ${ticketEntries.map(entry => `
                  <tr class="data-table-row" data-entry-id="${entry.id}">
                    <td>${formatDate(entry.date)}</td>
                    <td>${entry.description}</td>
                    <td class="right-aligned">${minutesToFormatted(entry.minutes)}</td>
                    <td class="right-aligned">
                      $${entry.billingRate?.rate || 0}/hr
                    </td>
                    <td class="right-aligned">
                      ${formatCurrency((entry.billingRate?.rate || 0) * (entry.minutes / 60))}
                    </td>
                    <td>
                      <div class="flex justify-end">
                        <button
                          class="p-2 rounded hover:bg-gray-700/50"
                          title="Edit time entry"
                          data-action="editEntry"
                          data-entry-id="${entry.id}"
                        >
                          <Icon src={Pencil} class="h-4 w-4 text-blue-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot class="data-table-footer">
                <tr>
                  <td colspan="2">
                    <strong>Total</strong>
                  </td>
                  <td class="right-aligned">
                    <strong>${minutesToFormatted(totalMinutes)}</strong>
                  </td>
                  <td></td>
                  <td class="right-aligned">
                    <strong>${formatCurrency(totalBillableAmount)}</strong>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        `}
      `,
      handlers: {
        onMount: (element) => {
          const addTimeEntryBtn = element.querySelector('[data-action="addTimeEntry"]') as HandlerButton;
          if (addTimeEntryBtn) addTimeEntryBtn.addEventListener('click', handleTimeEntryClick);
          
          // Setup edit entry buttons
          const editButtons = element.querySelectorAll('[data-action="editEntry"]') as NodeListOf<HandlerButton>;
          editButtons.forEach(btn => {
            const entryId = btn.getAttribute('data-entry-id');
            const entry = ticketEntries.find(e => e.id === entryId);
            if (entry) {
              btn.addEventListener('click', () => handleTimeEntryEdit(entry));
            }
          });
          
          return () => {
            if (addTimeEntryBtn) addTimeEntryBtn.removeEventListener('click', handleTimeEntryClick);
            editButtons.forEach(btn => {
              const entryId = btn.getAttribute('data-entry-id');
              const entry = ticketEntries.find(e => e.id === entryId);
              if (entry) {
                btn.removeEventListener('click', () => handleTimeEntryEdit(entry));
              }
            });
          };
        }
      }
    }),
    notes: () => ({
      component: GlassCard,
      props: { className: "p-6" },
      content: `
        <div class="flex items-center gap-3 mb-6">
          <Icon src={ChatBubbleLeftRight} class="h-5 w-5 text-blue-400" />
          <h2 class="text-xl font-semibold">Notes & Comments</h2>
        </div>
        <div id="notes-container"></div>
      `,
      handlers: {
        onMount: (element) => {
          const notesContainer = element.querySelector('#notes-container') as HandlerElement;
          
          if (notesContainer && currentUser?.id) {
            const notesComponent = new TicketNotes({
              target: notesContainer,
              props: {
                ticketId,
                userId: currentUser.id,
                showInternalNotes: $userPermissions.canViewInternalNotes
              }
            });
            
            return () => {
              if (notesComponent && notesComponent.$destroy) {
                notesComponent.$destroy();
              }
            };
          }
          
          return () => {};
        }
      }
    })
  };
</script>

<div class="container mx-auto px-4 py-8 pb-20 space-y-6">
  <!-- Back Navigation -->
  <a 
    href="/tickets"
    class="inline-flex items-center text-gray-400 hover:text-white"
  >
    <Icon src={ArrowLeft} class="mr-2 h-4 w-4" />
    <span>Back to Tickets</span>
  </a>

  {#if error}
    <GlassCard className="p-6 bg-red-500/20 border-red-400">
      <p class="text-red-300">{error}</p>
    </GlassCard>
  {/if}

  {#if isLoading}
    <GlassCard className="p-6 text-center">
      <span class="loading loading-spinner"></span>
      <p class="mt-2 text-gray-400">Loading ticket...</p>
    </GlassCard>
  {:else if ticket}
    <!-- Header Card -->
    <GlassCard className="p-6">
      <div class="flex flex-col md:flex-row justify-between items-start gap-6">
        <!-- Left side - Title and metadata -->
        <div class="space-y-4">
          <div>
            <h1 class="text-2xl font-bold">
              {#if ticket.ticketNumber}
                <span class="text-gray-400 mr-2">#{ticket.ticketNumber}</span>
              {/if}
              {ticket.title}
            </h1>
            <div class="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-400">
              <div class="flex items-center gap-2">
                <Icon src={UserIcon} class="h-4 w-4" />
                <a href="/clients/{ticket.clientId}" class="hover:text-blue-400">
                  {clientName}
                </a>
              </div>
              <div>Created {formatDate(ticket.createdAt)}</div>
            </div>
          </div>

          {#if ticket.description}
            <div class="prose max-w-none text-default">
              {ticket.description}
            </div>
          {/if}
        </div>

        <!-- Right side - Actions -->
        <div class="flex flex-col md:flex-row items-start md:items-center gap-4">
          <!-- Status Selector -->
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">Status:</span>
            <select
              bind:value={newStatusId}
              oninput={updateStatus}
              disabled={isUpdating}
              class="form-select"
            >
              {#each ticketStatuses as status}
                <option value={status.id}>{status.name}</option>
              {/each}
            </select>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-2">
            <button
              onclick={handleEdit}
              class="btn btn-secondary flex items-center gap-2"
            >
              <Icon src={Pencil} class="h-4 w-4" />
              Edit
            </button>
            <button
              onclick={() => showDeleteConfirm = true}
              class="btn btn-danger flex items-center gap-2"
            >
              <Icon src={Trash} class="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </GlassCard>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      <StatsCard
        title="Time Logged"
        value={minutesToFormatted(totalMinutes)}
        icon={Clock}
        iconColor="blue"
      />
      <StatsCard
        title="Billable Amount"
        value={formatCurrency(totalBillableAmount)}
        icon={CurrencyDollar}
        iconColor="green"
      />
      <StatsCard
        title="Time Entries"
        value={ticketEntries.length.toString()}
        icon={DocumentText}
        iconColor="purple"
      />
    </div>

    <!-- Tab navigation -->
    <TabView 
      tabs={tabs} 
      activeTab={activeTab} 
      onTabChange={handleTabChange}
      tabContent={tabContent}
    />
  {:else}
    <GlassCard className="p-6 text-center">
      <h1 class="text-2xl font-bold mb-4">Ticket not found</h1>
      <p class="text-gray-400 mb-6">
        The ticket you're looking for could not be found or may have been deleted.
      </p>
      <a href="/tickets" class="btn btn-primary">
        Return to Tickets
      </a>
    </GlassCard>
  {/if}
</div>

<!-- Time Entry Modal -->
<Modal
  open={showTimeEntryForm}
  title="Add Time Entry"
  size="lg"
  onclose={() => (showTimeEntryForm = false)}
>
  <div class="p-6">
    <TimeEntryForm
      prefilledTicketId={ticketId}
      prefilledClientId={ticket?.clientId}
      onSave={handleTimeEntrySave}
      onCancel={() => (showTimeEntryForm = false)}
    />
  </div>
</Modal>

<!-- Delete Confirmation Modal -->
<Modal
  open={showDeleteConfirm}
  title="Delete Ticket"
  size="md"
  onclose={() => (showDeleteConfirm = false)}
>
  <div class="p-6">
    <p class="mb-4 text-gray-900">
      Are you sure you want to delete this ticket?
    </p>
    <p class="text-sm text-gray-600">
      This action cannot be undone.
    </p>
  </div>

  {#snippet footer()}
    <div slot="footer" class="flex justify-end gap-3">
      <button class="btn btn-secondary" onclick={() => (showDeleteConfirm = false)}>
        Cancel
      </button>
      <button class="btn btn-danger" onclick={handleDeleteConfirm}>Delete</button>
    </div>
  {/snippet}
</Modal>