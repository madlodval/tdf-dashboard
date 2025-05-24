import BigNumber from 'bignumber.js'

// Configuración global para criptomonedas
BigNumber.config({
  DECIMAL_PLACES: 18,
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
  EXPONENTIAL_AT: [-18, 20],
  RANGE: [-1e+9, 1e+9]
})

export { BigNumber }

export class CryptoMath {
  /**
     * Crea un número seguro desde cualquier input
     * @param {string|number|BigNumber} value
     * @returns {BigNumber}
     */
  static create (value) {
    if (value === null || value === undefined || value === '') {
      return new BigNumber(0)
    }
    if (BigNumber.isBigNumber(value)) {
      return value
    }
    return new BigNumber(value.toString())
  }

  /**
     * Suma dos números
     * @param {string|number|BigNumber} a
     * @param {string|number|BigNumber} b
     * @returns {BigNumber}
     */
  static add (a, b) {
    return this.create(a).plus(this.create(b))
  }

  /**
     * Resta dos números
     * @param {string|number|BigNumber} a
     * @param {string|number|BigNumber} b
     * @returns {BigNumber}
     */
  static subtract (a, b) {
    return this.create(a).minus(this.create(b))
  }

  /**
     * Multiplica dos números
     * @param {string|number|BigNumber} a
     * @param {string|number|BigNumber} b
     * @returns {BigNumber}
     */
  static multiply (a, b) {
    return this.create(a).multipliedBy(this.create(b))
  }

  /**
     * Divide dos números
     * @param {string|number|BigNumber} a
     * @param {string|number|BigNumber} b
     * @returns {BigNumber}
     */
  static divide (a, b) {
    const divisor = this.create(b)
    if (divisor.isZero()) {
      throw new Error('Division by zero')
    }
    return this.create(a).dividedBy(divisor)
  }

  /**
     * Convierte a string para base de datos
     * @param {BigNumber} value
     * @returns {string}
     */
  static toDBString (value) {
    return this.create(value).toFixed()
  }

  /**
     * Formatea para mostrar con decimales específicos
     * @param {BigNumber} value
     * @param {number} decimals
     * @returns {string}
     */
  static toDisplay (value, decimals = 8) {
    return this.create(value).toFormat(decimals)
  }

  /**
     * Compara si a > b
     * @param {string|number|BigNumber} a
     * @param {string|number|BigNumber} b
     * @returns {boolean}
     */
  static isGreaterThan (a, b) {
    return this.create(a).isGreaterThan(this.create(b))
  }

  /**
     * Compara si a < b
     * @param {string|number|BigNumber} a
     * @param {string|number|BigNumber} b
     * @returns {boolean}
     */
  static isLessThan (a, b) {
    return this.create(a).isLessThan(this.create(b))
  }

  /**
     * Compara si a == b
     * @param {string|number|BigNumber} a
     * @param {string|number|BigNumber} b
     * @returns {boolean}
     */
  static isEqual (a, b) {
    return this.create(a).isEqualTo(this.create(b))
  }

  /**
     * Calcula el máximo de un array
     * @param {Array} values
     * @returns {BigNumber}
     */
  static max (...values) {
    if (!values || values.length === 0) {
      return new BigNumber(0)
    }
    return values.reduce((max, current) => {
      const curr = this.create(current)
      return curr.isGreaterThan(max) ? curr : max
    }, this.create(values[0]))
  }

  /**
     * Calcula el mínimo de un array
     * @param {Array} values
     * @returns {BigNumber}
     */
  static min (...values) {
    if (!values || values.length === 0) {
      return new BigNumber(0)
    }
    return values.reduce((min, current) => {
      const curr = this.create(current)
      return curr.isLessThan(min) ? curr : min
    }, this.create(values[0]))
  }

  /**
     * Suma un array de valores
     * @param {Array} values
     * @returns {BigNumber}
     */
  static sum (values) {
    if (!values || values.length === 0) {
      return new BigNumber(0)
    }
    return values.reduce((sum, current) =>
      sum.plus(this.create(current)),
    new BigNumber(0)
    )
  }

  /**
     * Calcula porcentaje de cambio
     * @param {string|number|BigNumber} oldValue
     * @param {string|number|BigNumber} newValue
     * @returns {BigNumber}
     */
  static percentageChange (oldValue, newValue) {
    const old = this.create(oldValue)
    const newVal = this.create(newValue)

    if (old.isZero()) {
      return new BigNumber(0)
    }

    return newVal.minus(old).dividedBy(old).multipliedBy(100)
  }
}
