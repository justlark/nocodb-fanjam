import type { ColumnType, TableType } from 'nocodb-sdk'
import { isBoxHovered, renderSingleLineText } from '../../utils/canvas'
import { PlainCellRenderer } from '../Plain'
import { renderAsCellLookupOrLtarValue } from '../../utils/cell'

const ellipsisWidth = 15

type CellClickProps = Parameters<NonNullable<CellRenderer['handleClick']>>[0]

export interface LtarChipCell {
  value: any
  item: Record<string, any>
}

/**
 * The related table's display value column - the one whose value each chip shows.
 */
export const getLtarDisplayColumn = (relatedTableMeta?: TableType): ColumnType | undefined => {
  const displayValueProp = (relatedTableMeta?.columns?.find((c) => c.pv) || relatedTableMeta?.columns?.[0])?.title || ''

  if (!displayValueProp) return undefined

  return relatedTableMeta?.columns?.find((c: any) => c.title === displayValueProp) as ColumnType | undefined
}

/**
 * Normalise a cell value into the chips to render. Accepts an array (has-many,
 * many-to-many) or a single record (the reverse side of a one-to-one).
 */
export const toLtarChipCells = (value: any, displayColumn: ColumnType): LtarChipCell[] => {
  const items: Record<string, any>[] = ncIsArray(value) ? value : ncIsObject(value) ? [value] : []

  const cells: LtarChipCell[] = []

  for (const item of items) {
    if (!ncIsObject(item)) continue

    cells.push({ value: item[displayColumn.title!], item })
  }

  return cells
}

/**
 * Lays out linked records as chips across the cell, wrapping onto as many lines as
 * the row height allows and trailing an ellipsis when there are chips left over.
 *
 * The last chip on the final line is itself truncated by `renderTagLabel` to whatever
 * width remains, so a partial value is still shown rather than dropped entirely.
 *
 * Records the box of every rendered chip in `cellRenderStore.ltar` so that
 * `handleLtarChipClick` can hit-test them.
 */
export const renderLtarChips = (
  ctx: CanvasRenderingContext2D,
  props: CellRendererOptions,
  { displayColumn, cells }: { displayColumn: ColumnType; cells: LtarChipCell[] },
) => {
  const {
    x,
    y,
    width,
    height,
    padding,
    readonly,
    selected,
    mousePosition,
    relatedTableMeta,
    renderCell,
    setCursor,
    cellRenderStore,
  } = props

  const initialX = x + 4
  const initialWidth = width - 8

  let currentX = initialX
  let currentY = y + (rowHeightInPx['1'] === height ? 0 : 2)
  let currentWidth = initialWidth

  /**
   * Chip info which is oldX, oldY, x, y, width, height, value is required when user click on chip item to expand record
   * Value added in returnData because we don't want to calculate it again
   */
  const returnData: CellRenderStore['ltar'] = []

  const renderProps: CellRendererOptions = {
    ...props,
    column: displayColumn,
    relatedColObj: undefined,
    relatedTableMeta: undefined,
    readonly: true,
    height: rowHeightInPx['1']!,
    padding: 10,
    textColor: themeV3Colors.brand['500'],
    tag: {
      renderAsTag: true,
      tagBgColor: themeV3Colors.brand['50'],
      tagHeight: 24,
    },
    meta: relatedTableMeta,
  }

  const cellRenderer = (options: CellRendererOptions) => {
    return renderAsCellLookupOrLtarValue.includes(displayColumn.uidt!)
      ? renderCell(ctx, displayColumn, options)
      : PlainCellRenderer.render(ctx, options)
  }

  const maxLines = rowHeightTruncateLines(height, true)
  let line = 1
  let flag = false
  let count = 1

  for (const cell of cells) {
    const point = cellRenderer({
      ...renderProps,
      value: cell.value,
      x: currentX,
      y: currentY,
      width: currentWidth,
    })

    if (point?.x) {
      // Add rendered chip info in return data
      returnData.push({
        oldX: currentX + 4,
        oldY: currentY + 4,
        x: point.x,
        y: point.y,
        width: point.x - (currentX + 4),
        height: point.y ? point.y - (currentY + 4) : 24,
        value: cell.item,
      })

      // Show cursor pointer on hover over chip item
      if (
        !readonly &&
        selected &&
        isBoxHovered(
          { x: currentX, y: currentY, width: point.x - currentX, height: point.y ? point.y - currentY : 24 },
          mousePosition,
        )
      ) {
        setCursor('pointer')
      }

      if (point?.x >= x + initialWidth - padding * 2 - (count < cells.length ? 50 - ellipsisWidth : 0)) {
        if (line + 1 > maxLines) {
          currentX = point?.x
          flag = true
          break
        }

        currentX = initialX
        currentWidth = initialWidth
        currentY = point?.y && y !== point?.y && point?.y - y >= 28 ? point?.y : currentY + 28
        line += 1
      } else {
        currentWidth = currentX + currentWidth - point?.x
        currentX = point?.x
      }
    } else {
      // Add rendered chip info in return data
      returnData.push({
        oldX: currentX,
        oldY: currentY,
        x: currentX + currentWidth,
        y: currentY + 24,
        width: currentWidth,
        height: 24,
        value: cell.item,
      })

      // Show cursor pointer on hover over chip item
      if (!readonly && selected && isBoxHovered({ x: currentX, y: currentY, width: currentWidth, height: 24 }, mousePosition)) {
        setCursor('pointer')
      }

      if (line + 1 > maxLines) {
        break
      }

      currentX = initialX
      currentY = currentY + 28

      currentWidth = initialWidth
      line += 1
    }
    count++
  }

  if (flag && count < cells.length) {
    renderSingleLineText(ctx, {
      x: currentX + 12,
      y,
      text: '...',
      maxWidth: ellipsisWidth,
      textAlign: 'right',
      verticalAlign: 'middle',
      fontFamily: '500 13px Inter',
      fillStyle: '#666',
      height,
    })
  }

  Object.assign(cellRenderStore, { ltar: returnData })
}

/**
 * Expand the linked record whose chip was clicked. Returns true when a chip was hit,
 * so the caller can stop before its own "click anywhere in the cell" handling.
 */
export const handleLtarChipClick = ({
  column,
  cellRenderStore,
  mousePosition,
  isPublic,
  openDetachedExpandedForm,
}: Pick<CellClickProps, 'column' | 'cellRenderStore' | 'mousePosition' | 'isPublic' | 'openDetachedExpandedForm'>): boolean => {
  if (!ncIsArray(cellRenderStore?.ltar)) return false

  // Value is array of object so we have to iterate over it
  for (const cellItem of cellRenderStore.ltar) {
    if (
      !ncIsObject(cellItem.value) ||
      !cellItem.width ||
      !cellItem.height ||
      !isBoxHovered(
        {
          x: cellItem.oldX!,
          y: cellItem.oldY!,
          height: cellItem.height,
          width: cellItem.width,
        },
        mousePosition,
      )
    ) {
      continue
    }

    /**
     * To mimic editable cell behaviour we added return statement here
     * If isPublic (stop event propagation on click chip item) `@click.stop="openExpandedForm"`
     */
    if (isPublic) return true

    const rowId = extractPkFromRow(cellItem.value, (column.relatedTableMeta?.columns || []) as ColumnType[])

    if (rowId) {
      openDetachedExpandedForm({
        isOpen: true,
        row: { row: cellItem.value, rowMeta: {}, oldRow: { ...cellItem.value } },
        meta: column.relatedTableMeta || ({} as TableType),
        rowId,
        useMetaFields: true,
        maintainDefaultViewOrder: true,
        loadRow: !isPublic,
      })
    }

    /**
     * It's imp to add return here on click chip item to stop event propagation as while cell click action is also present below
     */
    return true
  }

  return false
}
