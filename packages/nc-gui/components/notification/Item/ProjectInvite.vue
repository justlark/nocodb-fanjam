<script setup lang="ts">
import type { ProjectInviteEventType } from 'nocodb-sdk'

const props = defineProps<{
  item: ProjectInviteEventType
}>()

const { navigateToProject } = useGlobal()

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper :item="item" @click="navigateToProject({ baseId: item.body.base.id })">
    <div>
      <span class="font-semibold">{{ item.body.user.display_name ?? item.body.user.email }}</span> has invited you to
      <span class="font-semibold">{{ item.body.base.title }}</span
      >.
    </div>
  </NotificationItemWrapper>
</template>
