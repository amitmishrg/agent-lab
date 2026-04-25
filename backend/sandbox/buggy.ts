// This file has intentional bugs for the structured output demo
export function divide(a: number, b: number) {
  return a / b  // Bug: no division by zero check
}

export function parseJSON(str: string) {
  return JSON.parse(str)  // Bug: no try/catch
}

export function getFirstItem(arr: any[]) {
  return arr[0].value  // Bug: no null/bounds check
}

export async function retryFetch(url: string, retries: number) {
  const res = await fetch(url)  // Bug: retries parameter unused
  return res.json()
}

export function calculateAge(birthYear: number) {
  return 2024 - birthYear  // Bug: hardcoded year
}
