/**
 * Centralized wrapper for all Tauri command invocations.
 *
 * IMPORTANT: Never call `invoke()` directly from components or hooks.
 * All backend communication must go through this module.
 *
 * This file re-exports from domain-specific modules in `commands/`.
 * Import from here as before — all existing call sites remain valid.
 *
 * @module tauriCommands
 */

export * from "./commands/collections";
export * from "./commands/items";
export * from "./commands/play";
export * from "./commands/tags";
export * from "./commands/strategy";
export * from "./commands/steam";
export * from "./commands/system";
