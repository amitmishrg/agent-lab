# Sandbox Project

A demo project used by Agent Lab to demonstrate Claude Agent SDK features.

## Files
- `demo.ts` — utility functions
- `buggy.ts` — intentionally buggy code for analysis demos
- `fibonacci.test.ts` — unit tests for the `fibonacci` function

## Functions

### `fibonacci(n: number): number`
Computes the nth Fibonacci number iteratively (0-indexed).

| n | Result |
|---|--------|
| 0 | 0 |
| 1 | 1 |
| 2 | 1 |
| 10 | 55 |
| 20 | 6765 |

**Throws** `Error` if `n` is negative.

```ts
import { fibonacci } from './demo'

fibonacci(10) // → 55
```

## TODO
- Add proper error handling
- Improve type safety
