import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import * as nodemailer from "nodemailer";

const FROM = process.env.SES_FROM_EMAIL || "no-reply@lead2.app";
const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private ses = process.env.SES_REGION
    ? new SESClient({ region: process.env.SES_REGION })
    : null;

  // Fallback SMTP for local dev (set SMTP_URL=smtp://user:pass@host:port)
  private smtp = process.env.SMTP_URL
    ? nodemailer.createTransport(process.env.SMTP_URL)
    : null;

  private async send(to: string, subject: string, html: string) {
    if (!this.ses && !this.smtp) {
      this.logger.warn(`[MAIL] No transport configured. Would send to ${to}: ${subject}`);
      return;
    }
    try {
      if (this.ses) {
        await this.ses.send(
          new SendEmailCommand({
            Source: FROM,
            Destination: { ToAddresses: [to] },
            Message: {
              Subject: { Data: subject },
              Body: { Html: { Data: html } },
            },
          }),
        );
      } else if (this.smtp) {
        await this.smtp.sendMail({ from: FROM, to, subject, html });
      }
    } catch (err: any) {
      this.logger.error(`[MAIL] Failed to send to ${to}: ${err.message}`);
    }
  }

  async sendPasswordReset(to: string, token: string, workspace: string) {
    const link = `${BASE_URL}/reset-password?token=${token}&workspace=${workspace}`;
    await this.send(
      to,
      "Reset your Lead2 CRM password",
      `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
        <h2 style="color:#1e293b;margin:0 0 16px">Reset your password</h2>
        <p style="color:#475569">You requested a password reset for your Lead2 CRM account in workspace <strong>${workspace}</strong>.</p>
        <a href="${link}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Reset Password</a>
        <p style="color:#94a3b8;font-size:13px">This link expires in 1 hour. If you did not request a reset, ignore this email.</p>
      </div>`,
    );
  }

  async sendWorkspaceApproved(to: string, name: string, workspace: string) {
    await this.send(
      to,
      "Your Lead2 CRM workspace is ready",
      `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
        <h2 style="color:#1e293b">Welcome to Lead2 CRM, ${name}!</h2>
        <p style="color:#475569">Your workspace <strong>${workspace}</strong> has been approved. Sign in now to get started.</p>
        <a href="${BASE_URL}/login" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Sign In</a>
      </div>`,
    );
  }

  async sendWorkspaceRejected(to: string, name: string, note: string) {
    await this.send(
      to,
      "Your Lead2 CRM request was not approved",
      `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
        <h2 style="color:#1e293b">Request not approved</h2>
        <p style="color:#475569">Hi ${name}, unfortunately your Lead2 CRM workspace request was not approved.</p>
        ${note ? `<p style="color:#64748b;font-style:italic">${note}</p>` : ""}
        <p style="color:#94a3b8;font-size:13px">Contact your Lead2 administrator if you believe this is an error.</p>
      </div>`,
    );
  }

  async sendProposalApprovalRequest(
    to: string,
    approverName: string,
    requesterName: string,
    proposalTitle: string,
    proposalId: string,
  ) {
    const link = `${BASE_URL}/proposals`;
    await this.send(
      to,
      `Proposal approval required: ${proposalTitle}`,
      `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
        <h2 style="color:#1e293b">Approval required</h2>
        <p style="color:#475569">Hi ${approverName}, <strong>${requesterName}</strong> has submitted a proposal for your approval.</p>
        <p style="color:#1e293b;font-weight:600">${proposalTitle}</p>
        <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Review Proposal</a>
      </div>`,
    );
  }

  async sendProposalDecision(
    to: string,
    ownerName: string,
    proposalTitle: string,
    approved: boolean,
    note?: string,
  ) {
    const status = approved ? "approved" : "rejected";
    const color = approved ? "#16a34a" : "#dc2626";
    await this.send(
      to,
      `Proposal ${status}: ${proposalTitle}`,
      `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
        <h2 style="color:${color}">Proposal ${status}</h2>
        <p style="color:#475569">Hi ${ownerName}, your proposal <strong>${proposalTitle}</strong> has been <strong>${status}</strong>.</p>
        ${note ? `<p style="color:#64748b;font-style:italic">Note: ${note}</p>` : ""}
        <a href="${BASE_URL}/proposals" style="display:inline-block;background:#475569;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">View Proposals</a>
      </div>`,
    );
  }

  async sendTaskDueReminder(to: string, userName: string, taskTitle: string, dueAt: string) {
    await this.send(
      to,
      `Task due soon: ${taskTitle}`,
      `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
        <h2 style="color:#d97706">Task due soon</h2>
        <p style="color:#475569">Hi ${userName}, you have a task due <strong>${dueAt}</strong>.</p>
        <p style="color:#1e293b;font-weight:600">${taskTitle}</p>
        <a href="${BASE_URL}/tasks" style="display:inline-block;background:#d97706;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">View Tasks</a>
      </div>`,
    );
  }

  async sendDirectLeadEmail({
    to,
    fromName,
    fromEmail,
    replyTo,
    subject,
    bodyText,
    userSmtp,
  }: {
    to: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    subject: string;
    bodyText: string;
    userSmtp?: {
      host: string;
      port: number;
      secure?: boolean;
      user: string;
      pass: string;
    };
  }): Promise<{ messageId?: string; simulated: boolean; transport: string }> {
    const escaped = bodyText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const formattedHtml = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;max-width:600px;margin:20px 0;"><p style="margin:0 0 16px 0;">${escaped.replace(/\n\n/g, "</p><p style=\"margin:16px 0;\">").replace(/\n/g, "<br/>")}</p></div>`;

    if (userSmtp && userSmtp.host && userSmtp.user && userSmtp.pass) {
      try {
        const transporter = nodemailer.createTransport({
          host: userSmtp.host,
          port: userSmtp.port || 587,
          secure: userSmtp.secure ?? (userSmtp.port === 465),
          auth: {
            user: userSmtp.user,
            pass: userSmtp.pass,
          },
        });
        const sender = fromName ? `"${fromName}" <${fromEmail || userSmtp.user}>` : (fromEmail || userSmtp.user);
        const info = await transporter.sendMail({
          from: sender,
          to,
          replyTo: replyTo || fromEmail || userSmtp.user,
          subject,
          text: bodyText,
          html: formattedHtml,
        });
        return { messageId: info.messageId, simulated: false, transport: "custom_smtp" };
      } catch (err: any) {
        this.logger.error(`[MAIL] Failed to send via user SMTP: ${err.message}`);
        throw new BadRequestException(`Failed to send email via your SMTP settings: ${err.message}`);
      }
    }

    if (this.ses) {
      const sender = fromName ? `"${fromName}" <${FROM}>` : FROM;
      const res = await this.ses.send(
        new SendEmailCommand({
          Source: sender,
          Destination: { ToAddresses: [to] },
          ReplyToAddresses: replyTo || fromEmail ? [replyTo || fromEmail!] : undefined,
          Message: {
            Subject: { Data: subject },
            Body: {
              Text: { Data: bodyText },
              Html: { Data: formattedHtml },
            },
          },
        }),
      );
      return { messageId: res.MessageId, simulated: false, transport: "ses" };
    }

    if (this.smtp) {
      const sender = fromName ? `"${fromName}" <${FROM}>` : FROM;
      const info = await this.smtp.sendMail({
        from: sender,
        to,
        replyTo: replyTo || fromEmail,
        subject,
        text: bodyText,
        html: formattedHtml,
      });
      return { messageId: info.messageId, simulated: false, transport: "platform_smtp" };
    }

    this.logger.log(`[MAIL - SIMULATED] Sent lead email to ${to} [Subject: ${subject}]:\n${bodyText}`);
    return { simulated: true, transport: "simulated" };
  }

  async testSmtpConnection(smtp: {
    host: string;
    port: number;
    secure?: boolean;
    user: string;
    pass: string;
  }): Promise<{ success: boolean; message?: string }> {
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port || 587,
        secure: smtp.secure ?? (smtp.port === 465),
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      });
      await transporter.verify();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }
}
