import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailPayload): Promise<void> {
  if (!to || to.endsWith('@kickoff.local')) return;
  
  try {
    await resend.emails.send({
      from: 'Kickoff App <onboarding@resend.dev>', 
      to,
      subject,
      html
    });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}
