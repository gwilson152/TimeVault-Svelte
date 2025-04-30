<script lang="ts">
  import { onMount } from 'svelte';
  import { userStore, userPermissions } from '$lib/stores/userStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { GlassCard, Modal } from '$lib/components';
  import type { User, UserRole } from '$lib/types';
  
  // State for the user list and form handling
  let users: User[] = $state([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  
  // Form state
  let showUserModal = $state(false);
  let isEditMode = $state(false);
  let selectedUser = $state<User | null>(null);
  
  // Form fields
  let formData = $state({
    id: '',
    name: '',
    email: '',
    password: '',
    role: 'CLIENT_USER' as UserRole,
    clientId: null as string | null,
    active: true
  });
  
  // Form validation
  let formErrors = $state({
    name: '',
    email: '',
    password: '',
    role: '',
    clientId: ''
  });
  
  // Available roles for selection
  const roles: { value: UserRole; label: string; }[] = [
    { value: 'ADMIN', label: 'Administrator' },
    { value: 'AGENT', label: 'Agent' },
    { value: 'CLIENT_ADMIN', label: 'Client Administrator' },
    { value: 'CLIENT_USER', label: 'Client User' }
  ];
  
  // Client-specific role types - these require a client to be selected
  const clientRoles: UserRole[] = ['CLIENT_ADMIN', 'CLIENT_USER'];
  
  // Load data
  onMount(async () => {
    try {
      // Load users and clients
      await loadUsers();
      await clientStore.load();
      
      isLoading = false;
    } catch (err) {
      console.error('Failed to load data:', err);
      error = 'Failed to load users';
      isLoading = false;
    }
  });
  
  // Load users helper function
  async function loadUsers() {
    try {
      users = await userStore.getUsers();
    } catch (err) {
      throw err;
    }
  }
  
  // Format date helper
  function formatDate(date: Date | string | null | undefined) {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  }
  
  // Prepare the form for creating a new user
  function openCreateUserForm() {
    isEditMode = false;
    selectedUser = null;
    
    // Reset form data
    formData = {
      id: '',
      name: '',
      email: '',
      password: '',
      role: 'CLIENT_USER',
      clientId: null,
      active: true
    };
    
    // Reset form errors
    formErrors = {
      name: '',
      email: '',
      password: '',
      role: '',
      clientId: ''
    };
    
    showUserModal = true;
  }
  
  // Prepare the form for editing an existing user
  function openEditUserForm(user: User) {
    isEditMode = true;
    selectedUser = user;
    
    // Set form data from user
    formData = {
      id: user.id,
      name: user.name,
      email: user.email,
      password: '', // Don't show password, will only update if provided
      role: user.role,
      clientId: user.clientId,
      active: user.active
    };
    
    // Reset form errors
    formErrors = {
      name: '',
      email: '',
      password: '',
      role: '',
      clientId: ''
    };
    
    showUserModal = true;
  }
  
  // Form validation logic
  function validateForm() {
    let isValid = true;
    
    // Reset errors
    formErrors = {
      name: '',
      email: '',
      password: '',
      role: '',
      clientId: ''
    };
    
    // Name validation
    if (!formData.name.trim()) {
      formErrors.name = 'Name is required';
      isValid = false;
    }
    
    // Email validation
    if (!formData.email.trim()) {
      formErrors.email = 'Email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      formErrors.email = 'Invalid email format';
      isValid = false;
    }
    
    // Password validation - only required for new users
    if (!isEditMode && !formData.password) {
      formErrors.password = 'Password is required for new users';
      isValid = false;
    } else if (formData.password && formData.password.length < 8) {
      formErrors.password = 'Password must be at least 8 characters';
      isValid = false;
    }
    
    // Client validation - required for client roles
    if (clientRoles.includes(formData.role) && !formData.clientId) {
      formErrors.clientId = 'Client is required for this role';
      isValid = false;
    }
    
    return isValid;
  }
  
  // Handle saving the user (create or update)
  async function handleSaveUser() {
    if (!validateForm()) {
      return;
    }
    
    try {
      if (isEditMode && selectedUser) {
        // Update existing user
        const userData = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          clientId: formData.clientId,
          active: formData.active
        };
        
        // Only include password if it was changed
        if (formData.password) {
          Object.assign(userData, { password: formData.password });
        }
        
        await userStore.updateUser(selectedUser.id, userData);
      } else {
        // Create new user
        await userStore.createUser({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          clientId: formData.clientId
        });
      }
      
      // Reload users and close modal
      await loadUsers();
      showUserModal = false;
    } catch (err) {
      console.error('Failed to save user:', err);
      alert('Failed to save user. Please try again.');
    }
  }
  
  // Delete a user
  async function handleDeleteUser(userId: string) {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }
    
    try {
      await userStore.deleteUser(userId);
      await loadUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('Failed to delete user. Please try again.');
    }
  }
  
  // Helper to get client name by ID
  function getClientName(clientId: string | null) {
    if (!clientId) return 'N/A';
    return $clientStore.find(client => client.id === clientId)?.name || 'Unknown Client';
  }
  
  // Helper to get role label
  function getRoleLabel(role: UserRole) {
    return roles.find(r => r.value === role)?.label || role;
  }
</script>

<div class="container mx-auto py-8 px-4">
  <GlassCard className="mb-8">
    <div class="flex flex-col md:flex-row justify-between items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold mb-2">User Management</h1>
        <p class="text-gray-400">Manage users and their permissions</p>
      </div>
      
      <button 
        class="btn btn-primary" 
        onclick={openCreateUserForm}
      >
        Create User
      </button>
    </div>
  </GlassCard>
  
  {#if isLoading}
    <GlassCard>
      <div class="py-8 text-center">
        <p class="text-gray-400 animate-pulse">Loading users...</p>
      </div>
    </GlassCard>
  {:else if error}
    <GlassCard>
      <div class="py-8 text-center">
        <p class="text-red-500">{error}</p>
        <button 
          class="mt-4 btn btn-secondary" 
          onclick={() => { isLoading = true; loadUsers().finally(() => isLoading = false); }}
        >
          Retry
        </button>
      </div>
    </GlassCard>
  {:else if users.length === 0}
    <GlassCard>
      <div class="py-8 text-center">
        <p class="text-gray-400">No users found</p>
        <button 
          class="mt-4 btn btn-primary" 
          onclick={openCreateUserForm}
        >
          Create First User
        </button>
      </div>
    </GlassCard>
  {:else}
    <GlassCard className="p-0 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="data-table w-full">
          <thead class="data-table-header">
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Client</th>
              <th>Status</th>
              <th>Last Login</th>
              <th class="right-aligned">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each users as user}
              <tr class="data-table-row">
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span class="inline-block px-2 py-1 rounded text-xs font-medium" 
                    class:bg-blue-600={user.role === 'ADMIN'}
                    class:bg-green-600={user.role === 'AGENT'}
                    class:bg-purple-600={user.role === 'CLIENT_ADMIN'}
                    class:bg-gray-600={user.role === 'CLIENT_USER'}
                  >
                    {getRoleLabel(user.role)}
                  </span>
                </td>
                <td>{getClientName(user.clientId)}</td>
                <td>
                  {#if user.active}
                    <span class="text-green-500">Active</span>
                  {:else}
                    <span class="text-red-500">Inactive</span>
                  {/if}
                </td>
                <td>{formatDate(user.lastLoginAt)}</td>
                <td class="right-aligned">
                  <div class="flex justify-end gap-2">
                    <button 
                      class="table-action-button-primary"
                      onclick={() => openEditUserForm(user)}
                    >
                      Edit
                    </button>
                    <button 
                      class="table-action-button-danger"
                      onclick={() => handleDeleteUser(user.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </GlassCard>
  {/if}
</div>

<!-- User Form Modal -->
<Modal
  open={showUserModal}
  title={isEditMode ? 'Edit User' : 'Create User'}
  size="lg"
  onclose={() => showUserModal = false}
>
  <div class="p-6">
    <form class="space-y-4" onsubmit|preventDefault={handleSaveUser}>
      <!-- Name Field -->
      <div class="form-field">
        <label for="name" class="form-label">Name</label>
        <input 
          id="name"
          type="text" 
          class="form-input"
          class:error={formErrors.name}
          bind:value={formData.name}
          placeholder="Full name"
        />
        {#if formErrors.name}
          <span class="form-error">{formErrors.name}</span>
        {/if}
      </div>
      
      <!-- Email Field -->
      <div class="form-field">
        <label for="email" class="form-label">Email</label>
        <input 
          id="email"
          type="email" 
          class="form-input"
          class:error={formErrors.email}
          bind:value={formData.email}
          placeholder="Email address"
        />
        {#if formErrors.email}
          <span class="form-error">{formErrors.email}</span>
        {/if}
      </div>
      
      <!-- Password Field -->
      <div class="form-field">
        <label for="password" class="form-label">
          Password {isEditMode ? '(leave blank to keep current)' : ''}
        </label>
        <input 
          id="password"
          type="password" 
          class="form-input"
          class:error={formErrors.password}
          bind:value={formData.password}
          placeholder="Enter password"
          required={!isEditMode}
        />
        {#if formErrors.password}
          <span class="form-error">{formErrors.password}</span>
        {/if}
      </div>
      
      <!-- Role Field -->
      <div class="form-field">
        <label for="role" class="form-label">Role</label>
        <select
          id="role"
          class="form-select"
          class:error={formErrors.role}
          bind:value={formData.role}
        >
          <option value="ADMIN">Admin</option>
          <option value="STAFF">Staff</option>
          <option value="CLIENT_USER">Client User</option>
        </select>
        {#if formErrors.role}
          <span class="form-error">{formErrors.role}</span>
        {/if}
      </div>
      
      <!-- Client Field (only for CLIENT_USER role) -->
      {#if formData.role === 'CLIENT_USER'}
        <div class="form-field">
          <label for="clientId" class="form-label">Client</label>
          <select
            id="clientId"
            class="form-select"
            class:error={formErrors.clientId}
            bind:value={formData.clientId}
          >
            <option value="">Select a client</option>
            {#each $clientStore as client}
              <option value={client.id}>{client.name}</option>
            {/each}
          </select>
          {#if formErrors.clientId}
            <span class="form-error">{formErrors.clientId}</span>
          {/if}
        </div>
      {/if}
      
      <!-- Active Toggle (only when editing) -->
      {#if isEditMode}
        <div class="form-field">
          <label class="flex items-center gap-2">
            <input 
              type="checkbox" 
              class="form-checkbox"
              bind:checked={formData.active}
            />
            <span>User is active</span>
          </label>
          <span class="text-sm text-gray-600">Inactive users cannot log in</span>
        </div>
      {/if}
    </form>
  </div>

  {#snippet footer()}
    <div slot="footer" class="flex justify-end gap-3">
      <button 
        class="btn btn-secondary"
        onclick={() => showUserModal = false}
      >
        Cancel
      </button>
      <button 
        class="btn btn-primary"
        onclick={handleSaveUser}
      >
        {isEditMode ? 'Update User' : 'Create User'}
      </button>
    </div>
  {/snippet}
</Modal>