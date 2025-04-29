export const RESOURCE_OI = 'oi'
export const RESOURCE_LQ = 'lq'
export const RESOURCE_VL = 'vl'


// Mapa de meses para CME y abreviaturas
const CME_MONTH_LETTERS = { F: 0, G: 1, H: 2, J: 3, K: 4, M: 5, N: 6, Q: 7, U: 8, V: 9, X: 10, Z: 11 };
const MONTH_NAME_TO_IDX = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

/**
 * Extrae tipo y fecha de vencimiento de un símbolo.
 */
function extractExpiryInfo(symbol) {
    // 1) Perpetual
    if (/PERP|PERPETUAL/i.test(symbol)) {
        return { type: 'perpetual' };
    }

    let m;

    // 2) Bybit/BitMEX: ff_xbtusd_250425, fi_xbtusd_250627, etc.
    if ((m = symbol.match(/(?:ff_|fi_)?xbtusd[._](\d{6})/i))) {
        const [yy, mm, dd] = [m[1].slice(0, 2), m[1].slice(2, 4), m[1].slice(4, 6)].map(Number);
        return {
            type: 'future',
            expiry: Date.UTC(2000 + yy, mm - 1, dd)
        };
    }

    // 3) CME monthly: XBTJ25, XBTM25, etc.
    if ((m = symbol.match(/([FGHJKMNQUVXZ])(\d{2})/))) {
        const letter = m[1], yy = Number(m[2]);
        return {
            type: 'future',
            expiry: Date.UTC(2000 + yy, CME_MONTH_LETTERS[letter], 1)
        };
    }

    // 4) Deribit: BTC-18APR25.2
    if ((m = symbol.match(/-(\d{2})([A-Z]{3})(\d{2})/))) {
        const [, dd, mon, yy] = m;
        return {
            type: 'future',
            expiry: Date.UTC(
                2000 + Number(yy),
                MONTH_NAME_TO_IDX[mon],
                Number(dd)
            )
        };
    }

    // 5) Fallback genérico: YYMMM o YYMM (solo si MMM es mes en letras)
    if ((m = symbol.match(/(\d{2})([A-Z]{3})/))) {
        const yy = Number(m[1]), mon = m[2];
        if (mon in MONTH_NAME_TO_IDX) {
            return {
                type: 'future',
                expiry: Date.UTC(2000 + yy, MONTH_NAME_TO_IDX[mon], 1)
            };
        }
    }

    // 6) No se detecta vencimiento → perpetuo
    return { type: 'perpetual' };
}

/**
 * Filtra símbolos cuyo periodo [open, expiry] se solape con [from, to].
 * Incluye siempre los 'perpetual'.
 *
 * @param {string[]} symbols
 * @param {number} from   timestamp ms o segs (si <1e12)
 * @param {number} to     timestamp ms o segs (si <1e12)
 * @param {boolean} debug opcional para logs de depuración
 * @returns {string[]}
 */
export function filterSymbolsByDate(symbols, from, to, debug = false) {
    const fromMs = from < 1e12 ? from * 1000 : from;
    const toMs = to < 1e12 ? to * 1000 : to;

    return symbols.filter(symbol => {
        const info = extractExpiryInfo(symbol);

        // Siempre incluir perpetuales
        if (info.type === 'perpetual') {
            if (debug) console.log(`[PERP] ${symbol} → incluido`);
            return true;
        }

        // Para futuros, open = primer día del mes anterior al expiry
        const expDate = new Date(info.expiry);
        const openMs = Date.UTC(
            expDate.getUTCFullYear(),
            expDate.getUTCMonth() - 1,
            1
        );

        const overlap = openMs <= toMs && info.expiry >= fromMs;
        if (debug) {
            console.log(
                `[FUT] ${symbol} → open=${new Date(openMs).toISOString().slice(0, 10)}, ` +
                `expiry=${expDate.toISOString().slice(0, 10)}, keep=${overlap}`
            );
        }
        return overlap;
    });
}