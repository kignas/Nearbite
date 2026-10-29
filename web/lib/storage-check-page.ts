/* ================================================================
   EATSWADA — STORAGE CHECK  (storage-check.html inline script)
   ----------------------------------------------------------------
   Line-for-line port of the inline `<script>` IIFE in storage-check.html. The
   legacy page ran it immediately; here it is called from the runtime's
   useEffect (same lifecycle point — the #out element already exists).
   ================================================================ */

const w: any = typeof window !== "undefined" ? window : undefined;

export function installStorageCheckPage(): void {
  if (!w || w.__nearbiteStorageCheck) return;
  w.__nearbiteStorageCheck = true;

  const out = document.getElementById("out")!;
  const lines: string[] = [];
  function mb(n: number) {
    return (n / 1048576).toFixed(2) + " MB";
  }
  function add(t: string) {
    lines.push(t);
    out.textContent = lines.join("\n");
  }

  (async function () {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        var e: any = await navigator.storage.estimate();
        add("== TOTAL ==");
        add("Used: " + mb(e.usage || 0));
        if (e.usageDetails) {
          Object.keys(e.usageDetails).forEach(function (k) {
            add("  " + k + ": " + mb((e.usageDetails as any)[k]));
          });
        } else {
          add("  (no breakdown available on this browser)");
        }
      }
    } catch (err: any) {
      add("estimate failed: " + err.message);
    }

    try {
      add("");
      add("== CACHE STORAGE ==");
      var names = await caches.keys();
      if (!names.length) add("  (none)");
      for (var i = 0; i < names.length; i++) {
        var c = await caches.open(names[i]);
        var reqs = await c.keys();
        var total = 0,
          opaque = 0,
          rows: Array<{ u: string; s: number }> = [];
        for (var j = 0; j < reqs.length; j++) {
          var res = await c.match(reqs[j]);
          var size = 0;
          if (res && res.type === "opaque") {
            opaque++;
          } else if (res) {
            try {
              size = (await res.clone().blob()).size;
            } catch (x) {}
          }
          total += size;
          rows.push({ u: reqs[j].url.replace(location.origin, ""), s: size });
        }
        rows.sort(function (a, b) {
          return b.s - a.s;
        });
        add(names[i] + ": " + reqs.length + " files, " + mb(total) + (opaque ? ", " + opaque + " opaque" : ""));
        rows.slice(0, 5).forEach(function (r) {
          add("    " + mb(r.s) + "  " + r.u);
        });
      }
    } catch (err: any) {
      add("cache check failed: " + err.message);
    }

    try {
      add("");
      add("== LOCAL STORAGE (biggest keys) ==");
      var keys: Array<{ k: string; n: number }> = [];
      for (var k = 0; k < localStorage.length; k++) {
        var key = localStorage.key(k) as string;
        keys.push({ k: key, n: (localStorage.getItem(key) || "").length });
      }
      keys.sort(function (a, b) {
        return b.n - a.n;
      });
      if (!keys.length) add("  (empty)");
      keys.slice(0, 8).forEach(function (r) {
        add("  " + (r.n / 1024).toFixed(1) + " KB  " + r.k);
      });
    } catch (err: any) {
      add("localStorage check failed: " + err.message);
    }

    try {
      add("");
      add("== INDEXEDDB ==");
      if (indexedDB.databases) {
        var dbs = await indexedDB.databases();
        if (!dbs.length) add("  (none)");
        dbs.forEach(function (d) {
          add("  " + d.name);
        });
      } else {
        add("  (not listable on this browser)");
      }
    } catch (err: any) {
      add("indexedDB check failed: " + err.message);
    }

    add("");
    add("Done.");
  })();
}

export default installStorageCheckPage;
