/**
 * Google Calendar OAuth Flow
 * 
 * Allows each recruiter to connect their individual Google Calendar
 * Stores encrypted tokens per user in the database
 */

import { google } from 'googleapis';
import type { Request, Response } from 'express';
import type { IStorage } from '../storage';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
];

/**
 * Get OAuth2 client
 */
function getOAuth2Client(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }
  
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
}

/**
 * Generate authorization URL for user to consent
 */
export function getAuthorizationUrl(userId: string, baseUrl: string): string {
  const redirectUri = `${baseUrl}/api/calendar/google/callback`;
  const oauth2Client = getOAuth2Client(redirectUri);
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Get refresh token
    scope: SCOPES,
    state: userId, // Pass userId to identify who's connecting
    prompt: 'consent', // Force consent screen to get refresh token
  });
  
  return authUrl;
}

/**
 * Handle OAuth callback and store tokens
 */
export async function handleCallback(
  code: string,
  userId: string,
  baseUrl: string,
  storage: IStorage
): Promise<{ success: boolean; email: string }> {
  const redirectUri = `${baseUrl}/api/calendar/google/callback`;
  const oauth2Client = getOAuth2Client(redirectUri);
  
  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.access_token) {
    throw new Error('No access token received');
  }
  
  // Get user's email from Google
  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const email = userInfo.data.email;
  
  if (!email) {
    throw new Error('Could not get user email from Google');
  }
  
  // Store connection in database
  await storage.saveConnectedAccount({
    userId,
    provider: 'google',
    providerAccountId: email,
    email,
    scopes: SCOPES,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    isPrimary: 1, // Default to primary
    isActive: 1,
  });
  
  return { success: true, email };
}

/**
 * Get a valid access token for a user
 * Automatically refreshes if expired
 */
export async function getAccessTokenForUser(
  userId: string,
  storage: IStorage
): Promise<{ accessToken: string; email: string }> {
  const account = await storage.getConnectedAccount(userId, 'google');
  
  if (!account) {
    throw new Error('Google Calendar not connected for this user');
  }
  
  // Check if token is expired
  const now = new Date();
  const expiresAt = account.expiresAt ? new Date(account.expiresAt) : null;
  
  if (expiresAt && expiresAt <= now && account.refreshToken) {
    // Token expired, refresh it
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: account.refreshToken,
    });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Update stored tokens
    await storage.updateConnectedAccount(account.id, {
      accessToken: credentials.access_token!,
      refreshToken: credentials.refresh_token || account.refreshToken,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
    });
    
    return {
      accessToken: credentials.access_token!,
      email: account.email,
    };
  }
  
  return {
    accessToken: account.accessToken,
    email: account.email,
  };
}

/**
 * Get Google Calendar client for a specific user
 */
export async function getCalendarClientForUser(
  userId: string,
  storage: IStorage
) {
  const { accessToken } = await getAccessTokenForUser(userId, storage);
  
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });
  
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Disconnect Google Calendar for a user
 */
export async function disconnectCalendar(
  userId: string,
  storage: IStorage
): Promise<void> {
  const account = await storage.getConnectedAccount(userId, 'google');
  
  if (account) {
    // Revoke access with Google
    try {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({
        access_token: account.accessToken,
      });
      await oauth2Client.revokeCredentials();
    } catch (err) {
      console.error('Failed to revoke Google credentials:', err);
      // Continue anyway to disconnect locally
    }
    
    // Mark as inactive in database
    await storage.updateConnectedAccount(account.id, {
      isActive: 0,
    });
  }
}
