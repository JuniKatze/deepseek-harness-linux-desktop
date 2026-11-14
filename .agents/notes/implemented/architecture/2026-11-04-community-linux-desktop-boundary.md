# Agent Note: Community Linux desktop boundary

Status: implemented

English | [中文](2026-11-04-community-linux-desktop-boundary.zh.md)

## Problem

The community Linux package needs an independent executable, protocol, profile, user-data directory, titlebar, tray behavior, and release identity. Implementing those needs inside the client or plugin packages would make the fork diverge from upstream in the plugin tree and multiply platform-specific behavior across unrelated packages.

## Decision

Community Linux behavior stays in the Electron Desktop shell. `apps/desktop/src/desktop-distribution.mjs` owns release identity and state-directory names, `desktop-capabilities.ts` owns product capabilities shared by the main process and preload, and `main-window-content.ts` owns the distinction between shell and product documents. `LinuxDesktopFrame` implements that document interface with a titlebar document and a separate workspace `WebContentsView`.

The fork preserves upstream plugin composition and `vendor/` during upstream synchronization. Necessary cross-runtime compatibility fixes are confined to the existing owning implementation and its regression tests. Linux-only product behavior still enters only through Desktop build scripts, main-process lifecycle code, shell-owned preloads, renderer assets, tests, and Desktop documentation.

## Alternatives considered

**Modify a client plugin for the Linux titlebar.** This lost because window ownership, IPC admission, and native controls already belong to the Electron shell; putting them in a client plugin would diverge the plugin tree and couple native window behavior to Web state.

**Duplicate identity values in runtime and packaging scripts.** This lost because executable names, protocols, profile directories, package names, and user-data paths must agree across the main process, electron-builder, runtime preparation, smoke checks, and release output.

**Keep scattered `process.platform === 'linux'` checks.** This lost because product policy and implementation mechanics became indistinguishable. Explicit capabilities make update, tray, menu, and titlebar availability reviewable as one declaration.

## Consequences

The plugin tree can remain identical to upstream while the Linux distribution retains its independent state and release identity. Generic Linux packaging and shell capabilities can move upstream separately from community-specific names and documentation.

The shell owns more lifecycle state and tests. Adding a platform capability now requires updating the capability declaration and the existing Desktop tests rather than inserting another local platform branch.

## Testing

Focused tests cover the distribution values, capability matrix, main-window document ownership, Linux IPC admission, titlebar behavior, tray lifecycle, packaging configuration, and local package environment. `package:desktop:linux:x64` exercises the official build gates, runtime preparation, Office conversion, electron-builder, packaged runtime smoke, and `.deb` creation.
