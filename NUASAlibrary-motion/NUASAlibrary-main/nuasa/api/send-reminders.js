// NUASA Library: reminder emails to real students (Supabase Auth + profiles + Resend).
// Goes in the "api" folder of your project.

const escapeHtml = (s) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

// 1) Names and roles from the profiles table
async function getProfiles() {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?select=id,full_name,role`, {
      headers: supabaseHeaders({ Range: `${from}-${from + pageSize - 1}` }),
    });
    if (!r.ok) throw new Error(`Supabase profiles error: ${await r.text()}`);
    const page = await r.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

// 2) Emails from Supabase Auth (the hidden login table)
async function getAuthUsers() {
  const users = [];
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const r = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers: supabaseHeaders() }
    );
    if (!r.ok) throw new Error(`Supabase auth error: ${await r.text()}`);
    const data = await r.json();
    const batch = data.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
  }
  return users;
}

async function getStudents() {
  const [profiles, users] = await Promise.all([getProfiles(), getAuthUsers()]);
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return users
    .filter((u) => u.email && byId.has(u.id))
    .map((u) => ({ email: u.email.trim(), name: byId.get(u.id).full_name, role: byId.get(u.id).role }))
    .filter((s) => s.role === "student"); // only students, not admins
}

module.exports = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).send("Unauthorized");
  }

  try {
    let students = await getStudents();

    // SAFETY SWITCH: if TEST_EMAIL is set in Vercel, only that address gets mail.
    // Delete the TEST_EMAIL variable when you are ready to email everyone.
    const found = students.length;
    if (process.env.TEST_EMAIL) {
      students = [{ email: process.env.TEST_EMAIL, name: "Test" }];
    }

    const messages = students.map((s) => ({
      from: "NUASA Library <reminders@agrochainafrica.ng>",
      reply_to: "nuasalibrary@gmail.com",
      to: s.email,
      subject: "Your QuickBooks masterclass is waiting",
      html: `<p>Hi ${escapeHtml(s.name) || "there"},</p>
             <p>Finish your lessons to earn your NUASA certificate.</p>
             <p><a href="https://nuasalibrary.vercel.app">Continue learning</a></p>`,
    }));

    let sent = 0;
    const errors = [];

    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const r = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      if (r.ok) sent += chunk.length;
      else errors.push(await r.text());
    }

    res.status(200).json({ found, sent, errors });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
