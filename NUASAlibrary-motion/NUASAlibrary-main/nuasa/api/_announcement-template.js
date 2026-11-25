// Masterclass broadcast email for NUASA Library, light theme in the clean Vercel style:
// white background, thin neutral borders, big tight headline, black pill button.
// Email apps ignore Tailwind CSS, so Tailwind's neutral palette is written as inline styles:
//   neutral-50 #fafafa | neutral-200 #e5e5e5 | neutral-500 #737373 | neutral-600 #525252
//   neutral-900 #171717 | green-600 #16a34a | amber-600 #d97706
// BEFORE SENDING: check each "status" line, because lessons are published over time.

const SITE = "https://nuasalibrary.vercel.app";
const LINK = `${SITE}/#courses`;
const LOGO_URL = `${SITE}/logo.jpg`; // upload logo.jpg to the top level of your site first

const PRICE = "₦5,000";
const OLD_PRICE = "₦8,000";

const COURSES = [
  {
    title: "Microsoft Excel",
    blurb: "From your very first click to PivotTables, dashboards and automation.",
    status: "6 lessons live, more on the way",
    live: true,
  },
  {
    title: "QuickBooks",
    blurb: "From your first company file to invoices, bank reconciliation, payroll and year-end reports.",
    status: "4 lessons live, more on the way",
    live: true,
  },
  {
    title: "Company Tax Filing with NRS",
    blurb: "Register, calculate and file: TIN, VAT, PAYE, withholding tax and company income tax on Rev360.",
    status: "First lesson live, more on the way",
    live: true,
  },
  {
    title: "ERPRev",
    blurb: "Run sales, stock, accounting and reports for a whole business, from your first log in.",
    status: "Lessons being recorded",
    live: false,
  },
  {
    title: "CAC Registration",
    blurb: "Register a business with the Corporate Affairs Commission, then keep it compliant.",
    status: "Lessons being recorded",
    live: false,
  },
];

const esc = (s) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// First name from the profile's full_name. Falls back to "there" for usernames like "uetim0070".
function firstName(name) {
  const w = String(name || "").trim().split(/\s+/)[0] || "";
  if (w.length < 2 || /\d/.test(w)) return "there";
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

function card(c, i) {
  const dot = c.live ? "#16a34a" : "#d97706";
  const num = String(i + 1).padStart(2, "0");
  return `
  <tr><td style="padding:0 0 10px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#fafafa" style="background:#fafafa;border:1px solid #e5e5e5;border-radius:12px;">
      <tr><td style="padding:18px 20px;">
        <div style="font-family:${MONO};font-size:11px;letter-spacing:0.08em;color:#737373;margin:0 0 8px 0;">MASTERCLASS ${num}</div>
        <div style="font-family:${SANS};font-size:17px;font-weight:600;letter-spacing:-0.01em;color:#171717;margin:0 0 6px 0;">${esc(c.title)}</div>
        <div style="font-family:${SANS};font-size:14px;line-height:1.55;color:#525252;margin:0 0 12px 0;">${esc(c.blurb)}</div>
        <div style="font-family:${SANS};font-size:12px;color:#525252;"><span style="color:${dot};font-size:14px;">&#9679;</span>&nbsp; ${esc(c.status)}</div>
      </td></tr>
    </table>
  </td></tr>`;
}

module.exports = function buildEmail(name) {
  const subject = "NUASA Masterclasses: Excel, QuickBooks, Tax, ERPRev and CAC";
  const first = firstName(name);

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#ffffff;">
<tr><td align="center" style="padding:28px 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

    <tr><td style="padding:0 0 28px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td>
          <img src="${LOGO_URL}" width="48" height="48" alt="NUASA" style="display:block;border:0;border-radius:10px;">
        </td>
        <td style="padding-left:12px;font-family:${SANS};font-size:15px;font-weight:600;color:#171717;letter-spacing:-0.01em;">
          NUASA Library<br><span style="font-weight:400;color:#737373;font-size:12px;">UNIUYO</span>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:0 0 14px 0;">
      <span style="display:inline-block;font-family:${MONO};font-size:11px;letter-spacing:0.08em;color:#525252;border:1px solid #e5e5e5;border-radius:99px;padding:5px 12px;">NEW &nbsp;&middot;&nbsp; 5 MASTERCLASSES</span>
    </td></tr>

    <tr><td style="font-family:${SANS};font-size:34px;line-height:1.12;font-weight:700;letter-spacing:-0.035em;color:#171717;padding:0 0 14px 0;">
      Learn the tools accountants use at work.
    </td></tr>

    <tr><td style="font-family:${SANS};font-size:16px;line-height:1.6;color:#525252;padding:0 0 26px 0;">
      Hi ${esc(first)}, short video lessons you can watch on your phone or laptop, at your own pace, from the basics to expert level.
    </td></tr>

    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${COURSES.map(card).join("")}
      </table>
    </td></tr>

    <tr><td style="padding:8px 0 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#fafafa" style="background:#fafafa;border:1px solid #e5e5e5;border-radius:12px;">
        <tr><td style="padding:20px;">
          <div style="font-family:${MONO};font-size:11px;letter-spacing:0.08em;color:#737373;margin:0 0 8px 0;">PRICING</div>
          <div style="font-family:${SANS};color:#171717;margin:0 0 14px 0;">
            <span style="font-size:30px;font-weight:700;letter-spacing:-0.03em;">${PRICE}</span>
            <span style="font-size:14px;color:#525252;"> / month per course &nbsp;</span>
            <span style="font-size:14px;color:#a3a3a3;text-decoration:line-through;">${OLD_PRICE}</span>
          </div>
          <div style="font-family:${SANS};font-size:14px;line-height:1.7;color:#525252;">
            <span style="color:#16a34a;">&#10003;</span>&nbsp; NUASA certificate of completion with a unique ID anyone can verify<br>
            <span style="color:#16a34a;">&#10003;</span>&nbsp; Free software package when you finish Excel and QuickBooks<br>
            <span style="color:#16a34a;">&#10003;</span>&nbsp; New lessons added as they are released
          </div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:26px 0 30px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td bgcolor="#171717" style="background:#171717;border-radius:8px;">
          <a href="${LINK}" style="display:inline-block;font-family:${SANS};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;padding:13px 24px;">See the masterclasses &rarr;</a>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="border-top:1px solid #e5e5e5;padding:18px 0 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:#737373;">
      NUASA Library, UNIUYO<br>
      You are receiving this because you have an account on NUASA Library. Questions? Just reply to this email.
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;

  const text = [
    `Hi ${first},`,
    "",
    "5 masterclasses are now on NUASA Library. Learn the tools accountants use at work, with short video lessons you can watch on your phone or laptop.",
    "",
    ...COURSES.flatMap((c) => [`* ${c.title} (${c.status})`, `  ${c.blurb}`, ""]),
    `${PRICE} per month per course (was ${OLD_PRICE})`,
    "- NUASA certificate of completion with a unique ID anyone can verify",
    "- Free software package when you finish Excel and QuickBooks",
    "- New lessons added as they are released",
    "",
    `See the masterclasses: ${LINK}`,
    "",
    "NUASA Library, UNIUYO",
    "Questions? Just reply to this email.",
  ].join("\n");

  return { subject, html, text };
};
