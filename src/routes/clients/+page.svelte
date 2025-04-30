<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import type { Client } from '$lib/types';
  import { clientStore } from '$lib/stores/clientStore';
  import { GlassCard, ClientForm, Modal, DataTable } from '$lib/components';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { Pencil, Trash, ArrowPath, UserGroup } from '@steeze-ui/heroicons';

  // State
  let editingClient = writable<Client | null>(null);
  let showForm = writable<boolean>(false);
  let isLoading = writable<boolean>(true);
  let searchTerm = '';
  let clients: Client[] = [];
  let hierarchicalClients: Client[] = [];
  let currentPage = 1;
  let pageSize = 10;

  // Define DataTable columns
  const columns = [
    {
      key: 'name',
      title: 'Name',
      sortable: true,
      render: (value, row) => {
        return `<a href="/clients/${row.id}" class="font-medium text-blue-400 hover:text-blue-300">${value}</a>`;
      }
    },
    {
      key: 'type',
      title: 'Type',
      sortable: true,
      render: (value) => {
        const typeColors = {
          'business': 'bg-blue-500/10 text-blue-400',
          'individual': 'bg-green-500/10 text-green-400', 
          'container': 'bg-purple-500/10 text-purple-400'
        };
        const color = typeColors[value] || 'bg-gray-500/10 text-gray-400';
        const label = value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown';
        
        return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}">
          ${label}
        </span>`;
      }
    },
    {
      key: 'email',
      title: 'Email',
      sortable: true,
      render: (value) => {
        return value ? `<a href="mailto:${value}" class="hover:text-blue-400">${value}</a>` : '-';
      }
    },
    {
      key: 'phone',
      title: 'Phone',
      sortable: true,
      render: (value) => {
        return value ? `<a href="tel:${value}" class="hover:text-blue-400">${value}</a>` : '-';
      }
    },
    {
      key: 'contact',
      title: 'Contact',
      sortable: true,
      render: (value) => {
        return value || '-';
      }
    },
    {
      key: 'id',
      title: 'Actions',
      align: 'right',
      sortable: false,
      render: (id, client) => {
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

  // Load client data on component mount
  onMount(async () => {
    try {
      await clientStore.load(true); // Force refresh
      $isLoading = false;
      clients = $clientStore;
      hierarchicalClients = organizeClientsHierarchically(clients);
    } catch (error) {
      console.error('Failed to load clients:', error);
      $isLoading = false;
    }
  });

  // Organize clients into a hierarchical structure
  function organizeClientsHierarchically(flatClients: Client[]): Client[] {
    // Create a deep copy of clients to avoid modifying the original data
    const clientsCopy = JSON.parse(JSON.stringify(flatClients)) as Client[];
    
    // Map for quick client lookup by ID
    const clientsMap = new Map<string, Client>();
    clientsCopy.forEach(client => {
      // Initialize children array if it doesn't exist
      if (!client.children) {
        client.children = [];
      }
      clientsMap.set(client.id, client);
    });
    
    // Root level clients (those without parents)
    const rootClients: Client[] = [];
    
    // Organize clients into parent-child relationships
    clientsCopy.forEach(client => {
      if (client.parentId) {
        const parent = clientsMap.get(client.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(client);
        } else {
          // If parent not found, put at root level
          rootClients.push(client);
        }
      } else {
        // No parent, so it's a root client
        rootClients.push(client);
      }
    });
    
    // Sort root clients by name
    return rootClients.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Event handlers
  function handleEdit(client: Client) {
    $editingClient = clients.find(c => c.id === client.id) || null;
    $showForm = true;
  }

  function handleSave() {
    $editingClient = null;
    $showForm = false;
    // Refresh the client list
    refreshClients();
  }

  function handleCancel() {
    $editingClient = null;
    $showForm = false;
  }

  function handleRowClick(event) {
    const { row } = event.detail;
    window.location.href = `/clients/${row.id}`;
  }

  function handleCellClick(event) {
    const target = event.target as HTMLElement;
    const button = target.closest('button[data-action]');
    
    if (button) {
      event.stopPropagation(); // Prevent row click
      const action = button.getAttribute('data-action');
      const id = button.getAttribute('data-id');
      
      if (action === 'edit' && id) {
        const client = clients.find(c => c.id === id);
        if (client) {
          handleEdit(client);
        }
      }
    }
  }

  function refreshClients() {
    $isLoading = true;
    clientStore.load(true).then(() => {
      clients = $clientStore;
      hierarchicalClients = organizeClientsHierarchically(clients);
      $isLoading = false;
    });
  }

  // Watch for client store changes
  $: {
    clients = $clientStore;
    hierarchicalClients = organizeClientsHierarchically(clients);
  }
</script>

<div class="space-y-6">
  <GlassCard className="p-6">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div class="flex items-center space-x-3">
        <Icon src={UserGroup} class="w-8 h-8 text-blue-500" />
        <h1 class="text-2xl font-bold">Clients</h1>
      </div>
      <div class="flex gap-3">
        <button
          type="button"
          class="btn btn-secondary flex items-center gap-2"
          onclick={refreshClients}
        >
          <Icon src={ArrowPath} class="w-4 h-4" />
          <span>Refresh</span>
        </button>
        <button
          class="btn btn-primary"
          onclick={() => $showForm = true}
        >
          Add New Client
        </button>
      </div>
    </div>
  </GlassCard>
  
  <DataTable
    data={hierarchicalClients}
    {columns}
    title="Client List"
    loading={$isLoading}
    searchable={true}
    pageable={true}
    nestedKey="children"
    nestedIndent={24}
    defaultCollapsed={true}
    bind:currentPage
    bind:pageSize
    searchPlaceholder="Search clients..."
    emptyMessage="No clients found. Add a new client to get started."
    on:rowClick={handleRowClick}
    onclick={handleCellClick}
  />
</div>

<Modal
  open={$showForm}
  title={$editingClient ? 'Edit Client' : 'New Client'}
  size="lg"
  onclose={handleCancel}
>
  <div class="p-6">
    <ClientForm
      editClient={$editingClient}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  </div>
</Modal>