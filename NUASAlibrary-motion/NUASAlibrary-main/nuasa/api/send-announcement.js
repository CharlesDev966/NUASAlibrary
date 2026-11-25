// One-time announcement to all students (run manually, not on a schedule).
const buildEmail = require("./_announcement-template");

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const headers = { apikey: key, ...extra };
  if (!String(key).startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

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
  const seen = new Set();
  return users
    .filter((u) => u.email && byId.has(u.id))
    .map((u) => ({ email: u.email.trim().toLowerCase(), name: byId.get(u.id).full_name, role: byId.get(u.id).role }))
    .filter((s) => s.role === "student")
    .filter((s) => (seen.has(s.email) ? false : seen.add(s.email)));
}

module.exports = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).send("Unauthorized");
  }

  try {
    let students = await getStudents();
    const found = students.length;

    // SAFETY SWITCH: while TEST_EMAIL is set in Vercel, only that address gets mail.
    if (process.env.TEST_EMAIL) {
      students = [{ email: process.env.TEST_EMAIL, name: "Test" }];
    }

    const messages = students.map((s) => {
      const { subject, html, text } = buildEmail(s.name);
      return {
        from: "NUASA Library <library@agrochainafrica.ng>",
        reply_to: "nuasalibrary@gmail.com",
        to: s.email,
        subject,
        html,
        text,
      };
    });

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

    res.status(200).json({ found, sent, errors, testMode: Boolean(process.env.TEST_EMAIL) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
