<script>
  import "../app.css";
  import { page } from "$app/stores";
  
  const navItems = [
    { href: "/", label: "Home" },
    { href: "/clients", label: "Clients" },
    { href: "/tickets", label: "Tickets" },
    { href: "/invoices", label: "Invoices" }
  ];
</script>

<div class="min-h-screen flex flex-col bg-default text-default">
  <header class="container-glass sticky top-0 z-10 border-b border-gray-600">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <a href="/" class="flex items-center space-x-2">
          <span class="text-2xl font-bold text-accentBlue">TimeVault</span>
        </a>
        
        <!-- Navigation -->
        <nav>
          <ul class="flex space-x-6">
            {#each navItems as item}
              <li>
                <a 
                  href={item.href} 
                  class="text-text-blue-300 hover:text-accentBlue transition-colors {$page.url.pathname === item.href ? 'text-accentPink font-medium' : ''}"
                >
                  {item.label}
                </a>
              </li>
            {/each}
          </ul>
        </nav>
      </div>
    </div>
  </header>

  <main class="flex-grow py-8">
    <slot />
  </main>
  
  <footer class="container-glass border-t border-gray-600">
    <div class="container mx-auto px-4 py-6">
      <div class="flex justify-between items-center">
        <p>© {new Date().getFullYear()} TimeVault</p>
        <p>Version 1.0</p>
      </div>
    </div>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: var(--font-sans);
    background-color: rgba(240, 245, 250, 1);
    background-image: url('/backgrounds/bg-light-4.jpg');
    background-size: cover;
    background-attachment: fixed;
    min-height: 100vh;
  }
  
  :global(.text-accentBlue) {
    color: var(--color-accentBlue);
  }
  
  :global(.text-accentPink) {
    color: var(--color-accentPink);
  }
</style>