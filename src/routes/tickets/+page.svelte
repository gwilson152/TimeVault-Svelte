<script lang="ts">
  import { onMount } from 'svelte';
  import { TicketForm, GlassCard, Modal, DataTable, StatusBadge } from '$lib/components';
  import type { Ticket, NewTicket, TicketStatus } from '$lib/types';
  import { ticketStore } from '$lib/stores/ticketStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { Ticket as TicketIcon, Plus, ArrowPath } from '@steeze-ui/heroicons';

  // State management using Svelte 5 runes
  let showForm = $state(false);
  let editingTicket = $state<Ticket | null>(null);
  let isLoading = $state(true);
  let tickets = $state<Ticket[]>([]);
  let ticketStatuses = $state<TicketStatus[]>([]);
  let searchTerm = $state('');
  let currentPage = $state(1);
  let pageSize = $state(10);
  
  // Prevent multiple concurrent loads
  let isProcessingTickets = false;
  
  // Define DataTable columns
  const columns = [
    {
      key: 'client.name',
      title: 'Client',
      sortable: true,
      formatter: (value) => value || 'Unknown'
    },
    {
      key: 'title',
      title: 'Ticket',
      sortable: true
    },
    {
      key: 'status.name',
      title: 'Status',
      sortable: true,
      formatter: (value) => value || 'No Status',
      cellClass: (value, row) => {
        const status = row.status;
        if (!status) return 'status-badge status-badge-gray';
        
        const colorName = status.color?.replace('#', '') || '718096';
        return `status-badge status-badge-${colorName}`;
      }
    },
    {
      key: 'description',
      title: 'Description',
      sortable: true,
      formatter: (value) => value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : '-'
    },
    {
      key: 'createdAt',
      title: 'Created',
      sortable: true,
      formatter: (value) => new Date(value).toLocaleDateString()
    },
    {
      key: 'id',
      title: 'Actions',
      align: 'right',
      sortable: false,
      render: (id) => {
        return `<div class="flex justify-end gap-2">
          <button class="table-action-button" data-action="edit" data-id="${id}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </button>
        </div>`;
      }
    }
  ];
  
  // Load tickets data when page mounts
  onMount(async () => {
    await loadPageData();
  });

  // Separate function to load data to avoid duplication
  async function loadPageData() {
    isLoading = true;
    
    try {
      // Load in parallel for efficiency
      const statusesPromise = settingsStore.loadTicketStatuses();
      await Promise.all([
        ticketStore.load(),
        clientStore.load()
      ]);
      
      // Get ticket statuses from the promise
      ticketStatuses = await statusesPromise;
      
      // Process tickets with client and status data
      processTickets();
    } catch (error) {
      console.error('Failed to load tickets page data:', error);
    } finally {
      isLoading = false;
    }
  }
  
  // Process tickets with client and status data
  function processTickets() {
    // Prevent reentrance that could cause infinite loops
    if (isProcessingTickets) return;
    
    try {
      isProcessingTickets = true;
      
      const allTickets = ticketStore.getAll();
      let clients = [];
      
      // Use store subscription pattern to get clients
      // This subscription is executed once and immediately unsubscribed
      clientStore.subscribe(value => { 
        clients = value; 
      })();
      
      // Create a new array to avoid modifying existing tickets
      const processedTickets = allTickets.map(ticket => {
        // Find the client for this ticket
        const client = clients.find(c => c.id === ticket.clientId);
        
        // Find status for this ticket
        const status = ticketStatuses.find(s => s.id === ticket.statusId);
        
        return {
          ...ticket,
          client,
          status
        };
      });
      
      // Only update tickets if they've actually changed
      tickets = processedTickets;
    } finally {
      isProcessingTickets = false;
    }
  }

  // Event handlers
  function handleEdit(ticket: Ticket) {
    editingTicket = ticket;
    showForm = true;
  }

  async function handleSubmit(ticket: Partial<Ticket>) {
    if (!ticket) return;
    
    try {
      if (editingTicket) {
        await ticketStore.update(editingTicket.id, ticket);
      } else {
        // Cast to NewTicket since we know required fields will be present
        await ticketStore.add(ticket as NewTicket);
      }
      
      // Reset form state
      editingTicket = null;
      showForm = false;
      
      // Refresh data
      await refreshTickets();
    } catch (error) {
      console.error('Failed to save ticket:', error);
      alert('Failed to save ticket');
    }
  }

  function handleCancel() {
    editingTicket = null;
    showForm = false;
  }
  
  function handleRowClick(event) {
    const { row } = event.detail;
    window.location.href = `/tickets/${row.id}`;
  }
  
  function handleCellClick(event) {
    const target = event.target as HTMLElement;
    const button = target.closest('button[data-action]');
    
    if (button) {
      event.stopPropagation(); // Prevent row click
      const action = button.getAttribute('data-action');
      const id = button.getAttribute('data-id');
      
      if (action === 'edit' && id) {
        const ticket = tickets.find(t => t.id === id);
        if (ticket) {
          handleEdit(ticket);
        }
      }
    }
  }
  
  async function refreshTickets() {
    isLoading = true;
    
    try {
      const statusesPromise = settingsStore.loadTicketStatuses();
      await Promise.all([
        ticketStore.load(true), // Force reload
        clientStore.load()
      ]);
      
      // Wait for ticket statuses to finish loading before processing
      ticketStatuses = await statusesPromise;
      
      // Process tickets with the fresh data
      processTickets();
    } catch (error) {
      console.error('Failed to refresh tickets:', error);
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="space-y-6">
  <GlassCard className="p-6">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div class="flex items-center space-x-3">
        <Icon src={TicketIcon} class="w-8 h-8 text-blue-500" />
        <h1 class="text-2xl font-bold">Tickets</h1>
      </div>
      <div class="flex gap-3">
        <button
          type="button"
          class="btn btn-secondary flex items-center gap-2"
          onclick={refreshTickets}
        >
          <Icon src={ArrowPath} class="w-4 h-4" />
          <span>Refresh</span>
        </button>
        <button
          class="btn btn-primary flex items-center gap-2"
          onclick={() => showForm = true}
        >
          <Icon src={Plus} class="w-4 h-4" />
          <span>New Ticket</span>
        </button>
      </div>
    </div>
  </GlassCard>

  <DataTable
    data={tickets}
    columns={columns}
    title="Ticket List"
    loading={isLoading}
    searchable={true}
    pageable={true}
    bind:currentPage
    bind:pageSize
    searchPlaceholder="Search tickets..."
    emptyMessage="No tickets found. Add a new ticket to get started."
    on:rowClick={handleRowClick}
    on:click={handleCellClick}
  />
</div>

<Modal
  open={showForm}
  title={editingTicket ? 'Edit Ticket' : 'New Ticket'} 
  size="lg"
  onclose={handleCancel}
>
  <div class="p-6">
    <TicketForm 
      editTicket={editingTicket}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
    />
  </div>
</Modal>