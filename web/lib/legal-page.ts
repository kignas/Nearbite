/* ================================================================
   EATSWADA — LEGAL PAGE RUNTIME  (legal.html inline script)
   ----------------------------------------------------------------
   Verbatim port of legal.html's second inline <script>: it stamps the page
   title, the effective / last-updated dates and the entity block into the
   placeholder elements. Same ids, same values, same strings.

   The legacy script ran at parse time (after the markup). This is called from
   a `useEffect` in the shell, which runs after the DOM is painted — the ids
   already exist, so the same nodes get the same text.
   ================================================================ */

export function installLegalPage(): void {
  const APP_NAME = "Eatswada";
  const LEGAL_ENTITY_NAME = "Kingas Yor";
  const LEGAL_ADDRESS = "Maynaguri, West Bengal, India";
  const POLICY_EFFECTIVE_DATE = "September 26, 2026";
  const POLICY_LAST_UPDATED = "September 26, 2026";

  const set = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set("pageTitleText", APP_NAME + " Policies");
  set("effectiveDate", POLICY_EFFECTIVE_DATE);
  set("lastUpdatedDate", POLICY_LAST_UPDATED);
  set("entityName", LEGAL_ENTITY_NAME);
  set("entityAddress", LEGAL_ADDRESS);
  set(
    "entityAvatar",
    LEGAL_ENTITY_NAME.trim().charAt(0).toUpperCase() || "N"
  );
  set(
    "footerDates",
    "Effective " + POLICY_EFFECTIVE_DATE + " · Last updated " + POLICY_LAST_UPDATED
  );
}
