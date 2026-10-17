# Git Atlas Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix the confirmed Git simulation defects and split the app while retaining offline opening and existing saved sessions.

**Architecture:** Preserve the existing GitSim API and ordered classic scripts. Extract contiguous source sections by responsibility, retaining execution order and CSS cascade. Keep shared page state in the UI state module and initialize the application last.

**Tech Stack:** HTML, CSS, browser JavaScript, Node.js built-in test runner, Playwright for browser verification.

---

## Task 1: Extract Assets and Establish Portable Tests

- [x] Add `tests/structure.test.cjs`; run `node --test tests/structure.test.cjs` and verify it rejects the monolithic page.
- [x] Mechanically extract CSS and JavaScript into `assets/`, replacing inline blocks with relative links and ordered deferred scripts.
- [x] Promote the four existing engine suites into `tests/`, loading `assets/js/engine/git-sim.js` rather than `.work/engine.js`.
- [x] Run `npm --prefix tests test` and a direct-file browser smoke check. No behavioral changes in this task.

The structure check must assert external assets exist, inline executable scripts/styles are absent, and all public root files other than `index.html` are moved into documentation.

## Task 2: Repair History and Abort Semantics

- [x] Add failing tests to `tests/history-regressions.test.cjs` for all three abort operations retaining unrelated new and edited untracked files.
- [x] Add the legal multi-merge history counterexample: A(base), B(common), main reverts B and merges an A-side branch, right merges another A-side branch; assert the final merge keeps main's revert.
- [x] Fix abort restoration to restore operation-owned tracked paths without replacing unrelated worktree contents.
- [x] Select best common ancestors by ancestry, not shortest path distance; handle multiple best bases conservatively rather than silently choosing an incorrect base.
- [x] Verify the focused suite and existing engine suites.

## Task 3: Repair File, Index, and Branch Switching Semantics

- [x] Add failing tests to `tests/files-regressions.test.cjs` for rename-only staging, file/directory collisions, conflict cleanup on staged restoration, and safe dirty branch switches.
- [x] Preserve the source index blob during `mv`; validate target path prefixes in both index and worktree.
- [x] Clear restored conflict entries only when the index is restored from a resolved tree; worktree-only conflict edits still require `add`.
- [x] Carry safe local changes across switches and newly created branches, rejecting destructive staged/unstaged/untracked overlaps atomically.
- [x] Verify the focused suite and existing engine suites.

## Task 4: Repair Remote and Stash Semantics

- [x] Add failing tests to `tests/remote-regressions.test.cjs` for renamed local branches and upstreams, local reference shadowing during pull, and identical-result stash application.
- [x] Separate the push source branch from its upstream target, consistently with the simulator's documented push-to-upstream behavior.
- [x] Merge fully qualified `refs/remotes/...` references during pull.
- [x] Treat identical file results as non-conflicting during stash recovery, retaining collision protection and atomic failures.
- [x] Verify focused and existing tests, including index/worktree stash round trips.

## Task 5: Documentation, Integration, and Review

- [x] Move root documentation and the Word file into `docs/`, preserving the Word file byte-for-byte.
- [x] Update `docs/README.md` for the layout, test commands, offline requirements, and supported behavior boundaries.
- [x] Add `tests/browser.cjs` for lesson examples, persistence, command/file workflows, desktop/mobile screenshots, and overflow checks.
- [x] Run `npm --prefix tests test` and `npm --prefix tests run test:browser` against both file and HTTP loading where applicable.
- [x] Perform separate specification and quality reviews, fix important findings, and re-run verification.
- [x] Confirm root public files, unchanged saved-session schema, preserved user documents, and no unintended source loss.

## Execution Notes

Work in the existing checkout on `codex/fix-git-atlas` to retain the user's pre-existing uncommitted page. Do not reset, clean, stage, commit, or push user work. Implementation agents own non-overlapping command methods and separate regression suites; no agent may reformat the whole engine.

## Verification Record

- Extraction baseline: 46 tests passed; all extracted CSS, non-engine scripts, and page markup preserve the approved working copy.
- Final engine and structure checks: 178 tests passed, including 486 stash index/worktree round trips.
- Browser checks: 14 groups passed across direct file loading and a temporary local HTTP server; all 22 examples and 96 steps executed.
- Layout checks: four viewport sizes, both themes, no page-level horizontal overflow; screenshots are ignored under `tests/artifacts/`.
- Original-format session fixture loaded unchanged; legacy conflict abort and stash recovery passed.
- Independent specification and code-quality reviews approved after fixing stash prefix collisions and strengthening the lesson phase assertion.
- Word document SHA256 remains `742aa4dcbdea3eb7381c1c227996d03854ce04527aa79e1934b99004d1aa42b6`.
- Browser verification used installed Chrome/Chromium; Firefox and Safari were not independently exercised.
