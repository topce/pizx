/**
 * Shared utility functions used across pizx modules.
 */

/** Extract a string message from any error-like value. */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
