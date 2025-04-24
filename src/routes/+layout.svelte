<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
</script>

<div class="min-h-screen bg-gray-100">
  <header class="bg-blue-600 text-white p-4 shadow-md">
    <div class="container mx-auto">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold">TimeVault</h1>
        <nav>
          <ul class="flex space-x-6">
            <li>
              <a 
                href="/" 
                class="hover:text-blue-200 transition-colors {$page.url.pathname === '/' ? 'font-bold underline' : ''}"
              >
                Time Entries
              </a>
            </li>
            <li>
              <a 
                href="/clients" 
                class="hover:text-blue-200 transition-colors {$page.url.pathname === '/clients' ? 'font-bold underline' : ''}"
              >
                Clients
              </a>
            </li>
            <li>
              <a 
                href="/invoices" 
                class="hover:text-blue-200 transition-colors {$page.url.pathname === '/invoices' ? 'font-bold underline' : ''}"
              >
                Invoices
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </header>

  <main class="container mx-auto py-6 px-4">
    <slot />
  </main>

  <footer class="bg-gray-800 text-white p-4 mt-auto">
    <div class="container mx-auto text-center">
      <p>TimeVault &copy; {new Date().getFullYear()} - Time Management System</p>
    </div>
  </footer>
</div>