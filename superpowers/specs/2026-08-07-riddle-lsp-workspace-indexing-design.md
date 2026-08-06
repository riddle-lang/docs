# Riddle LSP Workspace Indexing and Advanced Navigation Design

**Status:** Approved

**Date:** 2026-08-07

## Goal

Add rust-analyzer-style workspace behavior to `riddle-lsp`:

- manage multiple workspace folders and discover every Clue project;
- maintain reusable in-memory indexes for workspace symbols and semantic relations;
- offer public, dependency-reachable symbols with automatic imports;
- add declaration/type-definition, call-hierarchy, and type-hierarchy navigation.

The compiler remains the single source of semantic truth. The LSP must reuse Clue project loading, HIR, the scope graph, type-check results, and source maps rather than implement a second resolver.

## Non-goals

- A persistent on-disk index database.
- Registry, version, or Git dependencies that Clue cannot load.
- Speculative runtime dispatch edges for function pointers, closures, or trait implementations.
- Reformatting, sorting, grouping, or merging existing `use` trees.
- Function-call snippets. Existing bare-name insertion remains unchanged.

## Workspace Lifecycle

`Backend` will own a shared workspace state containing normalized workspace roots, discovered project roots, file-to-project membership, and immutable project-index snapshots.

Initialization reads all `workspaceFolders`, falling back to `rootUri`. The server advertises workspace-folder support and handles `workspace/didChangeWorkspaceFolders`. Adding a folder starts discovery and index warming; removing one drops projects that are no longer covered by another root.

Project discovery recursively searches for `Clue.toml` using the standard library. It skips generated or external trees named `.git`, `.clue`, `target`, `node_modules`, and `dist`. Nested manifests are independent projects and canonicalized paths prevent duplicates. Clue still decides which source files and path dependencies belong to each project.

Workspace indexing starts after `initialized` and must not block the initialize response. Until an index is ready, a request falls back to the existing on-demand project analysis. A standalone open `.rid` file outside every Clue project keeps the current ephemeral analysis path and is not inserted into the workspace index.

## Index Model

Each project index is an immutable snapshot associated with the successful `ProjectSession::revision()` that produced it. It contains only data needed by LSP queries:

- symbol identity, kind, visibility, source location, owning package, and display detail;
- every public import route, including public re-exports;
- direct static call edges and their source ranges;
- trait supertype, subtype, and implementation relations;
- reverse file membership for targeted invalidation.

Symbol identity must not use HIR arena IDs because those change after re-analysis. Protocol items instead carry a serializable key derived from the normalized project root, source path, declaration range, and symbol kind. A stale hierarchy request re-resolves that key against the current snapshot; if the declaration no longer exists, it returns an empty result.

The index is memory-only and uses ordinary maps and vectors. There is no extra database or query framework. A project snapshot is replaced atomically only after a complete successful analysis, so concurrent requests never observe a partially rebuilt index.

## Invalidation and Concurrency

Open documents remain overlays passed into `ProjectSession`; they take precedence over disk content. A successful overlay analysis can publish a new index revision, so completion and navigation reflect unsaved changes.

Watched `.rid` changes invalidate every indexed project whose Clue-loaded file set contains the changed file. A `Clue.toml` create, change, or delete reruns discovery for its workspace root and invalidates affected projects and dependants. Dynamic workspace-folder changes use the same discovery path.

Every rebuild captures a project generation number. Its result is installed only if that generation is still current; otherwise it is discarded. Existing request-revision cancellation remains responsible for dropping stale per-document results. The current separate analysis lanes for diagnostics, completion, and editor features remain intact so a slow request does not serialize unrelated features; they share only immutable index snapshots.

Discovery or indexing errors are logged and retained per project without clearing the last valid snapshot. When no valid snapshot exists, requests use current on-demand behavior and return no speculative results.

## Automatic Import and Completion

Auto-import candidates come from the current project and its Clue-reachable path dependencies and standard packages. Unrelated projects in another workspace folder are indexed for their own requests but are not offered as imports.

For an unqualified value or type completion, the server:

1. collects normal visible completions first;
2. looks up public indexed symbols with the requested prefix;
3. removes symbols already visible, already imported, private, or unreachable from the current package;
4. chooses the shortest public route for each declaration, breaking equal-length ties lexically;
5. emits separate candidates when the same label resolves to different declarations.

Auto-import candidates retain the normal label and bare identifier insertion. `labelDetails.description` shows the import path, while `sortText` ranks locals, members, visible globals, and then auto-imports. `filterText` remains the unqualified label. No snippets are introduced.

The completion item carries one eager `additionalTextEdit` containing a standalone `use path;` declaration. The insertion point is computed from the parsed top-level item structure:

- after the existing leading `use` block when one exists;
- otherwise before the first top-level item's attached attributes, while leaving detached file-header comments above the new import;
- with the document's existing line ending;
- with no edit when an equivalent import already exists.

The implementation deliberately does not merge braces or reorder existing imports. That behavior can be added later as a separate organize-imports feature.

## Advanced Navigation

### Declaration and Type Definition

`textDocument/declaration` uses the same resolved source declaration as go-to-definition for Riddle symbols.

`textDocument/typeDefinition` resolves the inferred or declared type of an expression, binding, field, parameter, or return value and navigates to the nominal struct, enum, trait, or type-alias declaration. Primitive, tuple, function, reference, and unresolved types return no location unless they contain a single navigable nominal type.

### Call Hierarchy

The server advertises `callHierarchyProvider` and implements prepare, incoming, and outgoing requests for functions and methods.

Call edges are source-level and static:

- a resolved free-function or inherent-method call points to that concrete declaration;
- a trait method call points to the trait method declaration, matching rust-analyzer behavior;
- concrete implementations remain available through go-to-implementation;
- known named function values may produce an edge when the type checker identifies the declaration;
- indirect calls whose runtime target is not statically known produce no synthetic edge.

Incoming calls are grouped by caller and contain all call-site ranges. Outgoing calls are grouped by target and contain all ranges relative to the selected caller. Calls from unopened files and path dependencies participate through the project index.

### Type Hierarchy

The hierarchy accepts traits, structs, and enums:

- a trait's supertypes are its declared supertraits;
- a trait's subtypes are direct child traits and concrete structs/enums that implement it;
- a struct or enum's supertypes are the traits it directly implements;
- structs and enums have no concrete subtypes because Riddle has no class inheritance.

Only direct relations are returned per request; the client builds the transitive tree by issuing further requests. Generic instantiations are deduplicated to the declaring nominal type.

`tower-lsp` exposes the type-hierarchy request handlers, but `lsp-types 0.94.1` has no static `ServerCapabilities` field for the provider. The server therefore dynamically registers `textDocument/prepareTypeHierarchy` when the client advertises type-hierarchy dynamic registration. Call hierarchy uses the normal static capability.

## Protocol and Failure Behavior

All locations and edits continue to use UTF-16 conversion and `SourceMap` mapping. Hierarchy item `data` is treated as untrusted client input: malformed keys return `invalid_params`, while well-formed but stale keys return an empty result.

Cancelled or superseded indexing must not publish results. A malformed project or dependency logs a warning, leaves other workspace projects usable, and does not crash the language server. Removing a workspace folder drops its snapshots and cancels pending work through generation invalidation.

## Verification

Behavior tests will cover:

- multi-root discovery, nested projects, ignored directories, dynamic add/remove, and standalone files;
- targeted `.rid` invalidation, manifest topology changes, shared path dependencies, stale background generations, and unsaved overlays;
- auto-import visibility, dependency reachability, shortest public re-export paths, collisions, duplicate imports, CRLF insertion, and stable ranking;
- declaration and inferred type-definition navigation across files;
- direct, method, repeated, cross-file, dependency, trait, and unknown-indirect call hierarchy cases;
- supertraits, child traits, implementations, concrete supertypes, generic deduplication, and stale type-hierarchy items;
- initialize capabilities and real stdio request/response behavior.

The final gates are the focused Riddle LSP tests, the root `riddle_lsp` integration target, protocol smoke, formatting, strict Clippy, full workspace tests, and documentation build.
