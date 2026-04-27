// A simple TypeScript utility module with some intentional style issues
export function calculateTax(income: number, rate: number) {
  var result = income * rate  // should use const
  return result
}

export function formatCurrency(amount: number) {
  return '$' + amount.toString()  // should use toFixed(2) and Intl
}

export async function fetchUser(id: number) {
  // TODO: implement actual fetch
  return { id, name: 'User ' + id }
}

export function processItems(items: any[]) {  // should type items
  let total = 0
  for (var i = 0; i < items.length; i++) {  // should use for..of
    total = total + items[i].value
  }
  return total
}

/**
 * Computes the nth Fibonacci number iteratively.
 * @param n - A non-negative integer index (0-based).
 * @returns The nth Fibonacci number (fibonacci(0) = 0, fibonacci(1) = 1, …).
 * @throws {Error} If n is negative.
 * @example
 *   fibonacci(0)  // → 0
 *   fibonacci(1)  // → 1
 *   fibonacci(10) // → 55
 */
export function fibonacci(n: number): number {
  if (n < 0) throw new Error('Input must be a non-negative integer')
  if (n === 0) return 0
  if (n === 1) return 1
  let a = 0, b = 1
  for (let i = 2; i <= n; i++) {
    const temp = a + b
    a = b
    b = temp
  }
  return b
}
