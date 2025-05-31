import { BaseLinesTool, LINE_TYPE_VERTICAL } from './base.js'
import { VLine } from '@tdf/lwc-plugin-vline'

export class VerticalLinesTool extends BaseLinesTool {
  getLineType () {
    return LINE_TYPE_VERTICAL
  }

  _createSingleLine (param, lineGroup) {
    const time = param.time
    lineGroup.time = time

    this.seriesInstances.forEach(series => {
      const line = new VLine(time, this._createLineStyle())

      this._assignLineMetadata(line, lineGroup)
      line._series = series
      line._time = time
      lineGroup.lines.push(line)
      series.attachPrimitive(line)
    })
  }

  _removeSingleLine (vLine) {
    if (vLine._series) {
      vLine._series.detachPrimitive(vLine)
    }
  }

  _calculateLineDistance (lineGroup, param) {
    if (lineGroup.time === null) {
      return null
    }

    const lineX = this.chartCore.timeScale().timeToCoordinate(lineGroup.time)
    if (lineX !== null) {
      return Math.abs(param.point.x - lineX)
    }
    return null
  }

  _recreateSavedLine (lineGroup) {
    this.seriesInstances.forEach(series => {
      const line = new VLine(lineGroup.time, this._createLineStyle())

      this._assignLineMetadata(line, lineGroup)
      line._series = series
      line._time = lineGroup.time
      lineGroup.lines.push(line)
      series.attachPrimitive(line)
    })
  }
}
