<script lang="ts">
  export let padding = 'p-6';
  export let className = '';
</script>

<div class="container-glass {padding} {className}">
  <slot />
</div>