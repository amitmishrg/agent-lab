# Agent Lab — Sandbox Project

## Project Overview
This is the Agent Lab sandbox — a test workspace for demonstrating Claude Agent SDK features.
It contains TypeScript files used as targets for agent operations (read, edit, analyze, test).

## File Map
- `demo.ts` — sample TypeScript module with utility functions
- `buggy.ts` — intentionally buggy code for analysis/fix demos
- `readme.md` — sandbox project documentation
- `demo.test.ts` — tests for demo.ts
- `fibonacci.test.ts` — fibonacci function tests

## Coding Standards
- TypeScript strict mode
- Functions must have JSDoc comments
- No `any` types — use proper typing
- All new files must include a header comment with purpose

## Multi-Agent Flow Instructions

### When delegating to subagents:
- `code-reviewer`: read-only analysis of code quality, style, and maintainability
- `security-scanner`: scan for vulnerabilities, secrets, unsafe patterns
- `test-runner`: check coverage, run tests, identify missing test cases

### Orchestration rules:
1. Always read the target file(s) before making edits
2. Announce what you plan to do before doing it
3. Verify file contents after writing/editing
4. Do not delete files unless explicitly asked
5. Keep changes minimal and focused on the task

## Tool Usage Guidelines
- Prefer `Read` + `Edit` over `Write` for existing files (preserves history)
- Use `Glob` + `Grep` to explore before editing
- `Bash` is allowed for running tests (`npx ts-node`, `npx jest`)
- Do not run `rm`, `sudo`, or package installation commands

## Output Format Preferences
- When summarizing code: bullet points per file
- When reporting bugs: file name, line number, severity, fix
- When creating TODO lists: priority-ordered with time estimates
