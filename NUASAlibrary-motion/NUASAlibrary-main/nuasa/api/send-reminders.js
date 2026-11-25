// NUASA Library: reminder emails sent through Resend.
// Put this file inside a folder named "api" in your project.

module.exports = async (req, res) => {
  // Only allow Vercel's cron (or you, with the secret) to run this
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).send("Unauthorized");
  }

  // FOR TESTING: put ONLY your own email here.
  // Later we will replace this list with your real students.
  const students = [
    { name: "Your Name", email: "uetim0069@gmail.com" },
  ];

  let sent = 0;
  const errors = [];

  for (const s of students) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "NUASA Library <reminders@agrochainafrica.ng>",
        reply_to: "YOUR_NUASA_GMAIL@gmail.com",
        to: s.email,
        subject: "Your QuickBooks masterclass is waiting",
        html: `<p>Hi ${s.name},</p>
               <p>Finish your lessons to earn your NUASA certificate.</p>
               <p><a href="https://nuasalibrary.vercel.app">Continue learning</a></p>`,
      }),
    });

    if (response.ok) {
      sent++;
    } else {
      errors.push({ email: s.email, error: await response.text() });
    }
  }

  res.status(200).json({ sent, errors });
};
