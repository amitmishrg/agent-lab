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
