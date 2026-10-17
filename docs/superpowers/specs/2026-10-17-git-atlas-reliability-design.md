# Git Atlas Reliability and File Layout

Approved in chat on 2026-10-17.

## Requirements

- Keep `index.html` as the only visible root file. Preserve `.gitignore`, Git metadata, and the existing `.work` directory.
- Move the README, MIT license, and existing Word document into `docs/`; do not delete user material.
- Extract styles into `assets/css/` and classic scripts into `assets/js/engine/`, `assets/js/ui/`, and `assets/js/lessons/`.
- Preserve direct `file:` opening, offline operation, the current appearance, and the `git-atlas-v1` storage format.
- Fix operation abort data loss, incorrect merge bases, `mv` staging/path handling, restored conflict state, push/pull reference selection, stash false conflicts, and overly restrictive branch switching.
- Preserve ordinary Git behavior: unrelated untracked files survive branch switches and are not owned by a branch until committed.

## Boundaries

The simulator remains an in-memory teaching model, not a networked Git implementation. File-level three-way merging and the documented command subset remain intentional limits. No framework, bundler, ES-module-only loader, or UI redesign is introduced.

## Verification

Promote the existing 44 engine checks into `tests/`. Add focused regression cases before fixing each defect. Check all executable lesson examples, old-save hydration, conflict workflows, desktop/mobile layout, and both themes in a fresh browser. No commits or pushes are part of this request.
