import Alpine from 'alpinejs';
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
} from './utils/charts/light-weight.js'
// import { ChartTools } from './utils/charts/tools.js'
import watermark from 'Images/td-logo-black-pools.svg?url'
import { TooltipPrimitive } from './utils/charts/tooltip/tooltip.ts'
import { chartState } from './utils/charts/state.js'
import { ChartToolsManager } from './utils/charts/tools/manager.js'
import { HorizontalLinesTool } from './utils/charts/tools/lines/h.js';
import { VerticalLinesTool } from './utils/charts/tools/lines/v.js';
import { ScreenshotTool } from './utils/charts/tools/screenshot.js';
import { FullscreenTool } from './utils/charts/tools/fullscreen.js';
import { ResetTool } from './utils/charts/tools/reset.js';

Alpine.store('loaded', true);

console.log(window.translations);
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
        height: 300,
        label({ open, high, low, close }) {
          console.log('HOALA');
        }
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

const toolsManager = new ChartToolsManager(chart, chartState, {
  'h-line-btn': {
    class: HorizontalLinesTool,
    config: { color: '#ff0000', width: 2 }
  },
  'v-line-btn': {
    class: VerticalLinesTool,
    config: { color: '#0000ff', width: 2 }
  },
  'fullscreen-btn': {
    class: FullscreenTool,
  },
  'screenshot-btn': {
    class: ScreenshotTool,
    config: { 
      filename: 'my-chart.png' ,
      backgroundColor: '#ffffff',
      fontSize: 12,
      fontFamily: 'Inter Variable, sans-serif',
      textColor: '#333333',
    }
  },
  'reset-btn': {
    class: ResetTool
  }
})

/*
toolsManager
  .addTool('hLines', HorizontalLinesTool, { color: '#ff0000', width: 2 })
  .addTool('vLines', VerticalLinesTool, { color: '#0000ff', width: 2 })
  .addTool('fullscreen', FullscreenTool)
  .addTool('screenshot', ScreenshotTool, { filename: 'my-chart.png' })
  .addTool('reset', ResetTool)
  .bindButton('h-line-btn', 'hLines', 'toggle')
  .bindButton('v-line-btn', 'vLines', 'toggle')
  .bindButton('fullscreen-btn', 'fullscreen', 'execute')
  .bindButton('screenshot-btn', 'screenshot', 'execute')
  .bindButton('reset-btn', 'reset', 'execute')
*/

Loader.register(
  'loading-spinner',
  'loading-overlay',
  'loading-error'
)

document.addEventListener('symbol-changed', async(e) => {
  fetchAndDraw(await chartState.saveMeta({ symbol: e.detail }))
})

document.addEventListener('interval-changed', async (e) => {
  fetchAndDraw(await chartState.saveMeta({ interval: e.detail }))
})

async function fetchAndDraw ({ symbol, interval }) {
  Loader.show()
  try {
    const { oi, price, volume, liquidation } = await marketStats.history(symbol.toLowerCase(), interval)
    const [priceSeries, ioSeries, vlSeries, lq1Series, lq2Series] = chart
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
      await toolsManager.setSymbol(symbol)
      /*
      ChartTools.create(chart, symbol, chartState, {
        lineColor: '#000000',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed
      }).render()
      */

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

    Loader.hide(500)
  } catch (err) {
    console.error(err)
    chart.destroy()
    Loader.hide(0, err)
  }
}

(async () => {
  const { symbol, interval } = await chartState.loadMeta()
  console.log(symbol, interval);
  Alpine.store('symbol', symbol)
  Alpine.store('interval', interval)
  fetchAndDraw({ symbol, interval })
})();
