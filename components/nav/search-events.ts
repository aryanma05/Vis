// Åpner søkepaletten (components/nav/CommandPalette.tsx) fra hvor som helst.
export const OPEN_SEARCH_EVENT = "vis:open-search";

export function openSearch(query = "") {
  window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT, { detail: { query } }));
}
