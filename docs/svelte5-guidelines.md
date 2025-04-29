# Svelte 5 Development Guidelines for TimeVault

## Table of Contents
- [Introduction](#introduction)
- [Svelte 5 Core Concepts](#svelte-5-core-concepts)
- [Coding Patterns](#coding-patterns)
- [Component Guidelines](#component-guidelines)
- [Best Practices](#best-practices)
- [Common Issues and Solutions](#common-issues-and-solutions)
- [Related Documentation](#related-documentation)

## Introduction

This document provides guidelines for developing with Svelte 5 in the TimeVault project. It covers best practices, component usage, and common issues to avoid.

## Svelte 5 Core Concepts

### Runes and Reactivity

Svelte 5 introduces runes, a new reactivity model that replaces the older compilation-based reactivity:

```svelte
<script lang="ts">
  // State management with runes
  let counter = $state(0);
  let name = $state('');
  
  // Derived values
  const doubleCount = $derived(counter * 2);
  
  // Reactive effects
  $effect(() => {
    console.log(`Count changed to ${counter}`);
  });
  
  // Props using runes syntax
  const props = $props<{
    title: string;
    description?: string;
  }>();
</script>
```

### State Management

- Use `$state()` for reactive variables that change over time
- Use `$derived()` for computed values that depend on other state
- Use `$effect()` for side effects that run when dependencies change
- Use `$props()` for component props in runes mode

**Important**: `$state()` can ONLY be used:
1. As a variable declaration initializer: `let x = $state(value)`
2. As a class field: `class X { y = $state(value) }`
3. NEVER inside object destructuring or other expressions

## Coding Patterns

### Class Handling

Use string interpolation for conditional classes:

```svelte
<div class="base-class {condition ? 'active' : ''} {anotherCondition ? 'highlight' : ''}">
```

### Event Handling

Always use Svelte 5 event handling syntax:

```svelte
<button onclick={handleClick}>Click me</button>
<input oninput={handleInput} />
<form onsubmit={handleSubmit}>
```

For form submissions, always use preventDefault in the handler function:

```svelte
function handleSubmit(event: SubmitEvent) {
  event.preventDefault();
  // Form handling logic here
}
```

### Content Rendering

You CANNOT use both `<slot>` elements and `{@render ...}` tags in the same component.

#### Option 1: Using {@render ...} tags (Recommended)

```svelte
<!-- Component definition -->
<script lang="ts">
  const props = $props<{
    content: () => any;
    tabs?: Record<string, () => any>;
  }>();
</script>

<div>
  {@render props.content()}
  
  {#if props.tabs}
    {#each Object.entries(props.tabs) as [id, renderFn]}
      {@render renderFn()}
    {/each}
  {/if}
</div>
```

#### Option 2: Using slots (Traditional)

```svelte
<!-- Component definition -->
<script lang="ts">
  // Props here
</script>

<div>
  <slot />
  
  <div>
    <slot name="footer" />
  </div>
</div>
```

### Bindings

Use Svelte 5 bind: syntax for two-way bindings:

```svelte
<input bind:value={searchQuery} />
<select bind:value={selectedOption} />
```

## Component Guidelines

### TabView Component

Pass tab content and icons as functions that return renderable content. Always use function calls with `{@render}` tags:

```svelte
<!-- Usage -->
<TabView 
  tabs={[
    { 
      id: 'tab1', 
      title: 'Tab 1',
      icon: () => InformationCircle({ class: 'h-4 w-4' })
    },
    { 
      id: 'tab2', 
      title: 'Tab 2',
      icon: () => Clock({ class: 'h-4 w-4' })
    }
  ]}
  tabContent={{
    tab1: () => {
      return {
        component: GlassCard,
        props: {
          class: "p-6"
        },
        content: `
          <div>
            <p>Tab 1 content</p>
            <button class="btn btn-primary">Action</button>
          </div>
        `,
        handlers: {
          onMount: (element) => {
            const btn = element.querySelector('button');
            if (btn) {
              btn.addEventListener('click', handleClick);
              return () => btn.removeEventListener('click', handleClick);
            }
          }
        }
      };
    },
    tab2: () => {
      return {
        component: GlassCard,
        props: {
          class: "p-6"
        },
        content: `
          <div>Tab 2 content</div>
        `
      };
    }
  }}
/>
```

**Important Notes**:
1. Icon props must be functions that return a component call: `icon: () => Component()`
2. Tab content functions should return an object with:
   - `component`: The component to render (e.g., GlassCard)
   - `props`: Properties to pass to the component
   - `content`: HTML content as a string
   - `handlers`: Optional event handlers with cleanup functions
3. Use `{@render component()}` for dynamic components
4. Always wrap HTML content in container elements
5. Use data attributes for event delegation when needed

### ClientSearch Component

**Props:**
- `selectedClientId?: string | null` - Currently selected client ID
- `label?: string` - Label text (default: 'Client')
- `placeholder?: string` - Placeholder text (default: 'Select a client')
- `showSearch?: boolean` - Show search input (default: true)
- `showIcon?: boolean` - Show client icon (default: true)
- `className?: string` - Additional classes for container
- `fieldClassName?: string` - Additional classes for field wrapper
- `hint?: string` - Custom hint text
- `restrictToClientId?: string | null` - Restrict to specific client hierarchy
- `allowNullSelection?: boolean` - Allow no selection (default: true)

### GlassCard Component

- Use for creating glass-morphism effects in the UI
- Configurable padding and class name props

```svelte
<GlassCard className="p-6">
  <h2>Card Title</h2>
  <p>Card content</p>
</GlassCard>
```

### Modal Component

- Features: ESC key closes, overlay click closes, ARIA attributes
- Props: `open` (boolean), `title` (string), `width` (string)
- Events: `on:close`

## Best Practices

1. **Prefer local state**: Keep state local to components when possible
2. **Minimize store usage**: Only use stores for truly global state
3. **Validate props**: Use TypeScript and PropTypes to validate props
4. **Error boundaries**: Implement error boundaries for robust UIs
5. **Conditional rendering**: Use `{#if}` blocks for conditional rendering
6. **List rendering**: Use `{#each}` blocks with proper key attributes
7. **Component composition**: Break down complex UIs into smaller components
8. **Use $derived for expensive computations**: Cache expensive operations

## Common Issues and Solutions

### JSX Fragment Issue

**Problem**: Error `Type parameter list cannot be empty` when using React-style fragments.

```svelte
// This causes errors in Svelte 5
tabContent: {
  tab1: () => <>
    <div>Content</div>
  </>
}
```

**Solution**: Always wrap content in a container element instead of using empty fragments:

```svelte
// Correct approach
tabContent: {
  tab1: () => {
    return (
      <div>
        <div>Content</div>
      </div>
    );
  }
}
```

### Reactive Variable Updates

**Problem**: Updates to reactive variables not triggering reactivity.

**Solution**: Ensure you're using runes correctly for state management:

```svelte
// Incorrect
let counter; // Missing $state
counter = 0;

// Correct
let counter = $state(0);
```

## Related Documentation

- [Tailwind V4 Guidelines](./tailwind-v4-guidelines.md) - Styling guidelines for the TimeVault project
- [SvelteKit Documentation](https://kit.svelte.dev/docs) - Official SvelteKit documentation
- [Svelte 5 Documentation](https://svelte-5-preview.vercel.app/) - Official Svelte 5 documentation