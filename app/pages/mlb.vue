<script setup lang="ts">
useHead({
	title: "MLB 球場マップ | My Map",
});
</script>

<template>
  <div class="relative">
    <MlbMapView />
    <NuxtLink
      class="absolute bottom-4 left-4 rounded-lg bg-white/90 px-3 py-1.5 text-sm shadow-md hover:bg-white"
      to="/"
    >
      ← 日本の地図
    </NuxtLink>
  </div>
</template>
