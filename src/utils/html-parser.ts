import { parse, type HTMLElement } from "node-html-parser"

/**
 * Parse an HTML string into a queryable document-like object.
 * Uses node-html-parser instead of DOMParser, which is unavailable
 * in Chrome MV3 service workers.
 */
export function parseHTML(html: string): HTMLElement {
  return parse(html)
}
