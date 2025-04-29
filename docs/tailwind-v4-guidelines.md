# Tailwind v4 Styling Guidelines for TimeVault

## Related Documentation
- [Svelte 5 Guidelines](./svelte5-guidelines.md) - Development guidelines for Svelte 5 in the TimeVault project

## Key Changes in Tailwind v4

- **@apply directive removed**: Tailwind v4 no longer supports the `@apply` directive that was used in previous versions
- **Direct CSS properties**: Use standard CSS properties instead of `@apply` for custom component styles
- **Utility classes preferred**: Favor direct utility classes in HTML when possible

## Style Organization

### File Structure
1. Global styles: `/src/lib/styles/tailwind-theme.css`
2. Component styles: `/src/lib/styles/components/{component-name}.css`

### Import Pattern
Component styles must be imported in `tailwind-theme.css`:
```css
/* Import component styles */
@import './components/client-search.css';
@import './components/status-badge.css';
```

## Component Styling Best Practices

### Preferred Approach: Utility Classes
Use Tailwind utility classes directly in components whenever possible:

```svelte
<div class="flex items-center gap-2 p-4 bg-gray-800/80 rounded-lg">
  <!-- Component content -->
</div>
```

### Custom CSS Classes (When Needed)
When creating reusable components that need consistent styling:

1. Create a component-specific CSS file in `/src/lib/styles/components/`
2. Use `@layer components` to define your classes
3. Use standard CSS properties (NOT `@apply`)

**BAD (pre-Tailwind v4):**
```css
@layer components {
  .custom-component {
    @apply flex gap-2 p-4 bg-gray-800/80 rounded-lg;
  }
}
```

**GOOD (Tailwind v4 compatible):**
```css
@layer components {
  .custom-component {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    background-color: rgba(31, 41, 55, 0.8);
    border-radius: 0.5rem;
  }
}
```

## Available Base Classes

TimeVault provides these reusable base classes:

| Class | Purpose |
|-------|---------|
| `container-glass` | Base glass morphism effect |
| `light-glass` | Lighter variant of glass effect |
| `card-glass` | Pre-configured card with glass styling |
| `status-badge` | Base styling for status badges |

## Common CSS Components 

### Form Elements
Use the consistent form classes:
- `form-group`, `form-field`
- `form-input`, `form-select`, `form-textarea`
- `form-label`, `form-hint`, `form-error`

### Tables
Use the consistent table classes:
- `data-table`: Base table
- `data-table-header`: Header row 
- `data-table-row`: Body row with hover effect
- `data-table-footer`: Footer row

### Buttons
- `btn`, `btn-sm`
- `btn-primary`, `btn-secondary`, `btn-danger`
- Table variants: `table-action-button`, etc.

## Theme Variables

The theme uses CSS custom properties (variables) for consistent styling:

```css
/* Example of how to use theme variables */
.my-component {
  background-color: var(--color-container-glass);
  color: var(--color-text-default);
  border: 1px solid var(--color-border);
}
```

## Browser Support

- The CSS in this project uses modern features like:
  - `oklch()` color format
  - CSS custom properties (variables)
  - `backdrop-filter`

Ensure your browser support requirements align with these features.