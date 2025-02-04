import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";
import { withAuth, getUserId } from "@/lib/auth/api-utils";

const feedbackSchema = z.object({
  type: z.enum(["bug", "feature", "general", "other"]),
  sourcePage: z.string().optional(),
  comment: z.string(),
  username: z.string().optional(),
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const validatedData = feedbackSchema.parse(body);

    // Get user ID if authenticated
    let userId: string | undefined;
    try {
      userId = getUserId(req);
    } catch {
      // User is not authenticated - this is fine for feedback
    }

    const { type, sourcePage, comment, username } = validatedData;

    const html = `
      <h2>New Feedback Received</h2>
      <p><strong>Type:</strong> ${type}</p>
      ${sourcePage ? `<p><strong>Source Page:</strong> ${sourcePage}</p>` : ""}
      ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ""}
      ${username ? `<p><strong>Username:</strong> @${username}</p>` : ""}
      <p><strong>Comment:</strong></p>
      <p style="white-space: pre-line">${comment}</p>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: "itsuki.kama@gmail.com",
      subject: `Favely Feedback: ${type}${username ? ` from @${username}` : ''}`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}, { requireAuth: false }); 