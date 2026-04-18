<script setup lang="ts">
const { $state, $api } = useNuxtApp()

const baseURL = $api.instance.defaults.baseURL

const baseStore = useBase()
const basesStore = useBases()
const { base } = storeToRefs(baseStore)

const _projectId = inject(ProjectIdInj, undefined)

const baseId = computed(() => _projectId?.value ?? base.value?.id)

const migrateConfiguration = ref<{
  migrationUrl?: string
}>({
  migrationUrl: undefined,
})

const migrating = ref(false)

async function migrateData() {
  migrating.value = true
  try {
    const res = await $fetch(`/api/v2/meta/migrate/${baseId.value}`, {
      baseURL,
      method: 'POST',
      headers: { 'xc-auth': $state.token.value as string },
      body: migrateConfiguration.value,
    })

    if (res?.msg) {
      message.info(res.msg)
    }
  } catch (e) {
    message.error(e.message)
  } finally {
    migrating.value = false
  }
}

onMounted(async () => {
  await basesStore.loadProject(baseId.value!, true)
})
</script>

<template>
  <div />
</template>
