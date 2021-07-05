<h1>Hello from Svelte! {count}</h1>

<Inner />

<script>
   import Inner from './Inner.svelte';

   export let count;
</script>

<style>
	h1 {
		color: red;
	}
</style>
