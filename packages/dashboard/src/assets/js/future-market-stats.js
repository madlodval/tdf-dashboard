import Alpine from 'alpinejs'
import {
  CrosshairMode,
  LineStyle,
  PriceScaleMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries
} from 'lightweight-charts'
import {
  COLOR_TEXT_PRIMARY,
  COLOR_WHITE,
  COLOR_SEPARATOR,
  COLOR_SEPARATOR_HOVER,
  COLOR_PRIMARY,
  COLOR_GRID_BORDER,
  COLOR_LONG,
  COLOR_SHORT,
  COLOR_VOL,
  COLOR_VOL_MA
} from './utils/colors.js'
import { marketStats } from './api/future-market-stats.js'
import { Loader } from './utils/loader.js'
import {
  LightChart,
  formatAmount,
  tickMarkFormatter
} from './utils/charts/light-weight.js'
import watermark from 'Images/td-logo-black-pools.svg?url'
import { TooltipPrimitive } from '@tdf/lwc-plugin-tooltip'
import { chartState } from './utils/charts/state.js'
import {
  ChartToolsManager,
  HorizontalLinesTool,
  VerticalLinesTool,
  ScreenshotTool,
  FullscreenTool,
  ResetTool
} from './utils/charts/tools/index.js'

Alpine.store('loaded', true)
let scale = 1;
console.log(window.translations)
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
      priceFormatter(val) {
        return formatAmount(val, scale)
      }
    },
    layout: {
      background: { color: COLOR_WHITE },
      textColor: COLOR_TEXT_PRIMARY,
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
    // -------- PRICE --------
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
    // -------- OPEN INTEREST --------
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
    // -------- VOLUME --------
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
      type: LineSeries,
      pane: {
        index: 2,
      },
      options: {
        color: COLOR_VOL_MA,
        priceLineVisible: false,
        lineWidth: 1,
      }
    },
    // --------    LIQUIDATIONS LONGS --------
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
    // -------- LIQUIDATIONS SHORTS --------
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

const toolsManager = new ChartToolsManager(chart, chartState, {
  'h-line-btn': {
    class: HorizontalLinesTool,
    config: {
      color: '#ff0000',
      width: 1,
      style: LineStyle.Dashed
    }
  },
  'v-line-btn': {
    class: VerticalLinesTool,
    config: {
      color: '#0000ff',
      width: 1,
      style: LineStyle.Dashed
    }
  },
  'fullscreen-btn': {
    class: FullscreenTool
  },
  'screenshot-btn': {
    class: ScreenshotTool,
    config: {
      filename: 'tdf-chart.png'
    }
  },
  'reset-btn': {
    class: ResetTool
  }
})

Loader.register(
  'loading-spinner',
  'loading-overlay',
  'loading-error'
)

document.addEventListener('symbol-changed', async (e) => {
  fetchAndDraw(await chartState.saveMeta({ symbol: e.detail }))
})

document.addEventListener('interval-changed', async (e) => {
  fetchAndDraw(await chartState.saveMeta({ interval: e.detail }))
})

async function fetchAndDraw ({ symbol, interval }) {
  Loader.show()
  try {
    const { oi, price, volume, liquidation, smaVolume, scale: scaleValue } = await marketStats.history(symbol.toLowerCase(), interval)
    scale = scaleValue
    const [priceSeries, ioSeries, vlSeries, lq1Series, lq2Series] = chart
      .render(
        interval,
        scale,
        price,
        oi,
        volume,
        smaVolume,
        ...liquidation.reduce(([longs, shorts], d) => {
          longs.push({ time: d.time, value: d.longs })
          shorts.push({ time: d.time, value: -Math.abs(d.shorts) })
          return [longs, shorts]
        }, [[], []])
      )
    await toolsManager.setSymbol(symbol)
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
        return `Price: ${formatAmount(data.close, scale)}
          Open interest: ${formatAmount(io.close, scale)}
          Volume: ${formatAmount(vl.value, scale)}
          Lq Longs: ${formatAmount(lqL.value, scale)}
          Lq Short: ${formatAmount(lqS.value, scale)}
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

setTimeout(async () => {
  const { symbol, interval } = await chartState.loadMeta()
  console.log(symbol, interval)
  Alpine.store('symbol', symbol)
  Alpine.store('interval', interval)
  fetchAndDraw({ symbol, interval })
}, 0);
