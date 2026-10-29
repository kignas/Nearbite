/* ================================================================
   EATSWADA — SHARED SITE FOOTER
   ----------------------------------------------------------------
   `<footer class="ew-site-footer">`. The outer structure (`.ew-footer-inner`
   / `.ew-footer-grid` / four `.ew-footer-group`s / `.ew-footer-brand` /
   `.ew-footer-bottom`) is the same on every page; only the four link lists
   differ, and in the legacy set they differ per page (the Company /
   For customers / For restaurants / Legal groups are NOT byte-identical
   across pages). Each variant below is the exact link list of the legacy
   page(s) named, with the legacy `.html` hrefs written as the clean URLs the
   rest of the port uses — the `.html` URL 301-redirects to the clean one, so
   the link target is unchanged.

     default  about.html, food-delivery-in-maynaguri.html, support.html
     faq      faq.html            (Company has 2 links; FAQs is aria-current;
                                   For customers says "Order help"; the last
                                   group is titled "Legal")
     legal    terms.html, refund-policy.html, privacy-data.html, legal.html
     delivery delivery-areas-and-charges.html
     partnerWithUs partner-with-us.html
     orderHelp     order-help.html
     rateUs        rate-us.html   (faq-like link lists, but no aria-current)

   partner-rules.html has NO footer at all and does not render this component.

   Styled by `styles/legacy/css/eatswada-site-footer.css` (unchanged).
   ================================================================ */

type FooterLink = { href: string; text: string; current?: boolean };
type FooterGroup = { title: string; links: FooterLink[] };

const DEFAULT_GROUPS: FooterGroup[] = [
  {
    title: "Company",
    links: [
      { href: "/about", text: "About Eatswada" },
      { href: "/support", text: "Contact us" },
      { href: "mailto:hello@eatswada.com", text: "General enquiries" },
    ],
  },
  {
    title: "For customers",
    links: [
      { href: "/support", text: "Help & support" },
      { href: "/faq", text: "FAQs" },
      { href: "/order-help", text: "Order help & issue reporting" },
      { href: "/delivery-areas-and-charges", text: "Delivery areas & charges" },
      { href: "/refund-policy", text: "Refunds & cancellations" },
    ],
  },
  {
    title: "For restaurants",
    links: [
      { href: "/partner-with-us", text: "Partner with us" },
      {
        href: "mailto:hello@eatswada.com?subject=Restaurant%20enquiry",
        text: "Restaurant enquiries",
      },
    ],
  },
  {
    title: "Legal & contact",
    links: [
      { href: "/terms", text: "Terms of Service" },
      { href: "/legal#privacy", text: "Privacy Policy" },
      { href: "/privacy-data", text: "Privacy & Data" },
      { href: "/refund-policy", text: "Refund Policy" },
      { href: "mailto:support@eatswada.com", text: "support@eatswada.com" },
      { href: "mailto:hello@eatswada.com", text: "hello@eatswada.com" },
    ],
  },
];

const FAQ_GROUPS: FooterGroup[] = [
  {
    title: "Company",
    links: [
      { href: "/about", text: "About Eatswada" },
      { href: "/support", text: "Contact us" },
    ],
  },
  {
    title: "For customers",
    links: [
      { href: "/support", text: "Help & support" },
      { href: "/faq", text: "FAQs", current: true },
      { href: "/order-help", text: "Order help" },
      { href: "/delivery-areas-and-charges", text: "Delivery areas & charges" },
      { href: "/refund-policy", text: "Refunds & cancellations" },
    ],
  },
  {
    title: "For restaurants",
    links: [{ href: "/partner-with-us", text: "Partner with us" }],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", text: "Terms of Service" },
      { href: "/legal#privacy", text: "Privacy Policy" },
      { href: "/privacy-data", text: "Privacy & Data" },
    ],
  },
];

const LEGAL_GROUPS: FooterGroup[] = [
  {
    title: "Company",
    links: [
      { href: "/about", text: "About Eatswada" },
      { href: "/support", text: "Contact us" },
      { href: "mailto:hello@eatswada.com", text: "General enquiries" },
    ],
  },
  {
    title: "For customers",
    links: [
      { href: "/support", text: "Help & support" },
      { href: "/support#faq", text: "FAQs" },
      { href: "/refund-policy", text: "Refunds & cancellations" },
    ],
  },
  {
    title: "For restaurants",
    links: [
      {
        href: "mailto:hello@eatswada.com?subject=Restaurant%20partnership",
        text: "Partner with us",
      },
      {
        href: "mailto:hello@eatswada.com?subject=Restaurant%20enquiry",
        text: "Restaurant enquiries",
      },
    ],
  },
  {
    title: "Legal & contact",
    links: [
      { href: "/terms", text: "Terms of Service" },
      { href: "/legal#privacy", text: "Privacy Policy" },
      { href: "/privacy-data", text: "Privacy & Data" },
      { href: "/refund-policy", text: "Refund Policy" },
      { href: "mailto:support@eatswada.com", text: "support@eatswada.com" },
      { href: "mailto:hello@eatswada.com", text: "hello@eatswada.com" },
    ],
  },
];

const DELIVERY_GROUPS: FooterGroup[] = [
  {
    title: "Company",
    links: [
      { href: "/about", text: "About Eatswada" },
      { href: "/support", text: "Contact us" },
      { href: "mailto:hello@eatswada.com", text: "General enquiries" },
    ],
  },
  {
    title: "For customers",
    links: [
      { href: "/support", text: "Help & support" },
      { href: "/faq", text: "FAQs" },
      { href: "/refund-policy", text: "Refunds & cancellations" },
    ],
  },
  {
    title: "For restaurants",
    links: [
      { href: "/partner-with-us", text: "Partner with us" },
      {
        href: "mailto:hello@eatswada.com?subject=Restaurant%20enquiry",
        text: "Restaurant enquiries",
      },
    ],
  },
  {
    title: "Legal & contact",
    links: [
      { href: "/terms", text: "Terms of Service" },
      { href: "/legal#privacy", text: "Privacy Policy" },
      { href: "/privacy-data", text: "Privacy & Data" },
      { href: "/refund-policy", text: "Refund Policy" },
      { href: "mailto:support@eatswada.com", text: "support@eatswada.com" },
    ],
  },
];

const PARTNER_WITH_US_GROUPS: FooterGroup[] = [
  {
    title: "Company",
    links: [
      { href: "/about", text: "About Eatswada" },
      { href: "/support", text: "Contact us" },
      { href: "mailto:hello@eatswada.com", text: "General enquiries" },
    ],
  },
  {
    title: "For customers",
    links: [
      { href: "/support", text: "Help & support" },
      { href: "/support#faq", text: "FAQs" },
      { href: "/refund-policy", text: "Refunds & cancellations" },
    ],
  },
  {
    title: "For restaurants",
    links: [
      { href: "/partner-with-us", text: "Partner with us" },
      {
        href: "mailto:hello@eatswada.com?subject=Restaurant%20enquiry",
        text: "Restaurant enquiries",
      },
    ],
  },
  {
    title: "Legal & contact",
    links: [
      { href: "/terms", text: "Terms of Service" },
      { href: "/legal#privacy", text: "Privacy Policy" },
      { href: "/privacy-data", text: "Privacy & Data" },
      { href: "/refund-policy", text: "Refund Policy" },
      { href: "mailto:support@eatswada.com", text: "support@eatswada.com" },
      { href: "mailto:hello@eatswada.com", text: "hello@eatswada.com" },
    ],
  },
];

const ORDER_HELP_GROUPS: FooterGroup[] = [
  {
    title: "Company",
    links: [
      { href: "/about", text: "About Eatswada" },
      { href: "/support", text: "Contact us" },
      { href: "mailto:hello@eatswada.com", text: "General enquiries" },
    ],
  },
  {
    title: "For customers",
    links: [
      { href: "/support", text: "Help & support" },
      { href: "/faq", text: "FAQs" },
      { href: "/refund-policy", text: "Refunds & cancellations" },
    ],
  },
  {
    title: "For restaurants",
    links: [
      { href: "/partner-with-us", text: "Partner with us" },
      {
        href: "mailto:hello@eatswada.com?subject=Restaurant%20enquiry",
        text: "Restaurant enquiries",
      },
    ],
  },
  {
    title: "Legal & contact",
    links: [
      { href: "/terms", text: "Terms of Service" },
      { href: "/legal#privacy", text: "Privacy Policy" },
      { href: "/privacy-data", text: "Privacy & Data" },
      { href: "/refund-policy", text: "Refund Policy" },
      { href: "mailto:support@eatswada.com", text: "support@eatswada.com" },
    ],
  },
];

const RATE_US_GROUPS: FooterGroup[] = [
  {
    title: "Company",
    links: [
      { href: "/about", text: "About Eatswada" },
      { href: "/support", text: "Contact us" },
    ],
  },
  {
    title: "For customers",
    links: [
      { href: "/support", text: "Help & support" },
      { href: "/faq", text: "FAQs" },
      { href: "/order-help", text: "Order help" },
      { href: "/delivery-areas-and-charges", text: "Delivery areas & charges" },
      { href: "/refund-policy", text: "Refunds & cancellations" },
    ],
  },
  {
    title: "For restaurants",
    links: [{ href: "/partner-with-us", text: "Partner with us" }],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", text: "Terms of Service" },
      { href: "/legal#privacy", text: "Privacy Policy" },
      { href: "/privacy-data", text: "Privacy & Data" },
    ],
  },
];

const VARIANTS = {
  default: DEFAULT_GROUPS,
  faq: FAQ_GROUPS,
  legal: LEGAL_GROUPS,
  delivery: DELIVERY_GROUPS,
  partnerWithUs: PARTNER_WITH_US_GROUPS,
  orderHelp: ORDER_HELP_GROUPS,
  rateUs: RATE_US_GROUPS,
} as const;

export type FooterVariant = keyof typeof VARIANTS;

export default function Footer({
  variant = "default",
}: {
  variant?: FooterVariant;
}) {
  const groups: FooterGroup[] = VARIANTS[variant];
  return (
    <footer className="ew-site-footer" aria-label="Eatswada site footer">
      <div className="ew-footer-inner">
        <nav className="ew-footer-grid" aria-label="Footer navigation">
          {groups.map((group) => (
            <section className="ew-footer-group" key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href + "|" + link.text}>
                    <a
                      href={link.href}
                      {...(link.current ? { "aria-current": "page" as const } : {})}
                    >
                      {link.text}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
        <div className="ew-footer-brand" aria-label="Eatswada">
          eats<span>wada</span>
        </div>
        <div className="ew-footer-bottom">
          <p>© 2026 Eatswada. All rights reserved.</p>
          <p>Serving Maynaguri, West Bengal.</p>
        </div>
      </div>
    </footer>
  );
}
