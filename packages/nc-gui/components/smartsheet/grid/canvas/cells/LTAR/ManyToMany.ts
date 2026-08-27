import { isBoxHovered, renderIconButton } from '../../utils/canvas'
import { getLtarDisplayColumn, handleLtarChipClick, renderLtarChips, toLtarChipCells } from './renderChips'

const buttonSize = 20

export const ManyToManyCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, readonly, spriteLoader, mousePosition, relatedTableMeta, setCursor, selected } = props

    const m2mColumn = getLtarDisplayColumn(relatedTableMeta)

    if (!m2mColumn) return

    renderLtarChips(ctx, props, {
      displayColumn: m2mColumn,
      cells: toLtarChipCells(value, m2mColumn),
    })

    if (selected) {
      const borderRadius = 6

      if (!readonly) {
        renderIconButton(ctx, {
          buttonX: x + width - 57,
          buttonY: y + 6,
          borderRadius,
          buttonSize,
          spriteLoader,
          mousePosition,
          icon: 'ncPlus',
          iconData: {
            size: 14,
            xOffset: 3,
            yOffset: 3,
          },
          setCursor,
        })
      }

      renderIconButton(ctx, {
        buttonX: x + width - 30,
        buttonY: y + 6,
        borderRadius,
        buttonSize,
        spriteLoader,
        mousePosition,
        icon: 'maximize',
        setCursor,
        iconData: {
          size: 12,
          xOffset: 4,
          yOffset: 4,
        },
      })
    }
  },
  async handleClick(props) {
    const { row, column, getCellPosition, mousePosition, makeCellEditable, selected, isDoubleClick } = props

    if (!selected && !isDoubleClick) return false

    const rowIndex = row.rowMeta.rowIndex!
    const { x, y, width, height } = getCellPosition(column, rowIndex)

    /**
     * Note: The order of click action trigger is matter here to mimic behaviour of editable cell
     */

    /**
     * When user clicks on Maximize/Plus icon make cell editable
     * Open linked/unlinked record dropdown will handled in editable cell component
     */
    if (
      isBoxHovered({ x: x + width - 57, y: y + 7, height: buttonSize, width: buttonSize }, mousePosition) ||
      isBoxHovered({ x: x + width - 30, y: y + 7, height: buttonSize, width: buttonSize }, mousePosition)
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
  handleHover: async (props) => {
    const { row, column, mousePosition, getCellPosition, selected, t } = props

    if (!selected) return

    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()

    const rowIndex = row.rowMeta.rowIndex!
    const { x, y, width } = getCellPosition(column, rowIndex)

    const box = { x: x + width - 30, y: y + 4, width: buttonSize, height: buttonSize }

    tryShowTooltip({ rect: box, mousePosition, text: t('tooltip.expandShiftSpace') })
  },
}
