import type { ColumnType } from 'nocodb-sdk'
import { getLinkPreviewKey } from 'nocodb-sdk'
import { isBoxHovered, renderIconButton, renderSingleLineText, renderTagLabel } from '../utils/canvas'
import { getLtarDisplayColumn, handleLtarChipClick, renderLtarChips, toLtarChipCells } from './LTAR/renderChips'

const buttonSize = 24

/**
 * A `Links` cell value is only the number of linked records. The records themselves
 * are returned alongside it under `_nc_lk_<title>` when the list request opts into a
 * link preview - see `includeLinkPreview` in the backend's `getAst`.
 *
 * `record` is the raw row data (`Row['row']`), not the `Row` wrapper - `render` is
 * handed the former while the click/hover handlers get the latter.
 *
 * Returns undefined when no preview was fetched, in which case the cell falls back to
 * showing the count.
 */
const getLinkPreview = (
  record: Record<string, any> | undefined,
  column?: ColumnType,
  count = 0,
): Record<string, any>[] | undefined => {
  if (!column?.title) return undefined

  const preview = record?.[getLinkPreviewKey(column.title)]

  if (ncIsArray(preview)) return preview

  // The reverse side of a one-to-one resolves to a single record
  if (ncIsObject(preview)) return [preview]

  // A row inserted in this session carries no preview key, since it is built from the
  // create response rather than a list request. With nothing linked there is nothing
  // to preview anyway, so treat it as empty rather than falling back to the count -
  // otherwise a new row reads "No records linked" until the next reload.
  return count ? undefined : []
}

/** The cell's own value for a Links column is the number of linked records. */
const linkCount = (row: Row, column: CanvasGridColumn) => +row?.row?.[column.title!] || 0

export const LinksCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const {
      column,
      row,
      value,
      x,
      y,
      width,
      height,
      padding,
      t,
      spriteLoader,
      mousePosition,
      readonly,
      setCursor,
      selected,
      relatedTableMeta,
    } = props

    const preview = getLinkPreview(row, column, +value || 0)
    const displayColumn = getLtarDisplayColumn(relatedTableMeta)

    // Render the linked values as chips when we have them. Under a Lookup the cell is
    // drawn as a single chip in someone else's layout, where only the count fits.
    if (preview && displayColumn && !props.tag?.renderAsTag && !props.isUnderLookup) {
      const cells = toLtarChipCells(preview, displayColumn)

      renderLtarChips(ctx, props, {
        displayColumn,
        cells,
        hasMore: cells.length < (+value || 0),
      })

      if (isBoxHovered({ x, y, width, height }, mousePosition)) {
        const borderRadius = 6

        if (!readonly) {
          renderIconButton(ctx, {
            buttonX: x + width - 57,
            buttonY: y + 4,
            borderRadius,
            buttonSize,
            spriteLoader,
            mousePosition,
            icon: 'ncPlus',
            iconData: {
              size: 14,
              xOffset: 5,
              yOffset: 5,
            },
            setCursor,
          })
        }

        renderIconButton(ctx, {
          buttonX: x + width - 30,
          buttonY: y + 4,
          borderRadius,
          buttonSize,
          spriteLoader,
          mousePosition,
          icon: 'maximize',
          setCursor,
        })
      }

      return
    }

    const parsedValue = +value || 0

    let text = ''
    if (!parsedValue) {
      text = t('msg.noRecordsLinked')
    } else if (parsedValue === 1) {
      text = `1 ${column?.meta?.singular || t('general.link')}`
    } else {
      text = `${parsedValue} ${column?.meta?.plural || t('general.links')}`
    }

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { y: textYOffset, width: textWidth } = renderSingleLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2 - 20,
        fontFamily: '500 13px Inter',
        fillStyle: 'rgb(67, 81, 232)',
        height,
      })

      const isHoverOverText = isBoxHovered({ x: x + padding, y, width: textWidth, height: textYOffset - y }, mousePosition)

      const { x: xOffset, y: yOffset } = renderSingleLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2 - 20,
        fontFamily: '500 13px Inter',
        fillStyle: 'rgb(67, 81, 232)',
        height,
        underline: selected && isHoverOverText,
      })

      if (selected && isHoverOverText) {
        setCursor('pointer')
      }

      if (selected && !readonly) {
        spriteLoader.renderIcon(ctx, {
          icon: 'ncPlus',
          x: x + width - 16 - padding,
          y: y + 7,
          size: 16,
          color: '#374151',
        })

        if (isBoxHovered({ x: x + width - 16 - padding, y: y + 7, width: 16, height: 16 }, mousePosition)) {
          setCursor('pointer')
        }
      }

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  async handleClick(props) {
    const { row, column, getCellPosition, mousePosition, makeCellEditable, selected, isDoubleClick } = props

    if (!selected && !isDoubleClick) return false

    const rowIndex = row.rowMeta.rowIndex!
    const { x, y, width, height } = getCellPosition(column, rowIndex)
    const padding = 10

    const showsChips =
      !!getLinkPreview(row?.row, column.columnObj, linkCount(row, column)) && !!getLtarDisplayColumn(column.relatedTableMeta)

    if (!showsChips) {
      if (
        isBoxHovered({ x: x + width - 16 - padding, y: y + 7, height: 16, width: 16 }, mousePosition) ||
        isBoxHovered({ x: x + padding, y, height, width: width - padding * 2 }, mousePosition)
      ) {
        makeCellEditable(row, column)
        return true
      }
      return false
    }

    /**
     * Note: The order of click action trigger is matter here to mimic behaviour of editable cell
     */

    /**
     * When user clicks on Maximize/Plus icon make cell editable
     * Open linked/unlinked record dropdown will handled in editable cell component
     */
    if (
      isBoxHovered({ x: x + width - 57, y: y + 4, height: buttonSize, width: buttonSize }, mousePosition) ||
      isBoxHovered({ x: x + width - 30, y: y + 4, height: buttonSize, width: buttonSize }, mousePosition)
    ) {
      makeCellEditable(row, column)
      return true
    }

    /**
     * Expand record on click chip item if cell is selected and user has permission to edit data (e.g, not readonly)
     */
    if (handleLtarChipClick(props)) {
      return true
    }

    /**
     * This is same as `cellClickHook`, on click cell make cell editable
     */
    if (isBoxHovered({ x, y, width, height }, mousePosition)) {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
  async handleKeyDown({ row, column, e, makeCellEditable }) {
    if (isExpandCellKey(e)) {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
  handleHover: async (props) => {
    const { row, column, mousePosition, getCellPosition, t } = props

    if (!getLinkPreview(row?.row, column.columnObj, linkCount(row, column)) || !getLtarDisplayColumn(column.relatedTableMeta)) {
      return
    }

    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()

    const rowIndex = row.rowMeta.rowIndex!
    const { x, y, width } = getCellPosition(column, rowIndex)

    const box = { x: x + width - 30, y: y + 4, width: buttonSize, height: buttonSize }

    tryShowTooltip({ rect: box, mousePosition, text: t('tooltip.expandShiftSpace') })
  },
}
