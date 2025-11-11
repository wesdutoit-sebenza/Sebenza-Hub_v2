/**
 * Zoom OAuth Flow
 * 
 * Allows each recruiter to connect their Zoom account
 * for meeting creation
 */

import type { IStorage } from '../storage';
import axios from 'axios';
import { createOAuthState, verifyOAuthState } from './oauth-state';

const SCOPES = ['meeting:write:admin', 'meeting:read:admin'];
const ZOOM_OAUTH_URL = 'https://zoom.us/oauth';
const ZOOM_API_URL = 'https://api.zoom.us/v2';

/**
 * Generate authorization URL for user to consent
 */
export async function getZoomAuthUrl(userId: string, baseUrl: string): Promise<string> {
  const clientId = process.env.ZOOM_CLIENT_ID;
  
  if (!clientId) {
    throw new Error('Zoom OAuth credentials not configured');
  }
  
  const redirectUri = `${baseUrl}/api/calendar/zoom/callback`;
  
  // Generate and store state token in database
  const state = await createOAuthState(userId, 'zoom');
  
  const authUrl = new URL(`${ZOOM_OAUTH_URL}/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  
  return authUrl.toString();
}

/**
 * Handle OAuth callback and store tokens
 */
export async function handleZoomCallback(
  code: string,
  state: string,
  baseUrl: string,
  storage: IStorage
): Promise<{ success: boolean; email: string; userId: string }> {
  // Verify and consume state token from database
  const userId = await verifyOAuthState(state, 'zoom');
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Zoom OAuth credentials not configured');
  }
  
  const redirectUri = `${baseUrl}/api/calendar/zoom/callback`;
  
  // Exchange code for tokens
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const tokenResponse = await axios.post(
    `${ZOOM_OAUTH_URL}/token`,
    new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
    {
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );
  
  const { access_token, refresh_token, expires_in } = tokenResponse.data;
  
  if (!access_token) {
    throw new Error('No access token received from Zoom');
  }
  
  // Get user info
  const userResponse = await axios.get(`${ZOOM_API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  
  const email = userResponse.data.email;
  const accountId = userResponse.data.id;
  
  if (!email) {
    throw new Error('Could not get user email from Zoom');
  }
  
  // Calculate expiry
  const expiresAt = new Date(Date.now() + expires_in * 1000);
  
  // Store connection
  await storage.saveConnectedAccount({
    userId,
    provider: 'zoom',
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
export async function getZoomAccessToken(
  userId: string,
  storage: IStorage
): Promise<{ accessToken: string; email: string }> {
  const account = await storage.getConnectedAccount(userId, 'zoom');
  
  if (!account) {
    throw new Error('Zoom account not connected for this user');
  }
  
  // Check if token is expired
  const now = new Date();
  const expiresAt = account.expiresAt ? new Date(account.expiresAt) : null;
  
  if (expiresAt && expiresAt <= now && account.refreshToken) {
    // Refresh the token
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Zoom OAuth credentials not configured');
    }
    
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const tokenResponse = await axios.post(
      `${ZOOM_OAUTH_URL}/token`,
      new URLSearchParams({
        refresh_token: account.refreshToken,
        grant_type: 'refresh_token',
      }),
      {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
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
 * Disconnect Zoom account
 */
export async function disconnectZoom(
  userId: string,
  storage: IStorage
): Promise<void> {
  const account = await storage.getConnectedAccount(userId, 'zoom');
  
  if (account) {
    // Revoke token
    try {
      const clientId = process.env.ZOOM_CLIENT_ID;
      const clientSecret = process.env.ZOOM_CLIENT_SECRET;
      
      if (clientId && clientSecret) {
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        
        await axios.post(
          `${ZOOM_OAUTH_URL}/revoke`,
          new URLSearchParams({
            token: account.accessToken,
          }),
          {
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );
      }
    } catch (err) {
      console.error('Failed to revoke Zoom token:', err);
    }
    
    // Mark as inactive
    await storage.updateConnectedAccount(account.id, {
      isActive: 0,
    });
  }
}

/**
 * Create a Zoom meeting
 */
export async function createZoomMeeting(
  userId: string,
  meeting: {
    topic: string;
    agenda?: string;
    startTime: string;
    duration: number; // in minutes
    timezone?: string;
  },
  storage: IStorage
): Promise<{
  meetingId: string;
  joinUrl: string;
  password?: string;
}> {
  const { accessToken } = await getZoomAccessToken(userId, storage);
  
  const response = await axios.post(
    `${ZOOM_API_URL}/users/me/meetings`,
    {
      topic: meeting.topic,
      type: 2, // Scheduled meeting
      start_time: meeting.startTime,
      duration: meeting.duration,
      timezone: meeting.timezone || 'Africa/Johannesburg',
      agenda: meeting.agenda,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
        audio: 'both',
        auto_recording: 'none',
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  return {
    meetingId: response.data.id.toString(),
    joinUrl: response.data.join_url,
    password: response.data.password,
  };
}

/**
 * Update a Zoom meeting
 */
export async function updateZoomMeeting(
  userId: string,
  meetingId: string,
  updates: {
    startTime?: string;
    duration?: number;
    timezone?: string;
  },
  storage: IStorage
): Promise<void> {
  const { accessToken } = await getZoomAccessToken(userId, storage);
  
  const updateBody: any = {};
  
  if (updates.startTime) updateBody.start_time = updates.startTime;
  if (updates.duration) updateBody.duration = updates.duration;
  if (updates.timezone) updateBody.timezone = updates.timezone;
  
  await axios.patch(
    `${ZOOM_API_URL}/meetings/${meetingId}`,
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
 * Delete a Zoom meeting
 */
export async function deleteZoomMeeting(
  userId: string,
  meetingId: string,
  storage: IStorage
): Promise<void> {
  const { accessToken } = await getZoomAccessToken(userId, storage);
  
  await axios.delete(`${ZOOM_API_URL}/meetings/${meetingId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
