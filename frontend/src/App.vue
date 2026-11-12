<script setup lang="ts">
import { useWorkspaceState } from '~/logic/workspace-state'

const { preferences } = useWorkspaceState()
</script>

<template>
  <div id="app" :data-theme="preferences.theme" class="fixed inset-0 flex flex-col overflow-auto bg-canvas font-ui text-primary">
    <RouterView />
    <UiToastRegion />
  </div>
</template>
