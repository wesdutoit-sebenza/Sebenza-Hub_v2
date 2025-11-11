/**
 * Microsoft Teams/Outlook OAuth Flow
 * 
 * Allows each recruiter to connect their Microsoft 365 account
 * for calendar access and Teams meeting creation
 */

import type { Request, Response } from 'express';
import type { IStorage } from '../storage';
import axios from 'axios';
import { createOAuthState, verifyOAuthState } from './oauth-state';

const SCOPES = [
  'https://graph.microsoft.com/Calendars.ReadWrite',
  'https://graph.microsoft.com/OnlineMeetings.ReadWrite',
  'offline_access', // Required for refresh tokens
];

const AUTHORITY = 'https://login.microsoftonline.com/common';
const GRAPH_API = 'https://graph.microsoft.com/v1.0';

/**
 * Generate authorization URL for user to consent
 */
export async function getMicrosoftAuthUrl(userId: string, baseUrl: string): Promise<string> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  
  if (!clientId) {
    throw new Error('Microsoft OAuth credentials not configured');
  }
  
  const redirectUri = `${baseUrl}/api/calendar/microsoft/callback`;
  const scope = SCOPES.join(' ');
  
  // Generate and store state token in database
  const state = await createOAuthState(userId, 'microsoft');
  
  const authUrl = new URL(`${AUTHORITY}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('prompt', 'consent'); // Force consent for refresh token
  
  return authUrl.toString();
}

/**
 * Handle OAuth callback and store tokens
 */
export async function handleMicrosoftCallback(
  code: string,
  state: string,
  baseUrl: string,
  storage: IStorage
): Promise<{ success: boolean; email: string; userId: string }> {
  // Verify and consume state token from database
  const userId = await verifyOAuthState(state, 'microsoft');
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth credentials not configured');
  }
  
  const redirectUri = `${baseUrl}/api/calendar/microsoft/callback`;
  
  // Exchange code for tokens
  const tokenResponse = await axios.post(
    `${AUTHORITY}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: SCOPES.join(' '),
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  
  const { access_token, refresh_token, expires_in } = tokenResponse.data;
  
  if (!access_token) {
    throw new Error('No access token received from Microsoft');
  }
  
  // Get user info
  const userResponse = await axios.get(`${GRAPH_API}/me`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  
  const email = userResponse.data.userPrincipalName || userResponse.data.mail;
  const accountId = userResponse.data.id;
  
  if (!email) {
    throw new Error('Could not get user email from Microsoft');
  }
  
  // Calculate expiry
  const expiresAt = new Date(Date.now() + expires_in * 1000);
  
  // Store connection
  await storage.saveConnectedAccount({
    userId,
    provider: 'microsoft',
    providerAccountId: accountId,
    email,
    scopes: SCOPES,
    accessToken: access_token,
    refreshToken: refresh_token || null,
    expiresAt,
    isPrimary: 0,
    isActive: 1,
  });
  
  return { success: true, email, userId };
}

/**
 * Get a valid access token for a user (with auto-refresh)
 */
export async function getMicrosoftAccessToken(
  userId: string,
  storage: IStorage
): Promise<{ accessToken: string; email: string }> {
  const account = await storage.getConnectedAccount(userId, 'microsoft');
  
  if (!account) {
    throw new Error('Microsoft account not connected for this user');
  }
  
  // Check if token is expired
  const now = new Date();
  const expiresAt = account.expiresAt ? new Date(account.expiresAt) : null;
  
  if (expiresAt && expiresAt <= now && account.refreshToken) {
    // Refresh the token
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Microsoft OAuth credentials not configured');
    }
    
    const tokenResponse = await axios.post(
      `${AUTHORITY}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: account.refreshToken,
        grant_type: 'refresh_token',
        scope: SCOPES.join(' '),
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const newExpiresAt = new Date(Date.now() + expires_in * 1000);
    
    // Update stored tokens
    await storage.updateConnectedAccount(account.id, {
      accessToken: access_token,
      refreshToken: refresh_token || account.refreshToken,
      expiresAt: newExpiresAt,
    });
    
    return {
      accessToken: access_token,
      email: account.email,
    };
  }
  
  return {
    accessToken: account.accessToken,
    email: account.email,
  };
}

/**
 * Disconnect Microsoft account
 */
export async function disconnectMicrosoft(
  userId: string,
  storage: IStorage
): Promise<void> {
  const account = await storage.getConnectedAccount(userId, 'microsoft');
  
  if (account) {
    // Mark as inactive
    await storage.updateConnectedAccount(account.id, {
      isActive: 0,
    });
  }
}

/**
 * Get free/busy information from Microsoft Calendar
 */
export async function getMicrosoftFreeBusy(
  userId: string,
  startTime: string,
  endTime: string,
  storage: IStorage
): Promise<{ start: string; end: string }[]> {
  const { accessToken, email } = await getMicrosoftAccessToken(userId, storage);
  
  const response = await axios.post(
    `${GRAPH_API}/me/calendar/getSchedule`,
    {
      schedules: [email],
      startTime: { dateTime: startTime, timeZone: 'UTC' },
      endTime: { dateTime: endTime, timeZone: 'UTC' },
      availabilityViewInterval: 30,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  const scheduleItems = response.data.value?.[0]?.scheduleItems || [];
  
  return scheduleItems
    .filter((item: any) => item.status === 'busy' || item.status === 'tentative' || item.status === 'oof')
    .map((item: any) => ({
      start: item.start.dateTime,
      end: item.end.dateTime,
    }));
}

/**
 * Create a Teams meeting and calendar event
 */
export async function createTeamsMeeting(
  userId: string,
  event: {
    subject: string;
    body?: string;
    startTime: string;
    endTime: string;
    attendees: string[];
    timezone?: string;
  },
  storage: IStorage
): Promise<{
  eventId: string;
  joinUrl: string;
}> {
  const { accessToken } = await getMicrosoftAccessToken(userId, storage);
  
  // Create online meeting first
  const meetingResponse = await axios.post(
    `${GRAPH_API}/me/onlineMeetings`,
    {
      startDateTime: event.startTime,
      endDateTime: event.endTime,
      subject: event.subject,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  const joinUrl = meetingResponse.data.joinWebUrl;
  
  // Create calendar event with Teams link
  const eventResponse = await axios.post(
    `${GRAPH_API}/me/events`,
    {
      subject: event.subject,
      body: {
        contentType: 'HTML',
        content: event.body ? `${event.body}<br><br><a href="${joinUrl}">Join Teams Meeting</a>` : `<a href="${joinUrl}">Join Teams Meeting</a>`,
      },
      start: {
        dateTime: event.startTime,
        timeZone: event.timezone || 'Africa/Johannesburg',
      },
      end: {
        dateTime: event.endTime,
        timeZone: event.timezone || 'Africa/Johannesburg',
      },
      attendees: event.attendees.map(email => ({
        emailAddress: { address: email },
        type: 'required',
      })),
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  return {
    eventId: eventResponse.data.id,
    joinUrl,
  };
}

/**
 * Update a calendar event
 */
export async function updateMicrosoftEvent(
  userId: string,
  eventId: string,
  updates: {
    startTime?: string;
    endTime?: string;
    timezone?: string;
  },
  storage: IStorage
): Promise<void> {
  const { accessToken } = await getMicrosoftAccessToken(userId, storage);
  
  const updateBody: any = {};
  
  if (updates.startTime) {
    updateBody.start = {
      dateTime: updates.startTime,
      timeZone: updates.timezone || 'Africa/Johannesburg',
    };
  }
  
  if (updates.endTime) {
    updateBody.end = {
      dateTime: updates.endTime,
      timeZone: updates.timezone || 'Africa/Johannesburg',
    };
  }
  
  await axios.patch(
    `${GRAPH_API}/me/events/${eventId}`,
    updateBody,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Delete a calendar event
 */
export async function deleteMicrosoftEvent(
  userId: string,
  eventId: string,
  storage: IStorage
): Promise<void> {
  const { accessToken } = await getMicrosoftAccessToken(userId, storage);
  
  await axios.delete(`${GRAPH_API}/me/events/${eventId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
