<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'

const { activeTable } = storeToRefs(useTablesStore())

const { activeView } = storeToRefs(useViewsStore())

const { isUIAllowed, isDataReadOnly } = useRoles()

const isPublicView = inject(IsPublicInj, ref(false))

const { isMobileMode } = useGlobal()

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const { showRecordPlanLimitExceededModal } = useEeConfig()

const isImportDlgOpen = ref(false)

const isUploadAllowed = computed(() => {
  return (
    isUIAllowed('csvTableImport') &&
    !isPublicView.value &&
    !isDataReadOnly.value &&
    activeTable.value?.type !== 'view' && // isSqlView
    !activeTable.value?.synced &&
    activeView.value?.type !== ViewTypes.FORM &&
    !!activeTable.value?.base_id &&
    !!activeTable.value?.source_id
  )
})

const onUploadClick = () => {
  if (showRecordPlanLimitExceededModal()) return

  isImportDlgOpen.value = true
}
</script>

<template>
  <template v-if="isUploadAllowed">
    <NcTooltip :disabled="!isMobileMode && !isToolbarIconMode">
      <template #title>
        {{ $t('general.upload') }}
      </template>
      <NcButton
        v-e="['c:toolbar:upload-csv']"
        class="nc-upload-data-btn nc-toolbar-btn !border-0 !h-7"
        size="small"
        type="secondary"
        @click="onUploadClick"
      >
        <div class="flex items-center gap-2 min-h-5">
          <GeneralIcon icon="upload" class="h-4 w-4" />

          <!-- Upload -->
          <span v-if="!isMobileMode && !isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">{{
            $t('general.upload')
          }}</span>
        </div>
      </NcButton>
    </NcTooltip>

    <LazyDlgQuickImport
      v-model="isImportDlgOpen"
      :import-data-only="true"
      import-type="csv"
      :base-id="activeTable!.base_id"
      :source-id="activeTable!.source_id"
    />
  </template>
</template>
