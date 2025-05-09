import express from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import {
  openInterestHandler,
  latestOIByExchangeHandler,
  ohlcvHandler,
  liquidationsHandler,
  latestLiquidationsByExchangeHandler
} from '../controllers/index.js'

export function registerRoutes(app, repositories) {
  const modules = [
    {
      apiPath: '/api/open-interest',
      routes: { '/:symbol': openInterestHandler }
    },
    {
      apiPath: '/api/open-interest/latest-by-exchange',
      routes: {
        '/:symbol': latestOIByExchangeHandler
      }
    },
    {
      apiPath: '/api/liquidations',
      routes: {
        '/:symbol': liquidationsHandler,
        '/latest-by-exchange/:symbol': latestLiquidationsByExchangeHandler
      }
    },
    { 
      apiPath: '/api/ohlcv', 
      routes: { '/:symbol': ohlcvHandler } 
    }
  ]

  modules.forEach(({ apiPath, routes }) => {
    const router = express.Router()
    Object.entries(routes).forEach(([path, handlerFactory]) => {
      router.get(path, asyncHandler(handlerFactory(repositories)))
    })
    app.use(apiPath, router)
  })
} 