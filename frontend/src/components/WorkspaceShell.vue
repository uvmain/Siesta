<script setup lang="ts">
import type { Environment } from '~/logic/api'
import { useWorkspaceState } from '~/logic/workspace-state'

const props = defineProps<{
  environments: Environment[]
  environmentId?: number
}>()

const emit = defineEmits<{
  'update:environmentId': [id: number | undefined]
  'newRequest': []
  'logout': []
}>()

const { preferences, updatePreferences } = useWorkspaceState()
const resizing = ref(false)

const sidebarStyle = computed(() => preferences.value.sidebarCollapsed
  ? undefined
  : { width: `${preferences.value.sidebarWidth}px` })

function toggleSidebar(): void {
  updatePreferences({ sidebarCollapsed: !preferences.value.sidebarCollapsed })
}

function startResizing(event: PointerEvent): void {
  if (preferences.value.sidebarCollapsed) {
    return
  }
  resizing.value = true
  event.currentTarget instanceof HTMLElement && event.currentTarget.setPointerCapture(event.pointerId)
}

function resizeSidebar(event: PointerEvent): void {
  if (!resizing.value) {
    return
  }
  updatePreferences({ sidebarWidth: Math.min(440, Math.max(220, event.clientX)) })
}

function stopResizing(): void {
  resizing.value = false
}

function selectProfileAction(id: string): void {
  if (id === 'theme') {
    updatePreferences({ theme: preferences.value.theme === 'dark' ? 'light' : 'dark' })
  }
  if (id === 'logout') {
    emit('logout')
  }
}
</script>

<template>
  <div class="grid h-full min-h-0 grid-rows-[auto_1fr] bg-canvas">
    <header class="flex min-w-0 items-center gap-3 border-b border-border bg-sidebar px-3 py-2">
      <UiIconButton :label="preferences.sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'" @click="toggleSidebar">
        <span aria-hidden="true">{{ preferences.sidebarCollapsed ? '☰' : '☷' }}</span>
      </UiIconButton>
      <div class="flex shrink-0 items-center gap-2">
        <span class="grid size-7 place-items-center rounded-md bg-accent text-sm font-bold text-white" aria-hidden="true">S</span>
        <span class="hidden text-sm font-bold tracking-wide sm:inline">Siesta</span>
      </div>
      <select class="ui-control hidden min-w-36 lg:block" aria-label="Workspace">
        <option>Personal workspace</option>
      </select>
      <label class="relative min-w-0 flex-1">
        <span class="sr-only">Global search</span>
        <input class="ui-control box-border w-full pl-8" type="search" placeholder="Search requests, collections, and environments" aria-label="Global search">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" aria-hidden="true">⌕</span>
      </label>
      <label class="hidden min-w-40 md:block">
        <span class="sr-only">Active environment</span>
        <select
          class="ui-control box-border w-full"
          :value="props.environmentId"
          aria-label="Active environment"
          @change="emit('update:environmentId', ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : undefined)"
        >
          <option :value="undefined">No environment</option>
          <option v-for="environment in props.environments" :key="environment.id" :value="environment.id">
            {{ environment.name }}
          </option>
        </select>
      </label>
      <div class="hidden items-center gap-1 text-xs text-success sm:flex">
        <span class="size-2 rounded-full bg-success" aria-hidden="true" />
        Connected
      </div>
      <UiMenu label="Account" :items="[{ id: 'theme', label: preferences.theme === 'dark' ? 'Use light theme' : 'Use dark theme' }, { id: 'logout', label: 'Sign out', danger: true }]" @select="selectProfileAction">
        <template #trigger>
          <span class="inline-flex items-center gap-2">
            <span class="grid size-5 place-items-center rounded-full bg-elevated text-xs">U</span>
            <span class="hidden sm:inline">Account</span>
          </span>
        </template>
      </UiMenu>
    </header>

    <div class="flex min-h-0">
      <aside
        class="relative flex shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-150"
        :class="preferences.sidebarCollapsed ? 'w-12' : 'w-[280px]'"
        :style="sidebarStyle"
      >
        <div class="p-2">
          <UiButton v-if="!preferences.sidebarCollapsed" class="w-full" @click="emit('newRequest')">
            New request
          </UiButton>
          <UiIconButton v-else label="New request" class="mx-auto mt-1" @click="emit('newRequest')">
            <span aria-hidden="true">+</span>
          </UiIconButton>
        </div>
        <nav class="grid gap-1 px-2" aria-label="Workspace navigation">
          <button class="focus-ring flex items-center gap-3 rounded-md bg-elevated px-3 py-2 text-left text-sm font-semibold text-primary" type="button" aria-current="page">
            <span aria-hidden="true">▦</span><span v-if="!preferences.sidebarCollapsed">Collections</span>
          </button>
          <button v-for="item in ['History', 'Environments', 'APIs', 'Mock Servers', 'Monitors']" :key="item" class="focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-secondary hover:bg-elevated hover:text-primary" type="button">
            <span aria-hidden="true">•</span><span v-if="!preferences.sidebarCollapsed">{{ item }}</span>
          </button>
        </nav>
        <div v-if="!preferences.sidebarCollapsed" class="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          <slot name="sidebar" />
        </div>
        <div class="mt-auto border-t border-border p-2">
          <button class="focus-ring flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-secondary hover:bg-elevated hover:text-primary" type="button" @click="updatePreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })">
            <span aria-hidden="true">◐</span><span v-if="!preferences.sidebarCollapsed">{{ preferences.theme === 'dark' ? 'Light theme' : 'Dark theme' }}</span>
          </button>
        </div>
        <div
          v-if="!preferences.sidebarCollapsed"
          class="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize"
          :class="{ 'bg-accent/40': resizing }"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize navigation sidebar"
          @pointerdown="startResizing"
          @pointermove="resizeSidebar"
          @pointerup="stopResizing"
          @pointercancel="stopResizing"
        />
      </aside>
      <main class="min-w-0 flex-1 overflow-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
