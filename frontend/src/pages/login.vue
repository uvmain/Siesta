<script setup lang="ts">
import { api } from '~/logic/api'

const router = useRouter()
const username = ref('')
const password = ref('')
const loginError = ref('')

async function checkSession(): Promise<void> {
  if (await api.hasSession()) {
    await router.replace('/')
  }
}

async function login(): Promise<void> {
  loginError.value = ''
  try {
    await api.login(username.value, password.value)
  }
  catch (error) {
    loginError.value = error instanceof Error ? error.message : 'Unable to sign in'
    return
  }
  await router.replace('/')
}

onMounted(checkSession)
</script>

<template>
  <main class="box-border grid min-h-full place-items-center p-4 sm:p-8">
    <form class="w-full max-w-[360px] rounded-xl border border-slate-300 bg-white p-8 shadow-[0_8px_30px_rgb(15_23_42_/_8%)]" @submit.prevent="login">
      <p class="mt-0 text-xs font-bold tracking-[.14em] text-indigo-600">
        siesta
      </p>
      <h1 class="mt-0">
        Sign in
      </h1>
      <p class="mt-0 text-slate-500">
        Use the credentials configured for this siesta instance.
      </p>
      <label class="mt-4 grid gap-2 font-semibold text-slate-700">
        Username
        <input v-model="username" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" autocomplete="username" required>
      </label>
      <label class="mt-4 grid gap-2 font-semibold text-slate-700">
        Password
        <input v-model="password" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" type="password" autocomplete="current-password" required>
      </label>
      <p v-if="loginError" class="mt-0 text-red-700">
        {{ loginError }}
      </p>
      <button class="mt-4 cursor-pointer rounded-md border border-indigo-600 bg-indigo-600 px-3 py-2.5 font-bold text-white" type="submit">
        Sign in
      </button>
    </form>
  </main>
</template>
