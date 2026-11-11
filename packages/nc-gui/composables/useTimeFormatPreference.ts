// useStorage must be imported explicitly: @vueuse/nuxt excludes it from auto-imports (clashes with Nitro's useStorage)
import { StorageSerializers, useStorage } from '@vueuse/core'
import { type ColumnType, UITypes } from 'nocodb-sdk'

const TIME_FORMAT_STORAGE_KEY = 'nc-time-format-is12hr'

let localeIs12hrCache: boolean | undefined

/**
 * Whether the browser's locale displays time using a 12-hour clock (e.g. en-US),
 * as opposed to a 24-hour clock (e.g. en-GB, de-DE).
 */
export const detectLocaleIs12hrFormat = (): boolean => {
  if (localeIs12hrCache !== undefined) return localeIs12hrCache

  try {
    const options = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions()
    localeIs12hrCache = options.hourCycle ? options.hourCycle === 'h11' || options.hourCycle === 'h12' : !!options.hour12
  } catch {
    localeIs12hrCache = false
  }

  return localeIs12hrCache
}

/**
 * Per-user, per-device preference for showing Time and DateTime values in 12hr vs 24hr format.
 * Saved only in this browser's localStorage, never sent to the server.
 * Until the user picks a value, it follows the browser locale.
 * It overrides the `is12hrFormat` option stored on each column's meta.
 */
export const useTimeFormatPreference = createGlobalState(() => {
  const stored = useStorage<boolean | null>(TIME_FORMAT_STORAGE_KEY, null, undefined, {
    serializer: StorageSerializers.object,
  })

  const is12hrFormat = computed<boolean>({
    get: () => (typeof stored.value === 'boolean' ? stored.value : detectLocaleIs12hrFormat()),
    set: (value) => {
      stored.value = value
    },
  })

  return { is12hrFormat }
})

const TIME_UIDTS = [UITypes.Time, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime] as string[]

/** Whether a column of this type shows a time of day (and so follows the 12hr/24hr preference). */
export const isTimeOrDateTimeUidt = (uidt?: string | null): boolean => !!uidt && TIME_UIDTS.includes(uidt)

/**
 * Reactive getter for the user's 12hr/24hr preference.
 * It can be called outside component setup, e.g. from canvas cell renderers.
 */
export const isUserTime12hrFormat = (): boolean => useTimeFormatPreference().is12hrFormat.value

/**
 * Returns the column with `meta.is12hrFormat` replaced by the user's local preference,
 * so code shared with the server (nocodb-sdk ColumnHelper) formats and parses time values
 * the same way they are shown in the UI. Other column types are returned as is.
 */
export const withUserTimeFormat = <T extends ColumnType | undefined | null>(column: T): T => {
  if (!column || !isTimeOrDateTimeUidt(column.uidt)) return column

  const is12hrFormat = isUserTime12hrFormat()
  const meta = parseProp(column.meta)

  if (meta.is12hrFormat === is12hrFormat) return column

  return { ...column, meta: { ...meta, is12hrFormat } } as T
}
