<script setup lang="ts">
import { isSystemColumn } from 'nocodb-sdk'

const { isMobileMode } = useGlobal()

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const meta = inject(MetaInj, ref())

const { is12hrFormat } = useTimeFormatPreference()

const is24hrFormat = computed({
  get: () => !is12hrFormat.value,
  set: (value: boolean) => {
    is12hrFormat.value = !value
  },
})

// Only shown when the table has at least one user-facing time or datetime field.
// Built-in system timestamps (CreatedAt/UpdatedAt) are always present, so they are ignored.
const hasTimeColumn = computed(() =>
  (meta.value?.columns ?? []).some((col) => isTimeOrDateTimeUidt(col.uidt) && !isSystemColumn(col)),
)

const toggle = () => {
  is24hrFormat.value = !is24hrFormat.value
}
</script>

<template>
  <NcTooltip v-if="hasTimeColumn" placement="bottom">
    <template #title>
      <div>{{ $t('labels.time24HourFormat') }}</div>
      <div class="text-xs opacity-80">{{ $t('tooltip.timeFormatLocalOnly') }}</div>
    </template>
    <!-- The whole pill is a click target; the switch itself is the focusable, accessible control.
         Not an NcButton because a-switch renders a <button>, and buttons cannot be nested. -->
    <div
      v-e="['c:time-format:toggle']"
      class="nc-time-format-toggle nc-toolbar-btn flex items-center gap-2 h-7 cursor-pointer select-none"
      data-testid="nc-time-format-toggle"
      @click="toggle"
    >
      <GeneralIcon icon="ncClock" class="!h-4 !w-4 flex-none" />
      <span v-if="!isMobileMode && !isToolbarIconMode" class="!text-[13px] font-medium whitespace-nowrap">
        {{ $t('labels.time24HourShort') }}
      </span>
      <span class="flex items-center" @click.stop>
        <NcSwitch v-model:checked="is24hrFormat" size="xsmall" :aria-label="$t('labels.time24HourFormat')" />
      </span>
    </div>
  </NcTooltip>
</template>
