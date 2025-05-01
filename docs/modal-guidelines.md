# Modal Component Guidelines for TimeVault

## Related Documentation
- [Svelte 5 Guidelines](./svelte5-guidelines.md) - Development guidelines for Svelte 5
- [Tailwind v4 Guidelines](./tailwind-v4-guidelines.md) - Styling guidelines

## Overview

The Modal component is a core UI element in TimeVault that provides a consistent way to display dialogs, forms, and confirmations.

## Basic Usage

```svelte
<Modal
  open={showModal}
  title="Modal Title"
  size="lg"
  onclose={() => (showModal = false)}
>
  <div class="p-6">
    <!-- Modal content goes here -->
  </div>

  {#snippet footer()}
    <div slot="footer" class="flex justify-end gap-3">
      <button class="btn btn-secondary" onclick={() => (showModal = false)}>
        Cancel
      </button>
      <button class="btn btn-primary" onclick={handleAction}>
        Confirm
      </button>
    </div>
  {/snippet}
</Modal>
```

## Props

| Prop | Type | Description | Required |
|------|------|-------------|----------|
| open | boolean | Controls modal visibility | Yes |
| title | string | Modal header text | Yes |
| size | "sm" \| "md" \| "lg" \| "xl" | Modal width | Yes |
| onclose | () => void | Close handler function | Yes |

## Button Styles

- `btn-secondary`: Use for Cancel/Close actions
- `btn-primary`: Use for main/confirm actions
- `btn-danger`: Use for destructive actions

## Content Structure

1. Main content wrapper:
```svelte
<div class="p-6">
  <!-- Content here -->
</div>
```

2. Text hierarchy:
- Main text: `class="text-gray-900"`
- Supporting text: `class="text-sm text-gray-600"`
- Warning messages: `class="rounded bg-amber-100 p-3 text-amber-800"`

## Best Practices

1. Always include a cancel/close button
2. Use clear, action-oriented button labels
3. Provide feedback for destructive actions
4. Handle loading states with disabled buttons
5. Include appropriate spacing in content area
6. Use semantic colors for different types of actions

## Loading State Example

```svelte
<Modal
  open={showDialog}
  title="Save Changes"
  size="lg"
  onclose={() => !isLoading && (showDialog = false)}
>
  <div class="p-6">
    <p class="mb-4 text-gray-900">
      Are you sure you want to save these changes?
    </p>
  </div>

  {#snippet footer()}
    <div slot="footer" class="flex justify-end gap-3">
      <button 
        class="btn btn-secondary" 
        onclick={() => (showDialog = false)}
        disabled={isLoading}
      >
        Cancel
      </button>
      <button 
        class="btn btn-primary {isLoading ? 'loading' : ''}" 
        onclick={handleSave}
        disabled={isLoading}
      >
        {isLoading ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  {/snippet}
</Modal>
```

## Warning/Destructive Action Example

```svelte
<Modal
  open={showDeleteDialog}
  title="Delete Item"
  size="md"
  onclose={() => (showDeleteDialog = false)}
>
  <div class="p-6">
    <p class="mb-4 text-gray-900">
      Are you sure you want to delete this item?
    </p>
    <p class="rounded bg-amber-100 p-3 text-amber-800">
      This action cannot be undone.
    </p>
  </div>

  {#snippet footer()}
    <div slot="footer" class="flex justify-end gap-3">
      <button class="btn btn-secondary" onclick={() => (showDeleteDialog = false)}>
        Cancel
      </button>
      <button class="btn btn-danger" onclick={handleDelete}>
        Delete Item
      </button>
    </div>
  {/snippet}
</Modal>
```