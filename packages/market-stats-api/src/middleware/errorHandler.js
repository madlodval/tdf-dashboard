import { APIError, DatabaseError, isOperationalError } from '../errors.js'
import { DatabaseConnectionError, DatabaseQueryError } from '@tdf/repositories'

export function errorHandler (err, req, res, next) {
  // Log error para seguimiento interno
  console.error('Error:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    originalError: err.originalError
  })

  // Convertir errores de base de datos a errores de API
  if (err instanceof DatabaseConnectionError || err instanceof DatabaseQueryError) {
    err = new DatabaseError(err)
  }

  // Si es un error operacional conocido, enviar respuesta estructurada
  if (isOperationalError(err)) {
    return res.status(err.statusCode).json(err.toJSON())
  }

  // Para errores no operacionales o desconocidos, enviar error 500 genérico
  const defaultError = new APIError(
    'An unexpected error occurred',
    500,
    err
  )

  return res.status(500).json(defaultError.toJSON())
}
