import type { Metadata, Viewport } from "next";
import "./globals.css";
import ShellRuntime from "../components/ShellRuntime";
import ThemeIntro from "../components/ThemeIntro";

export const metadata: Metadata = {
  title: "EatSwada",
};

/* Legacy `<head>`: <meta name="color-scheme" content="light dark"> plus the
   theme-color meta that eatswada-theme.js keeps in sync (#FFFFFF / #181A1B). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: "#FFFFFF",
};

/* Verbatim port of the pre-paint inline snippet in every legacy page <head>.
   Sets `data-ew-theme` / `data-ew-header` before first paint so the previous
   theme never flashes. */
const PRE_PAINT = `(function(){try{var t=localStorage.getItem('eatswada_theme');if(t==='dark')document.documentElement.dataset.ewTheme='dark';var h=localStorage.getItem('eatswada_header_theme');var ok=['raspberry'];document.documentElement.dataset.ewHeader=ok.indexOf(h)>-1?h:'raspberry';}catch(e){document.documentElement.dataset.ewHeader='raspberry';}})();`;

/* Dark Reader is loaded only for visitors who chose dark, so everyone else
   paints the page sooner. The legacy page used `document.write` to make the
   load parser-blocking; that is illegal after parsing in React/Next and blanked
   the whole document, so this injects an ordinary
   `<script src integrity crossorigin>` element into <head> instead (same URL and
   integrity hash). `lib/theme.ts` picks it up via `script[data-ew-dark-reader]`
   and enables the theme once it loads. */
const DARK_READER_PRELOAD = `/* Dark Reader (dark mode only): load it just for visitors who chose dark, so everyone else paints the page sooner. */try{if(localStorage.getItem('eatswada_theme')==='dark'){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/darkreader@4.9.133/darkreader.js';s.integrity='sha384-AedAbrPK4eWaaSPBT+dKFGQo5T4+1QHnJe+Fc+dIDhMw1VVtmvovU4qTfPCuI3KP';s.crossOrigin='anonymous';s.setAttribute('data-ew-dark-reader','1');(document.head||document.documentElement).appendChild(s);}}catch {}`;

/* Dark-mode flash fix: no legacy stylesheet paints a dark background (only
   `eatswada-header-theme.css` redefines the `--ew-*` tokens and
   `eatswada-theme.css` sets `color-scheme`), and Dark Reader only converts the
   page after its async load — so a dark visitor saw a white flash.

   The requested `html[data-ew-theme="dark"]{background:#181A1B}` was added but
   was NOT enough: the page CSS also sets `html{background:var(--page-bg)}` AND
   `body{background:var(--page-bg)}` with `--page-bg:#FFFFFF`, and the opaque
   body background is what fills the viewport. Both lines are therefore needed;
   the second is the same rule, same colour, dark-theme-only. No other
   declaration changes. #181A1B is the dark background Dark Reader itself uses
   (eatswada-theme.js `darkSchemeBackgroundColor`), so the post-load rendering
   is unchanged. */
const DARK_BG_RULE = `html[data-ew-theme="dark"]{background:#181A1B}html[data-ew-theme="dark"] body{background:#181A1B}`;

/* The two CDN stylesheets every legacy page loads, byte-identical to
   index.html (same URLs, same integrity hashes, same crossorigin) so the
   typography and the Font Awesome icons render identically. */
const FONT_LINKS: Array<React.ComponentProps<"link">> = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "preconnect", href: "https://api.eatswada.com", crossOrigin: "anonymous" },
  { rel: "preconnect", href: "https://cdnjs.cloudflare.com" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Manrope:wght@400..800&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css",
    integrity:
      "sha384-PPIZEGYM1v8zp5Py7UjFb79S58UeqCL9pYVnVPURKEqvioPROaVAJKKLzvH2rDnI",
    crossOrigin: "anonymous",
  },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        {/* The pre-paint theme snippet and the dark-only Dark Reader loader run
            here, synchronously, before the first paint — the same position they
            occupy in every legacy <head>. Putting them in <body> (which is what
            a Next <Script strategy="beforeInteractive"> in the layout produced)
            let the white default paint first, which is the flash this fixes. */}
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT }} />
        <script dangerouslySetInnerHTML={{ __html: DARK_READER_PRELOAD }} />
        <style dangerouslySetInnerHTML={{ __html: DARK_BG_RULE }} />
        {FONT_LINKS.map((link) => (
          <link key={link.href} {...link} />
        ))}
      </head>
      <body>
        <ShellRuntime />
        <ThemeIntro />
        {children}
      </body>
    </html>
  );
}
