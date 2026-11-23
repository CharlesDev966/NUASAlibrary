/* Presigned GET URLs for a private Cloudflare R2 bucket (AWS Signature V4, no npm packages needed). */
const crypto = require("crypto");
const hmac = (k, s) => crypto.createHmac("sha256", k).update(s).digest();
const hex = s => crypto.createHash("sha256").update(s).digest("hex");
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());

function presignGet({ accountId, bucket, key, accessKeyId, secretAccessKey, expires = 14400, now = new Date(), extra = {} }) {
  const host = accountId + ".r2.cloudflarestorage.com";
  const amz = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");   // 20261123T042100Z
  const day = amz.slice(0, 8), scope = day + "/auto/s3/aws4_request";
  const path = "/" + bucket + "/" + key.split("/").map(enc).join("/");
  const q = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": accessKeyId + "/" + scope,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
    "response-content-type": "video/mp4",
    ...extra
  };
  const qs = Object.keys(q).sort().map(k => enc(k) + "=" + enc(q[k])).join("&");
  const canon = ["GET", path, qs, "host:" + host + "\n", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amz, scope, hex(canon)].join("\n");
  const kSig = hmac(hmac(hmac(hmac("AWS4" + secretAccessKey, day), "auto"), "s3"), "aws4_request");
  const sig = crypto.createHmac("sha256", kSig).update(sts).digest("hex");
  return "https://" + host + path + "?" + qs + "&X-Amz-Signature=" + sig;
}
module.exports = { presignGet };
