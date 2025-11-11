/**
 * Google Calendar Service
 * 
 * Handles all Google Calendar API interactions including:
 * - FreeBusy queries for availability
 * - Event creation with Google Meet links
 * - Event updates and cancellations
 * - Token management via Replit Connector
 */

import { google } from 'googleapis';

let connectionSettings: any;

/**
 * Get a fresh access token from Replit Connector
 * Automatically refreshes if expired
 */
async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

/**
 * Get a Google Calendar client
 * WARNING: Never cache this client - access tokens expire
 */
export async function getGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Get the connected user's email from the connector
 */
export async function getConnectedEmail(): Promise<string> {
  await getAccessToken(); // Ensure connectionSettings is loaded
  
  const email = connectionSettings?.settings?.email || 
                connectionSettings?.settings?.oauth?.user_info?.email;
  
  if (!email) {
    throw new Error('Could not determine connected email');
  }
  
  return email;
}

/**
 * FreeBusy - Check calendar availability
 * 
 * @param emails - Calendar emails to check
 * @param timeMin - Start of time range (ISO string)
 * @param timeMax - End of time range (ISO string)
 * @returns Array of busy windows for each calendar
 */
export async function getFreeBusy(
  emails: string[],
  timeMin: string,
  timeMax: string
): Promise<{ [email: string]: { start: string; end: string }[] }> {
  const calendar = await getGoogleCalendarClient();

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: emails.map(email => ({ id: email })),
    }
  });

  const busyData: { [email: string]: { start: string; end: string }[] } = {};
  
  for (const email of emails) {
    const calendarBusy = response.data.calendars?.[email]?.busy || [];
    busyData[email] = calendarBusy.map(b => ({
      start: b.start as string,
      end: b.end as string,
    }));
  }

  return busyData;
}

/**
 * Create a calendar event with Google Meet
 * 
 * @param event - Event details
 * @returns Created event with Meet link
 */
export async function createEventWithMeet(event: {
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  timezone?: string;
}): Promise<{
  id: string;
  htmlLink: string;
  hangoutLink: string | null;
  conferenceData?: any;
}> {
  const calendar = await getGoogleCalendarClient();

  const response = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1, // Required for Meet link generation
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: {
        dateTime: event.startTime,
        timeZone: event.timezone || 'Africa/Johannesburg',
      },
      end: {
        dateTime: event.endTime,
        timeZone: event.timezone || 'Africa/Johannesburg',
      },
      attendees: event.attendees.map(email => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`, // Unique request ID
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 }, // 30 mins before
        ],
      },
    },
  });

  return {
    id: response.data.id as string,
    htmlLink: response.data.htmlLink as string,
    hangoutLink: response.data.hangoutLink || null,
    conferenceData: response.data.conferenceData,
  };
}

/**
 * Update an existing calendar event
 */
export async function updateEvent(
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    attendees?: string[];
    timezone?: string;
    status?: 'confirmed' | 'tentative' | 'cancelled';
  }
): Promise<void> {
  const calendar = await getGoogleCalendarClient();

  const updateBody: any = {};
  
  if (updates.summary) updateBody.summary = updates.summary;
  if (updates.description) updateBody.description = updates.description;
  if (updates.status) updateBody.status = updates.status;
  
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
  
  if (updates.attendees) {
    updateBody.attendees = updates.attendees.map(email => ({ email }));
  }

  await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: updateBody,
  });
}

/**
 * Cancel a calendar event
 */
export async function cancelEvent(eventId: string): Promise<void> {
  const calendar = await getGoogleCalendarClient();

  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'all', // Notify all attendees
  });
}

/**
 * Get event details
 */
export async function getEvent(eventId: string): Promise<any> {
  const calendar = await getGoogleCalendarClient();

  const response = await calendar.events.get({
    calendarId: 'primary',
    eventId,
  });

  return response.data;
}

/**
 * List events in a time range
 */
export async function listEvents(
  timeMin: string,
  timeMax: string,
  maxResults: number = 50
): Promise<any[]> {
  const calendar = await getGoogleCalendarClient();

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}
