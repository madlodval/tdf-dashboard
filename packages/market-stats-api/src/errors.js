export class APIError extends Error {
  constructor(message, statusCode = 500, originalError = null) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.originalError = originalError
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        status: this.statusCode
      }
    }
  }
}

export class ValidationError extends APIError {
  constructor(message) {
    super(message, 400)
  }
}

export class NotFoundError extends APIError {
  constructor(resource) {
    super(`${resource} not found`, 404)
  }
}

export class DatabaseError extends APIError {
  constructor(originalError) {
    super(
      'An internal server error occurred',
      500,
      originalError
    )
  }
}

export function isOperationalError(error) {
  if (error instanceof APIError) {
    return true
  }
  return false
} 