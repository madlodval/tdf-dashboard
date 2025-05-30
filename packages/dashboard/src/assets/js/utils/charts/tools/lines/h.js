import { BaseLinesTool, LINE_TYPE_HORIZONTAL } from './base.js'


export class HorizontalLinesTool extends BaseLinesTool {
  getLineType() {
    return LINE_TYPE_HORIZONTAL
  }

  _createSingleLine(param, lineGroup) {
    const curPane = param.paneIndex
    let isSet = false
    const applyToSeries = new Map()
    
    param.seriesData.forEach((data, series) => {
      const paneIndex = series.getPane().paneIndex()
      let price = data.value || data.close
      
      if (paneIndex === curPane && !isSet) {
        const pointPrice = series.coordinateToPrice(param.point.y)
        if (Object.hasOwn(data, 'high') && Object.hasOwn(data, 'low')) {
          const { high, low } = data
          if (pointPrice >= low && pointPrice <= high) {
            price = pointPrice
            isSet = true
          }
        } else if (pointPrice >= 0 && price >= 0) {
          isSet = true
          price = pointPrice
        } else if (pointPrice <= 0 && price <= 0) {
          isSet = true
          price = pointPrice
        }
      }
      applyToSeries.set(series, price)
    })

    applyToSeries.forEach((price, series) => {
      const priceLine = series.createPriceLine({
        price,
        ...this._createLineStyle()
      })
      
      this._assignLineMetadata(priceLine, lineGroup)
      priceLine._series = series
      lineGroup.lines.push(priceLine)
    })

    if (lineGroup.lines.length > 0) {
      lineGroup.price = applyToSeries.get(this.seriesInstances[0])
    }
  }

  _removeSingleLine(priceLine) {
    if (priceLine._series) {
      priceLine._series.removePriceLine(priceLine)
    }
  }

  _calculateLineDistance(lineGroup, param) {
    if (lineGroup.price === null || lineGroup.lines.length === 0) {
      return null
    }

    const firstLine = lineGroup.lines[0]
    if (firstLine._series) {
      const lineY = firstLine._series.priceToCoordinate(lineGroup.price)
      if (lineY !== null) {
        return Math.abs(param.point.y - lineY)
      }
    }
    return null
  }

  async _recreateSavedLine(lineGroup) {
    this.seriesInstances.forEach(series => {
      const priceLine = series.createPriceLine({
        price: lineGroup.price,
        ...this._createLineStyle()
      })
      
      this._assignLineMetadata(priceLine, lineGroup)
      priceLine._series = series
      lineGroup.lines.push(priceLine)
    })
  }
}
