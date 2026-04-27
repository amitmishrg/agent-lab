import {
  calculateTax,
  formatCurrency,
  fetchUser,
  processItems,
  fibonacci,
} from './demo'

// ---------------------------------------------------------------------------
// calculateTax
// ---------------------------------------------------------------------------
describe('calculateTax', () => {
  it('returns the correct tax amount for a standard income and rate', () => {
    expect(calculateTax(50_000, 0.2)).toBe(10_000)
  })

  it('returns 0 when income is 0', () => {
    expect(calculateTax(0, 0.3)).toBe(0)
  })

  it('returns 0 when rate is 0', () => {
    expect(calculateTax(100_000, 0)).toBe(0)
  })

  it('handles fractional results correctly', () => {
    expect(calculateTax(1000, 0.075)).toBeCloseTo(75, 5)
  })
})

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------
describe('formatCurrency', () => {
  it('prepends a dollar sign to the amount', () => {
    expect(formatCurrency(42)).toBe('$42')
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0')
  })

  it('handles negative amounts', () => {
    expect(formatCurrency(-15)).toBe('$-15')
  })

  it('handles decimal amounts', () => {
    expect(formatCurrency(9.99)).toBe('$9.99')
  })
})

// ---------------------------------------------------------------------------
// fetchUser
// ---------------------------------------------------------------------------
describe('fetchUser', () => {
  it('returns an object with the correct id', async () => {
    const user = await fetchUser(1)
    expect(user.id).toBe(1)
  })

  it('returns a name that includes the id', async () => {
    const user = await fetchUser(7)
    expect(user.name).toBe('User 7')
  })

  it('resolves (is a Promise)', () => {
    const result = fetchUser(3)
    expect(result).toBeInstanceOf(Promise)
  })
})

// ---------------------------------------------------------------------------
// processItems
// ---------------------------------------------------------------------------
describe('processItems', () => {
  it('sums the value property of each item', () => {
    const items = [{ value: 10 }, { value: 20 }, { value: 30 }]
    expect(processItems(items)).toBe(60)
  })

  it('returns 0 for an empty array', () => {
    expect(processItems([])).toBe(0)
  })

  it('handles a single item', () => {
    expect(processItems([{ value: 5 }])).toBe(5)
  })

  it('handles items with decimal values', () => {
    const items = [{ value: 1.5 }, { value: 2.5 }]
    expect(processItems(items)).toBeCloseTo(4, 5)
  })
})

// ---------------------------------------------------------------------------
// fibonacci
// ---------------------------------------------------------------------------
describe('fibonacci', () => {
  it('returns 0 for n = 0', () => {
    expect(fibonacci(0)).toBe(0)
  })

  it('returns 1 for n = 1', () => {
    expect(fibonacci(1)).toBe(1)
  })

  it('returns 1 for n = 2', () => {
    expect(fibonacci(2)).toBe(1)
  })

  it('returns correct values for larger n', () => {
    expect(fibonacci(10)).toBe(55)
    expect(fibonacci(15)).toBe(610)
    expect(fibonacci(20)).toBe(6765)
  })

  it('throws an error for negative input', () => {
    expect(() => fibonacci(-1)).toThrow('Input must be a non-negative integer')
  })
})
