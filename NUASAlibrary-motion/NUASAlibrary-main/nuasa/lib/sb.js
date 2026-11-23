/* Shared Supabase settings (same values the existing api/project.js uses). The anon key is public by design. */
const SB_URL = process.env.SUPABASE_URL || "https://wcikankedtelqbojzjdm.supabase.co";
const SB_ANON = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjaWthbmtlZHRlbHFib2p6amRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NzQ4ODAsImV4cCI6MjEwNzQ1MDg4MH0.lo1ZscA3uVBsggtxHW9U2YPPDhQAWYa3pATioq83wQ4";
const SB_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const SRV = k => (k && k.startsWith("eyJ")) ? { apikey: k, Authorization: "Bearer " + k } : { apikey: k };
const fail = (res, code, error) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify({ error })); };
const ok = (res, body) => { res.statusCode = 200; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(body)); };
/* Returns the signed-in user for the request's Bearer token, or null. */
async function getUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_ANON, Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}
module.exports = { SB_URL, SB_ANON, SB_SERVICE, SRV, fail, ok, getUser };
