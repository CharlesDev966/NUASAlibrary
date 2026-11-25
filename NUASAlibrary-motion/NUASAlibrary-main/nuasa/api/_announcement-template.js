// Email design for the masterclass announcement.
// Kept deliberately simple and personal so Gmail is less likely to file it under Promotions.
// Edit the text here. Add more courses to the COURSES list when you have them.

const SITE = "https://nuasalibrary.vercel.app";
const LOGO_URL = `${SITE}/logo.jpg`; // the logo file must be uploaded to your site (see instructions)

const COURSES = [
  {
    title: "QuickBooks Online Masterclass",
    blurb: "Learn to keep a business's books from scratch, with short step-by-step video lessons.",
    points: [
      "6 modules and 24 short lessons",
      "Company setup, sales, expenses and banking",
      "Inventory, payroll, reports and year end",
      "Practise on a test company, so no real data is needed",
    ],
  },
  // To add another course, copy the block above and change the text.
];

const esc = (s) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = function buildEmail(name) {
  const subject = "New masterclass courses on NUASA Library";
  const first = String(name || "").trim().split(" ")[0] || "there";

  const courseHtml = COURSES.map(
    (c) => `
      <p style="margin:0 0 6px 0;"><b>${esc(c.title)}</b></p>
      <p style="margin:0 0 10px 0;">${esc(c.blurb)}</p>
      <ul style="margin:0 0 18px 0;padding:0 0 0 20px;">
        ${c.points.map((p) => `<li style="margin:0 0 4px 0;">${esc(p)}</li>`).join("")}
      </ul>`
  ).join("");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:540px;">
  <img src="${LOGO_URL}" width="72" height="72" alt="NUASA UNIUYO" style="display:block;border:0;margin:0 0 16px 0;">
  <p style="margin:0 0 14px 0;">Hi ${esc(first)},</p>
  <p style="margin:0 0 14px 0;">We have added masterclass courses to the NUASA Library. They are practical, step-by-step lessons you can follow at your own pace, from your phone or laptop.</p>
  ${courseHtml}
  <p style="margin:0 0 14px 0;">You can open them anytime here: <a href="${SITE}">${SITE.replace("https://", "")}</a></p>
  <p style="margin:0 0 14px 0;">If you have any question, just reply to this email.</p>
  <p style="margin:0 0 22px 0;">Regards,<br>NUASA Library, UNIUYO</p>
  <p style="margin:0;font-size:12px;color:#777;">You are receiving this because you have an account on NUASA Library. If you would rather not get these messages, just reply and tell us.</p>
</div>`;

  const text = [
    `Hi ${first},`,
    "",
    "We have added masterclass courses to the NUASA Library. They are practical, step-by-step lessons you can follow at your own pace, from your phone or laptop.",
    "",
    ...COURSES.flatMap((c) => [c.title, c.blurb, ...c.points.map((p) => `- ${p}`), ""]),
    `Open them anytime here: ${SITE}`,
    "",
    "If you have any question, just reply to this email.",
    "",
    "Regards,",
    "NUASA Library, UNIUYO",
    "",
    'You are receiving this because you have an account on NUASA Library. If you would rather not get these messages, just reply and tell us.',
  ].join("\n");

  return { subject, html, text };
};
