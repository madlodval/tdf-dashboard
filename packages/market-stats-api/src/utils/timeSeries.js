export function compressTimeSeries (data, ...includeFields) {
  if (!data.length) return []

  const base = data[0].time || data[0].timestamp
  let prev = base

  const compressedData = data.map((item, idx) => {
    const time = item.time || item.timestamp
    const offset = idx === 0 ? 0 : time - prev
    prev = time

    return [offset, ...includeFields.map(field =>
      typeof item[field] === 'number' ? item[field] : Number(item[field])
    )]
  })

  return [base, ...compressedData]
} 