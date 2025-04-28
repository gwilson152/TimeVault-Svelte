<script lang="ts">
  import { userStore } from '$lib/stores/userStore';
  import { goto } from '$app/navigation';
  
  // Form state
  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let error = $state('');

  // Handle form submission
  async function handleSubmit() {
    if (!email || !password) {
      error = 'Please enter both email and password';
      return;
    }

    isLoading = true;
    error = '';

    try {
      await userStore.login(email, password);
      goto('/'); // Redirect to home page after successful login
    } catch (e) {
      error = e instanceof Error ? e.message : 'Login failed';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    <div class="card-glass">
      <h1 class="text-2xl font-bold mb-6 text-center">TimeVault Login</h1>
      
      <form on:submit|preventDefault={handleSubmit} class="form-container">
        {#if error}
          <div class="bg-red-500/10 text-red-600 p-3 rounded-md text-sm">
            {error}
          </div>
        {/if}
        
        <div class="form-group">
          <label for="email" class="form-label">Email</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            class="form-input"
            placeholder="Enter your email"
            autocomplete="email"
            required
          />
        </div>

        <div class="form-group">
          <label for="password" class="form-label">Password</label>
          <input
            id="password"
            type="password"
            bind:value={password}
            class="form-input"
            placeholder="Enter your password"
            autocomplete="current-password"
            required
          />
        </div>

        <button
          type="submit"
          class="form-submit w-full mt-2"
          class:loading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  </div>
</div>