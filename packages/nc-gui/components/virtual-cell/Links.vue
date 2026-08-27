<script setup lang="ts">
import { computed } from '@vue/reactivity'
import type { ColumnType } from 'nocodb-sdk'
import { getLinkPreviewKey } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { forcedNextTick } from '../../utils/browserUtils'

const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const clientMousePosition = inject(ClientMousePositionInj, reactive(clientMousePositionDefaultValue))

const value = inject(CellValueInj, ref(0))

const column = inject(ColumnInj)!

const row = inject(RowInj)!

const reloadRowTrigger = inject(ReloadRowDataHookInj, createEventHook())

const isForm = inject(IsFormInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const rowHeight = inject(RowHeightInj, ref())

const canvasCellEventData = inject(CanvasCellEventDataInj, reactive<CanvasCellEventDataInjType>({}))

const cellEventHook = inject(CellEventHookInj, null)

const colTitle = computed(() => column.value?.title || '')

const listItemsDlg = ref(false)

const childListDlg = ref(false)

const isOpen = ref(false)

const hideBackBtn = ref(false)

const { isUIAllowed } = useRoles()

const { t } = useI18n()

const { state, isNew } = useSmartsheetRowStoreOrThrow()

const { relatedTableMeta, loadRelatedTableMeta, relatedTableDisplayValueProp } = useProvideLTARStore(
  column as Ref<Required<ColumnType>>,
  row,
  isNew,
  reloadRowTrigger.trigger,
)
const relatedTableDisplayColumn = computed(
  () =>
    relatedTableMeta.value?.columns?.find((c: any) => c.title === relatedTableDisplayValueProp.value) as ColumnType | undefined,
)

loadRelatedTableMeta()

/**
 * A Links cell value is only a count. The linked records themselves arrive alongside
 * it under `_nc_lk_<title>` when the list request opts into a link preview, which lets
 * us show the values rather than just how many there are.
 *
 * Empty whenever no preview was fetched (form view, unsaved row, older cached data),
 * in which case the cell falls back to the count text.
 */
const linkPreview = computed<Record<string, any>[] | null>(() => {
  if (isForm.value || isNew.value || !relatedTableDisplayValueProp.value) return null

  const preview = row.value?.row?.[getLinkPreviewKey(colTitle.value)]

  if (ncIsArray(preview)) return preview

  // The reverse side of a one-to-one resolves to a single record
  return ncIsObject(preview) ? [preview] : null
})

const previewCells = computed<{ value: any; item: Record<string, any> }[]>(() =>
  (linkPreview.value ?? []).reduce((acc, item) => {
    if (!ncIsObject(item)) return acc

    acc.push({ value: item[relatedTableDisplayValueProp.value], item })

    return acc
  }, [] as { value: any; item: Record<string, any> }[]),
)

const hasEditPermission = computed(() => {
  return (!readOnly.value && isUIAllowed('dataEdit') && !isUnderLookup.value) || isForm.value
})

const textVal = computed(() => {
  if (isForm.value || isNew.value) {
    return state.value?.[colTitle.value]?.length
      ? `${+state.value?.[colTitle.value]?.length} ${t('msg.recordsLinked')}`
      : isForm.value && !isExpandedFormOpen.value
      ? t('title.linkRecords')
      : t('msg.noRecordsLinked')
  }

  const parsedValue = +value?.value || 0

  if (!parsedValue) {
    return t('msg.noRecordsLinked')
  } else if (parsedValue === 1) {
    return `1 ${column.value?.meta?.singular || t('general.link')}`
  } else {
    return `${parsedValue} ${column.value?.meta?.plural || t('general.links')}`
  }
})

const toatlRecordsLinked = computed(() => {
  if (isForm?.value) {
    return state.value?.[colTitle.value]?.length
  }
  return +value?.value || 0
})

const onAttachRecord = () => {
  childListDlg.value = false
  listItemsDlg.value = true
  hideBackBtn.value = false
}

const onAttachLinkedRecord = () => {
  listItemsDlg.value = false
  childListDlg.value = true
}

const openChildList = () => {
  if (isUnderLookup.value) return

  childListDlg.value = true
  listItemsDlg.value = false

  isOpen.value = true
  hideBackBtn.value = false
}

useSelectedCellKeydownListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      if (listItemsDlg.value) return
      childListDlg.value = true
      isOpen.value = true
      e.stopPropagation()
      break
  }
})

const localCellValue = computed<any[]>(() => {
  if (isNew.value) {
    return state?.value?.[column?.value.title as string] ?? []
  }
  return []
})

const openListDlg = () => {
  if (!hasEditPermission.value) return

  listItemsDlg.value = true
  childListDlg.value = false
  isOpen.value = true
  hideBackBtn.value = true
}

watch([childListDlg, listItemsDlg], () => {
  isOpen.value = childListDlg.value || listItemsDlg.value
})

watch(
  isOpen,
  (next) => {
    if (!next) {
      listItemsDlg.value = false
      childListDlg.value = false
    }
  },
  { flush: 'post' },
)

const onCellEvent = (event?: Event) => {
  if (!(event instanceof KeyboardEvent) || !event.target || isActiveInputElementExist(event)) return

  if (isExpandCellKey(event)) {
    if (childListDlg.value) {
      listItemsDlg.value = false
      childListDlg.value = false
    } else {
      openChildList()
    }

    return true
  }
}

onMounted(() => {
  cellEventHook?.on(onCellEvent)

  if (!isUnderLookup.value && isCanvasInjected && !isExpandedFormOpen.value && clientMousePosition) {
    forcedNextTick(() => {
      if (onCellEvent(canvasCellEventData.event)) return

      if (getElementAtMouse('.nc-canvas-table-editable-cell-wrapper .nc-canvas-links-icon-plus', clientMousePosition)) {
        openListDlg()
      } else if (
        getElementAtMouse('.nc-canvas-table-editable-cell-wrapper .nc-canvas-links-text', clientMousePosition) ||
        getElementAtMouse('.nc-canvas-table-editable-cell-wrapper .nc-canvas-links-maximize-icon', clientMousePosition)
      ) {
        openChildList()
      } else if (hasEditPermission.value) {
        openListDlg()
      } else {
        openChildList()
      }
    })
  }
})

onUnmounted(() => {
  cellEventHook?.off(onCellEvent)
})
</script>

<template>
  <div class="nc-cell-field flex w-full group items-center nc-links-wrapper py-1" @dblclick.stop="openChildList">
    <VirtualCellComponentsLinkRecordDropdown v-model:is-open="isOpen">
      <div v-if="linkPreview" class="flex items-center gap-1 w-full chips-wrapper min-h-4 relative">
        <div
          class="chips flex items-center flex-1 min-w-0 overflow-x-hidden overflow-y-auto"
          :class="{ 'flex-wrap': rowHeight !== 1 }"
          :style="{ maxHeight: `${rowHeightInPx[rowHeight ?? 1]}px` }"
        >
          <VirtualCellComponentsItemChip
            v-for="(cell, i) of previewCells"
            :key="i"
            :item="cell.item"
            :value="cell.value"
            :column="relatedTableDisplayColumn"
            :show-unlink-button="false"
          />
        </div>

        <div
          v-if="!isUnderLookup"
          class="flex justify-end gap-[2px] min-h-4 items-center absolute right-0 top-0 bottom-0 links-actions"
          :class="{ active: isOpen }"
          @click.stop
        >
          <!-- `nc-action-icon nc-plus` must stay together on the clickable element:
               that pair is how BelongsTo/OneToOne mark their add button too, and it is
               the shared selector for in-cell add. -->
          <NcButton
            v-if="hasEditPermission"
            size="xsmall"
            type="secondary"
            class="nc-action-icon nc-plus nc-canvas-links-icon-plus"
            @click.stop="openListDlg"
          >
            <GeneralIcon icon="plus" class="text-sm" />
          </NcButton>
          <NcTooltip :title="$t('tooltip.expandShiftSpace')" :disabled="isExpandedFormOpen" class="flex">
            <NcButton
              size="xsmall"
              type="secondary"
              class="nc-action-icon nc-canvas-links-maximize-icon"
              @click.stop="openChildList"
            >
              <GeneralIcon icon="maximize" />
            </NcButton>
          </NcTooltip>
        </div>
      </div>

      <div v-else class="flex w-full group items-center min-h-4">
        <div class="block flex-shrink truncate">
          <component
            :is="isUnderLookup ? 'span' : 'a'"
            v-e="['c:cell:links:modal:open']"
            :title="textVal"
            class="text-center nc-datatype-link underline-transparent nc-canvas-links-text font-weight-500"
            :class="{ '!text-gray-300': !textVal }"
            :tabindex="readOnly ? -1 : 0"
            @click.stop.prevent="isForm && !isExpandedFormOpen ? openListDlg() : openChildList()"
            @keydown.enter.stop.prevent="isForm && !isExpandedFormOpen ? openListDlg() : openChildList"
          >
            {{ textVal }}
          </component>
        </div>
        <div class="flex-grow" />

        <div
          v-if="hasEditPermission"
          :class="{ hidden: isUnderLookup }"
          :tabindex="readOnly ? -1 : 0"
          class="flex group justify-end group-hover:flex items-center nc-canvas-links-icon-plus"
          @keydown.enter.stop="openListDlg"
        >
          <MdiPlus
            class="select-none !text-md text-gray-700 nc-action-icon nc-plus !xs:visible invisible group-hover:visible group-focus:visible"
            @click.stop="openListDlg"
          />
        </div>
      </div>

      <template #overlay>
        <VirtualCellComponentsLinkedItems
          v-if="childListDlg"
          v-model="childListDlg"
          :items="toatlRecordsLinked"
          :column="relatedTableDisplayColumn"
          :cell-value="localCellValue"
          @attach-record="onAttachRecord"
          @escape="isOpen = false"
        />
        <VirtualCellComponentsUnLinkedItems
          v-if="listItemsDlg"
          v-model="listItemsDlg"
          :column="relatedTableDisplayColumn"
          :hide-back-btn="hideBackBtn"
          @attach-linked-record="onAttachLinkedRecord"
          @escape="isOpen = false"
        />
      </template>
    </VirtualCellComponentsLinkRecordDropdown>
  </div>
</template>

<style scoped>
.links-actions {
  @apply hidden;
}

.links-actions.active,
.chips-wrapper:hover .links-actions {
  @apply flex;
}
</style>

<style lang="scss">
.nc-default-value-wrapper,
.nc-expanded-cell,
.ant-form-item-control-input {
  .links-actions {
    @apply !flex;
  }
}
</style>
