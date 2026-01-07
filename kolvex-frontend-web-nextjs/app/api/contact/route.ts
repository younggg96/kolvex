import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.NEXT_PUBLIC_RESEND_API_KEY);

// 你接收消息的邮箱地址
// 重要：使用 Resend 免费测试域名 (onboarding@resend.dev) 时，
// 只能发送到你注册 Resend 时使用的邮箱地址！
// 如果想发送到 kolvex.ai@gmail.com，需要在 Resend 验证自己的域名
const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@kolvex.app";

export async function POST(request: NextRequest) {
  try {
    // 检查 API key 是否配置
    if (!process.env.NEXT_PUBLIC_RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return NextResponse.json(
        { error: "Email service is not configured" },
        { status: 500 }
      );
    }

    const { name, email, message } = await request.json();

    // 验证必填字段
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Please fill in all fields" },
        { status: 400 }
      );
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    console.log("Sending email to:", CONTACT_EMAIL);

    // 发送邮件
    const { data, error } = await resend.emails.send({
      from: "Kolvex Contact <support@kolvex.app>", // 使用 Resend 测试域名
      to: [CONTACT_EMAIL],
      replyTo: email,
      subject: `[Kolvex Contact] New message from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>
          
          <div style="margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>Name:</strong> ${name}</p>
            <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #374151; margin-top: 0;">Message:</h3>
            <p style="color: #4b5563; white-space: pre-wrap;">${message}</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px;">
            This email was sent from the Kolvex contact form.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: `Failed to send message: ${error.message}` },
        { status: 500 }
      );
    }

    console.log("Email sent successfully:", data);

    return NextResponse.json(
      { success: true, message: "Message sent successfully!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
