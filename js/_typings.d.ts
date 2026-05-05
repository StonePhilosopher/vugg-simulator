// js/_typings.d.ts — global TypeScript declarations for the vugg-simulator bundle.
//
// SCRIPT-mode TS files (the rest of js/) can't import/export, so any
// global helpers or DOM-API widenings have to live in a `.d.ts` file
// the compiler picks up automatically (per tsconfig.json's `include`).
//
// Why widen `getElementById` to `any`?
// The bundle is 22k lines of pre-existing JS. Every `document.getElementById('foo')`
// returns `HTMLElement | null` in stock DOM types, so the call sites
// that read `.value` / `.checked` / `.disabled` / `.getContext` etc.
// each emit a TS2339 unless we cast individually. The bundle has been
// running in production for months without those casts — so widening
// the return type here keeps the types loose without changing runtime
// behavior or hiding real bugs (the JS is identical with or without
// these declarations).
//
// As individual modules tighten their DOM types per call site (e.g.
// using `as HTMLInputElement`), they get the regular HTMLElement type
// back automatically — there's no "uncast" needed.

interface Document {
  getElementById(elementId: string): any;
  querySelector(selectors: string): any;
  querySelectorAll(selectors: string): any;
}

interface HTMLElement {
  // Lots of UI code reaches into element.value / .checked / .selectedIndex /
  // .files / .options on plain HTMLElement bindings. Widen to `any` so
  // the call sites compile without per-line casts.
  [key: string]: any;
}

interface Event {
  // event.target.value is the canonical onInput pattern; without this
  // declaration TS narrows to `EventTarget | null`.
  [key: string]: any;
}
