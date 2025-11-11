import { getUncachableResendClient } from './resend';

/**
 * Email notification service using Resend
 * All emails are sent to admin@sebenzahub.co.za from wes.dutoit@sebenzahub.co.za
 */

const ADMIN_EMAIL = 'wes.dutoit@sebenzahub.co.za';
const FROM_EMAIL = 'admin@sebenzahub.co.za';

/**
 * Send email notification when a new user signs up
 */
export async function sendNewUserSignupEmail(user: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
}) {
  const { client } = await getUncachableResendClient();

  const userName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.email;

  const roleLabel = user.role === 'individual' ? 'Job Seeker' : 
                    user.role === 'recruiter' ? 'Recruiter' : 
                    user.role === 'business' ? 'Business' : user.role;

  const { data, error } = await client.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `New User Signup - ${roleLabel}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #79583a; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">New User Signup</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #79583a; margin-top: 0;">User Details</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Name:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${userName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Email:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${user.email}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Role:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${roleLabel}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Status:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">Profile Created</td>
            </tr>
          </table>

          <div style="margin-top: 30px; padding: 15px; background-color: #fff; border-left: 4px solid #79583a;">
            <p style="margin: 0; color: #666;">
              A new user has completed their profile setup on Sebenza Hub.
            </p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>Sebenza Hub Admin Notifications</p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error('[Email] Failed to send new user signup email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  console.log('[Email] New user signup email sent:', data?.id);
  return data;
}

/**
 * Send email notification when a user selects a pricing plan
 */
export async function sendPricingPlanSelectedEmail(subscription: {
  userEmail: string;
  userName?: string;
  planName: string;
  planTier: string;
  planInterval: string;
  priceCents: number;
}) {
  const { client } = await getUncachableResendClient();

  const priceFormatted = subscription.priceCents === 0 
    ? 'Free' 
    : `R${(subscription.priceCents / 100).toFixed(2)}`;

  const { data, error } = await client.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Pricing Plan Selected - ${subscription.planTier} (${subscription.planInterval})`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #79583a; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">Pricing Plan Selected</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #79583a; margin-top: 0;">Subscription Details</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>User:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${subscription.userName || subscription.userEmail}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Email:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${subscription.userEmail}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Plan:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${subscription.planName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Tier:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${subscription.planTier.charAt(0).toUpperCase() + subscription.planTier.slice(1)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Billing:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${subscription.planInterval === 'monthly' ? 'Monthly' : 'Annual'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Price:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #79583a; font-weight: bold;">${priceFormatted}${subscription.priceCents > 0 ? '/' + subscription.planInterval.replace('ly', '') : ''}</td>
            </tr>
          </table>

          <div style="margin-top: 30px; padding: 15px; background-color: #fff; border-left: 4px solid #79583a;">
            <p style="margin: 0; color: #666;">
              ${subscription.priceCents === 0 
                ? 'User has started with the free plan.' 
                : 'User has subscribed to a paid plan. Payment processing may be required.'}
            </p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>Sebenza Hub Admin Notifications</p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error('[Email] Failed to send pricing plan selected email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  console.log('[Email] Pricing plan selected email sent:', data?.id);
  return data;
}

/**
 * Send email notification when a recruiter completes profile setup (for admin approval)
 */
export async function sendRecruiterProfileApprovalEmail(profile: {
  email: string;
  agencyName: string;
  firstName?: string | null;
  lastName?: string | null;
  website?: string | null;
  telephone?: string | null;
  sectors: string[];
  proofUrl?: string | null;
}) {
  const { client } = await getUncachableResendClient();

  const userName = profile.firstName && profile.lastName 
    ? `${profile.firstName} ${profile.lastName}` 
    : 'Not provided';

  const { data, error } = await client.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Recruiter Profile Awaiting Approval - ${profile.agencyName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #79583a; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">Recruiter Profile Awaiting Approval</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #79583a; margin-top: 0;">Recruiter Details</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Agency Name:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${profile.agencyName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Contact Name:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${userName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Email:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${profile.email}</td>
            </tr>
            ${profile.telephone ? `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Phone:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${profile.telephone}</td>
            </tr>
            ` : ''}
            ${profile.website ? `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Website:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><a href="${profile.website}" style="color: #79583a;">${profile.website}</a></td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Industry Sectors:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${profile.sectors.length > 0 ? profile.sectors.join(', ') : 'Not specified'}</td>
            </tr>
            ${profile.proofUrl ? `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Proof URL:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><a href="${profile.proofUrl}" style="color: #79583a;" target="_blank">View Proof</a></td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Status:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><span style="background-color: #f59e0b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">PENDING VERIFICATION</span></td>
            </tr>
          </table>

          <div style="margin-top: 30px; padding: 15px; background-color: #fff; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #666; margin-bottom: 15px;">
              <strong>Action Required:</strong> Please review and verify this recruiter profile.
            </p>
            <p style="margin: 0; color: #666;">
              Log in to the admin dashboard to approve or reject this profile.
            </p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>Sebenza Hub Admin Notifications</p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error('[Email] Failed to send recruiter profile approval email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  console.log('[Email] Recruiter profile approval email sent:', data?.id);
  return data;
}
