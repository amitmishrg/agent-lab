import { fibonacci } from './demo'

// ---------------------------------------------------------------------------
// fibonacci — dedicated test suite
// ---------------------------------------------------------------------------
describe('fibonacci', () => {
  // Base cases
  describe('base cases', () => {
    it('returns 0 for n = 0', () => {
      expect(fibonacci(0)).toBe(0)
    })

    it('returns 1 for n = 1', () => {
      expect(fibonacci(1)).toBe(1)
    })

    it('returns 1 for n = 2', () => {
      expect(fibonacci(2)).toBe(1)
    })
  })

  // Sequence correctness
  describe('sequence correctness', () => {
    const expected: [number, number][] = [
      [3, 2],
      [4, 3],
      [5, 5],
      [6, 8],
      [7, 13],
      [8, 21],
      [9, 34],
      [10, 55],
    ]

    it.each(expected)('fibonacci(%i) === %i', (n, result) => {
      expect(fibonacci(n)).toBe(result)
    })
  })

  // Larger values
  describe('larger inputs', () => {
    it('returns 610 for n = 15', () => {
      expect(fibonacci(15)).toBe(610)
    })

    it('returns 6765 for n = 20', () => {
      expect(fibonacci(20)).toBe(6765)
    })

    it('returns 832040 for n = 30', () => {
      expect(fibonacci(30)).toBe(832040)
    })
  })

  // Recurrence relation: fib(n) = fib(n-1) + fib(n-2)
  describe('recurrence relation', () => {
    it('satisfies fib(n) = fib(n-1) + fib(n-2) for n in [2, 20]', () => {
      for (let n = 2; n <= 20; n++) {
        expect(fibonacci(n)).toBe(fibonacci(n - 1) + fibonacci(n - 2))
      }
    })
  })

  // Return type
  describe('return type', () => {
    it('always returns a number', () => {
      expect(typeof fibonacci(0)).toBe('number')
      expect(typeof fibonacci(5)).toBe('number')
    })
  })

  // Error handling
  describe('error handling', () => {
    it('throws for n = -1', () => {
      expect(() => fibonacci(-1)).toThrow('Input must be a non-negative integer')
    })

    it('throws for large negative values', () => {
      expect(() => fibonacci(-100)).toThrow('Input must be a non-negative integer')
    })

    it('throws an instance of Error', () => {
      expect(() => fibonacci(-1)).toThrow(Error)
    })
  })
})
