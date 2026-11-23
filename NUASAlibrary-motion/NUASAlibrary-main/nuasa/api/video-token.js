/* GET /api/video-token?course=XL-4821&file=01-opening-excel.mp4
   Needs the student's Supabase sign-in (Authorization: Bearer <access token>).
   Returns a short-lived link to the video in the private R2 bucket, only if the student has paid (or is an admin).
   Free previews (no sign-in needed): files whose name starts with "preview-", or listed in the FREE_PREVIEW_FILES env var (comma separated). */
const { SB_URL, SB_SERVICE, SRV, fail, ok, getUser } = require("../lib/sb");
const { presignGet } = require("../lib/r2");

const EXPIRES = parseInt(process.env.VIDEO_LINK_SECONDS || "14400", 10); // 4 hours
const FREE = new Set((process.env.FREE_PREVIEW_FILES || "").split(",").map(x => x.trim()).filter(Boolean));

module.exports = async (req, res) => {
  if (req.method !== "GET") return fail(res, 405, "Use GET.");
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !SB_SERVICE) return fail(res, 500, "Video service is not configured yet.");

  const course = String((req.query && req.query.course) || "");
  const file = String((req.query && req.query.file) || "");
  if (!/^[A-Z]{2}-\d{4}$/.test(course)) return fail(res, 400, "Bad course.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,120}\.mp4$/.test(file) || file.includes("..")) return fail(res, 400, "Bad file.");

  const sign = () => presignGet({ accountId: R2_ACCOUNT_ID, bucket: R2_BUCKET, key: course + "/" + file, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, expires: EXPIRES });

  if (file.startsWith("preview-") || FREE.has(file)) return ok(res, { url: sign(), expiresIn: EXPIRES, watermark: "" });

  const user = await getUser(req);
  if (!user) return fail(res, 401, "Please sign in.");

  const q = id => `${SB_URL}/rest/v1/${id}`;
  const [enr, prof] = await Promise.all([
    fetch(q(`enrollments?user_id=eq.${user.id}&course_code=eq.${course}&select=expires_at&limit=1`), { headers: SRV(SB_SERVICE) }),
    fetch(q(`profiles?id=eq.${user.id}&select=role&limit=1`), { headers: SRV(SB_SERVICE) })
  ]);
  const e = enr.ok ? await enr.json() : [], p = prof.ok ? await prof.json() : [];
  const active = e.length > 0 && (!e[0].expires_at || new Date(e[0].expires_at) > new Date());
  if (!active && !(p[0] && p[0].role === "admin")) return fail(res, 403, e.length ? "Your access has ended. Renew to keep watching." : "Subscribe to watch this lesson.");

  ok(res, { url: sign(), expiresIn: EXPIRES, watermark: user.email || "" });
};
