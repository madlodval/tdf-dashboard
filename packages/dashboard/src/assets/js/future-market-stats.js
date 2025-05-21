import {
  CrosshairMode,
  LineStyle,
  PriceScaleMode,
  CandlestickSeries,
  HistogramSeries
} from 'lightweight-charts'
import {
  COLOR_DARK_TEXT,
  COLOR_WHITE,
  COLOR_SEPARATOR,
  COLOR_SEPARATOR_HOVER,
  COLOR_PRIMARY,
  COLOR_GRID_BORDER,
  COLOR_LONG,
  COLOR_SHORT,
  COLOR_VOL
} from './utils/colors.js'
import { marketStats } from './api/future-market-stats.js'
import { Loader } from './utils/loader.js'
import {
  LightChart,
  formatAmount,
  tickMarkFormatter
} from './utils/charts.js'
import watermark from 'Images/td-logo-black-pools.svg?url'
import { HorizontalLinePlugin } from './utils/charts/tools/hline.js'
import { TooltipPrimitive } from './utils/charts/tooltip/tooltip.ts'

let symbol = 'BTC'
let interval = '1d'

const chart = new LightChart('full-chart', {
  watermark: {
    paneIndex: 0,
    url: watermark,
    alpha: 0.1,
    maxHeight: 70
  },
  options: {
    autoSize: true,
    localization: {
      priceFormatter: formatAmount
    },
    layout: {
      background: { color: COLOR_WHITE },
      textColor: COLOR_DARK_TEXT,
      panes: {
        separatorColor: COLOR_SEPARATOR,
        separatorHoverColor: COLOR_SEPARATOR_HOVER,
        enableResize: true
      }
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false }
    },
    crosshair: {
      mode: CrosshairMode.MagnetOHLC,
      vertLine: {
        color: COLOR_PRIMARY,
        width: 1,
        style: LineStyle.Dashed,
        labelVisible: true
      },
      horzLine: {
        color: COLOR_PRIMARY,
        width: 1,
        style: LineStyle.Dashed,
        labelVisible: true
      }
    },
    rightPriceScale: {
      borderColor: COLOR_GRID_BORDER,
      mode: PriceScaleMode.Normal,
      ticksVisible: false,
      autoScale: true,
      scaleMargins: {
        top: 0.2,
        bottom: 0.2
      }
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 2,
      barSpacing: 15,
      fixRightEdge: false,
      borderColor: COLOR_GRID_BORDER,
      visible: true,
      tickMarkFormatter
    }
  },
  series: [
    {
      type: CandlestickSeries,
      pane: {
        index: 0,
        height: 300
      },
      options: {
        wickUpColor: COLOR_LONG,
        upColor: COLOR_LONG,
        borderUpColor: COLOR_LONG,
        wickDownColor: COLOR_SHORT,
        downColor: COLOR_SHORT,
        borderDownColor: COLOR_SHORT
      }
    },
    {
      type: CandlestickSeries,
      pane: {
        index: 1,
        height: 150
      },
      options: {
        wickUpColor: COLOR_LONG,
        upColor: COLOR_LONG,
        wickDownColor: COLOR_SHORT,
        downColor: COLOR_SHORT,
        borderVisible: false
      }
    },
    {
      type: HistogramSeries,
      pane: {
        index: 2,
        height: 150
      },
      options: {
        color: COLOR_VOL,
        priceFormat: { type: 'volume' },
        base: 0,
        priceScaleId: 'right',
        priceLineVisible: false
      }
    },
    {
      type: HistogramSeries,
      pane: {
        index: 3,
        height: 150
      },
      options: {
        color: COLOR_LONG,
        priceFormat: { type: 'volume' },
        base: 0,
        priceScaleId: 'right',
        priceLineVisible: false
      }
    },
    {
      type: HistogramSeries,
      pane: {
        index: 3
      },
      options: {
        color: COLOR_SHORT,
        priceFormat: { type: 'volume' },
        base: 0,
        priceScaleId: 'right',
        priceLineVisible: false
      }
    }
  ]
})

Loader.register(
  'loading-spinner',
  'loading-overlay',
  'loading-error'
)

document.addEventListener('symbol-changed', e => {
  symbol = e.detail
  fetchAndDraw(symbol, interval)
})

document.addEventListener('interval-changed', e => {
  interval = e.detail
  fetchAndDraw(symbol, interval)
})

window.addEventListener('load', () => {
  fetchAndDraw(symbol, interval)
})

async function fetchAndDraw (symbol, interval) {
  Loader.show()
  try {
    const { oi, price, volume, liquidation } = await marketStats.history(symbol.toLowerCase(), interval)
    const [priceSeries, ioSeries, vlSeries, lq1Series, lq2Series] = chart
      .tools({
        color: COLOR_PRIMARY
      })
      .render(
        interval,
        price,
        oi,
        volume,
        ...liquidation.reduce(([longs, shorts], d) => {
          longs.push({ time: d.time, value: d.longs })
          shorts.push({ time: d.time, value: -Math.abs(d.shorts) })
          return [longs, shorts]
        }, [[], []])

      )
    /*
    const lineOptionsAutoPrice = {
      chart: chart.chart,
      color: 'rgba(0, 128, 255, 0.8)',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      draggable: true,
      showDeleteButton: true
    }
    const mainSeries = chart.chart.panes()[0].getSeries()[0]

    const miLineaHorizontalAutomatica = new HorizontalLinePlugin(mainSeries, lineOptionsAutoPrice)
    mainSeries.attachPrimitive(miLineaHorizontalAutomatica)
    */
    const tooltipPrimitive = new TooltipPrimitive({
      lineColor: 'rgba(0, 0, 0, 0.2)',
      tooltip: {
        followMode: 'top'
      },
      priceExtractor (data, logicalIndex) {
        const io = ioSeries.dataByIndex(logicalIndex)
        const vl = vlSeries.dataByIndex(logicalIndex)
        const lqL = lq1Series.dataByIndex(logicalIndex)
        const lqS = lq2Series.dataByIndex(logicalIndex)
        return `Price: ${formatAmount(data.close)}
          Open interest: ${formatAmount(io.close)}
          Volume: ${formatAmount(vl.value)}
          Lq Longs: ${formatAmount(lqL.value)}
          Lq Short: ${formatAmount(lqS.value)}
        `
      }
    })

    priceSeries.attachPrimitive(tooltipPrimitive)

    Loader.hide(500)
  } catch (err) {
    console.error(err)
    chart.destroy()
    Loader.hide(0, err)
  }
}
