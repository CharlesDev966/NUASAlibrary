// Email design for the masterclass announcement.
// Edit the text here. Add more courses to the COURSES list when you have them.

const SITE = "https://nuasalibrary.vercel.app";

const COURSES = [
  {
    title: "QuickBooks Online Masterclass",
    blurb: "Learn to run a business's books from scratch, with short step-by-step video lessons.",
    points: [
      "6 modules, 24 short lessons",
      "Company setup, sales, expenses and banking",
      "Inventory, payroll, reports and year end",
      "Practise on a free test company, no real data needed",
    ],
  },
  // To add another course, copy the block above and change the text.
];

const esc = (s) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function courseCard(c) {
  const items = c.points
    .map((p) => `<li style="margin:0 0 6px 0;">${esc(p)}</li>`)
    .join("");
  return `
    <tr><td style="padding:0 0 16px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e8ee;border-radius:10px;">
        <tr><td style="padding:20px;">
          <div style="font-size:18px;font-weight:700;color:#14532d;margin:0 0 8px 0;">${esc(c.title)}</div>
          <div style="font-size:15px;color:#444;line-height:1.5;margin:0 0 12px 0;">${esc(c.blurb)}</div>
          <ul style="margin:0;padding:0 0 0 20px;font-size:14px;color:#333;line-height:1.5;">${items}</ul>
        </td></tr>
      </table>
    </td></tr>`;
}

module.exports = function buildEmail(name) {
  const subject = "New on NUASA Library: Masterclass courses";
  const first = esc(String(name || "").trim().split(" ")[0]) || "there";

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;">
        <tr><td style="background:#14532d;color:#ffffff;padding:22px 24px;border-radius:12px 12px 0 0;font-size:20px;font-weight:700;">
          NUASA Library
        </td></tr>
        <tr><td style="padding:28px 24px 8px 24px;">
          <div style="font-size:20px;font-weight:700;color:#111;margin:0 0 12px 0;">Hi ${first},</div>
          <div style="font-size:15px;color:#333;line-height:1.6;margin:0 0 20px 0;">
            We have added <b>Masterclass courses</b> to the library. They are practical, step-by-step lessons
            you can follow at your own pace, from your phone or laptop.
          </div>
        </td></tr>
        <tr><td style="padding:0 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${COURSES.map(courseCard).join("")}
          </table>
        </td></tr>
        <tr><td align="center" style="padding:8px 24px 28px 24px;">
          <a href="${SITE}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 28px;border-radius:8px;">
            Start learning
          </a>
        </td></tr>
        <tr><td style="padding:16px 24px 24px 24px;border-top:1px solid #eef0f3;font-size:12px;color:#777;line-height:1.5;">
          You are receiving this because you have an account on NUASA Library.
          Questions? Just reply to this email. If you do not want these emails, reply with "unsubscribe" and we will stop them.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
};
