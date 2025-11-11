import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  console.log('\n🔍 RESEND CONNECTION DEBUG');
  console.log('Hostname:', hostname);
  console.log('Has X_REPLIT_TOKEN:', !!xReplitToken);

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  const data = await response.json();
  console.log('Connection API Response Status:', response.status);
  console.log('Connection API Response:', JSON.stringify(data, null, 2));
  
  connectionSettings = data.items?.[0];

  if (!connectionSettings) {
    console.error('❌ No Resend connection found in response');
    throw new Error('Resend connection not found - please set up Resend in Replit Connections');
  }

  if (!connectionSettings.settings?.api_key) {
    console.error('❌ API key missing in connection settings');
    console.log('Available settings keys:', Object.keys(connectionSettings.settings || {}));
    throw new Error('Resend API key not configured in connection');
  }

  const apiKey = connectionSettings.settings.api_key;
  const fromEmail = connectionSettings.settings.from_email;
  
  console.log('✅ API key found:', apiKey ? `${apiKey.substring(0, 7)}...` : 'MISSING');
  console.log('✅ From email:', fromEmail);
  console.log('');

  return {apiKey, fromEmail};
}

export async function getUncachableResendClient() {
  const {apiKey, fromEmail} = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: fromEmail || 'onboarding@resend.dev'
  };
}

export async function sendMagicLinkEmail(email: string, token: string) {
  // Construct the correct base URL based on environment
  let baseUrl: string;
  
  if (process.env.REPLIT_DEPLOYMENT) {
    // Production deployment - use custom PUBLIC_URL if set, otherwise use hardcoded production domain
    baseUrl = process.env.PUBLIC_URL || `https://sebenzahub.replit.app`;
  } else if (process.env.REPLIT_DEV_DOMAIN) {
    // Development workspace - use .replit.dev domain
    baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  } else {
    // Local development
    baseUrl = 'http://localhost:5000';
  }
  
  const magicLink = `${baseUrl}/auth/verify?token=${token}`;

  // Always log the magic link for debugging
  console.log('\n' + '='.repeat(80));
  console.log('🔐 MAGIC LINK');
  console.log('='.repeat(80));
  console.log(`📧 To: ${email}`);
  console.log(`🔗 Link: ${magicLink}`);
  console.log(`🌍 Environment: ${process.env.REPLIT_DEPLOYMENT ? 'Production' : process.env.REPLIT_DEV_DOMAIN ? 'Development' : 'Local'}`);
  console.log('='.repeat(80) + '\n');

  // Send actual email via Resend
  const { client, fromEmail } = await getUncachableResendClient();

  const { data, error } = await client.emails.send({
    from: fromEmail,
    to: email,
    subject: 'Sign in to Sebenza Hub',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #79583a;">Sign in to Sebenza Hub</h2>
        <p>Click the link below to sign in to your account:</p>
        <a href="${magicLink}" style="display: inline-block; background-color: #79583a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Sign In
        </a>
        <p style="color: #666; font-size: 14px;">This link will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this email, you can safely ignore it.</p>
      </div>
    `,
  });

  if (error) {
    console.error('❌ Resend API Error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  console.log('✅ Email sent successfully via Resend');
  console.log('📨 Resend Email ID:', data?.id);
  console.log('');

  return data;
}
