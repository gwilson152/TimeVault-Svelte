<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import { TicketForm, GlassCard, Modal, DataTable } from '$lib/components';
  import type { Ticket, NewTicket } from '$lib/types';
  import { ticketStore } from '$lib/stores/ticketStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { Ticket as TicketIcon, Plus, ArrowPath } from '@steeze-ui/heroicons';

  // State management
  let showForm = writable<boolean>(false);
  let editingTicket = writable<Ticket | null>(null);
  let isLoading = writable<boolean>(true);
  let tickets: Ticket[] = [];
  let searchTerm = '';
  let currentPage = 1;
  let pageSize = 10;
  
  // Define DataTable columns
  const columns = [
    {
      key: 'title',
      title: 'Title',
      sortable: true,
      render: (value, row) => {
        return `<a href="/tickets/${row.id}" class="font-medium text-blue-400 hover:text-blue-300">${value}</a>`;
      }
    },
    {
      key: 'client.name',
      title: 'Client',
      sortable: true,
      render: (value, row) => {
        if (row.client) {
          return `<a href="/clients/${row.clientId}" class="hover:text-blue-400">${value}</a>`;
        }
        return `<span class="text-gray-400">Unknown Client</span>`;
      }
    },
    {
      key: 'status.name',
      title: 'Status',
      sortable: true,
      render: (value, row) => {
        if (!row.status) return `<span class="text-gray-400">Unknown</span>`;
        const color = row.status.color || 'gray';
        return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-${color}-500/10 text-${color}-400">
          ${value}
        </span>`;
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
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 5H6C4.89543 5 4 5.89543 4 7V18C4 19.1046 4.89543 20 6 20H17C18.1046 20 19 19.1046 19 18V13M17.5858 3.58579C18.3668 2.80474 19.6332 2.80474 20.4142 3.58579C21.1953 4.36683 21.1953 5.63316 20.4142 6.41421L11.8284 15H9L9 12.1716L17.5858 3.58579Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>`;
      }
    }
  ];
  
  // Load tickets data when page mounts
  onMount(async () => {
    try {
      await Promise.all([
        ticketStore.load(),
        clientStore.load()
      ]);
      
      tickets = $ticketStore.map(ticket => {
        // Find the client for this ticket
        const client = $clientStore.find(c => c.id === ticket.clientId);
        return {
          ...ticket,
          client
        };
      });
      
      $isLoading = false;
    } catch (error) {
      console.error('Failed to load tickets:', error);
      $isLoading = false;
    }
  });

  // Event handlers
  function handleEdit(ticket: Ticket) {
    $editingTicket = ticket;
    $showForm = true;
  }

  async function handleSubmit(ticket: Partial<Ticket>) {
    try {
      if ($editingTicket) {
        await ticketStore.update($editingTicket.id, ticket);
      } else {
        // Cast to NewTicket since we know required fields will be present
        await ticketStore.add(ticket as NewTicket);
      }
      $editingTicket = null;
      $showForm = false;
      
      // Refresh data
      refreshTickets();
    } catch (error) {
      console.error('Failed to save ticket:', error);
      alert('Failed to save ticket');
    }
  }

  function handleCancel() {
    $editingTicket = null;
    $showForm = false;
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
  
  function refreshTickets() {
    $isLoading = true;
    
    Promise.all([
      ticketStore.load(true),
      clientStore.load()
    ]).then(() => {
      tickets = $ticketStore.map(ticket => {
        const client = $clientStore.find(c => c.id === ticket.clientId);
        return {
          ...ticket,
          client
        };
      });
      
      $isLoading = false;
    });
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
          on:click={refreshTickets}
        >
          <Icon src={ArrowPath} class="w-4 h-4" />
          <span>Refresh</span>
        </button>
        <button
          class="btn btn-primary flex items-center gap-2"
          on:click={() => $showForm = true}
        >
          <Icon src={Plus} class="w-4 h-4" />
          <span>New Ticket</span>
        </button>
      </div>
    </div>
  </GlassCard>

  <DataTable
    data={tickets}
    {columns}
    title="Ticket List"
    loading={$isLoading}
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
  open={$showForm}
  title={$editingTicket ? 'Edit Ticket' : 'New Ticket'}
  width="max-w-2xl"
  on:close={handleCancel}
>
  <div class="p-6">
    <TicketForm 
      editTicket={$editingTicket}
      onSubmit={handleSubmit}
    />
  </div>
</Modal>