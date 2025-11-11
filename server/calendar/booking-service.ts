/**
 * Interview Booking Service
 * 
 * High-level service for managing interview bookings:
 * - Check availability
 * - Create interviews with calendar events
 * - Reschedule/cancel interviews
 * - Send notifications
 */

import { getCalendarClientForUser } from './google-oauth';
import { createEventWithMeet, updateEvent, cancelEvent } from './google-calendar';
import { createTeamsMeeting, updateMicrosoftEvent, deleteMicrosoftEvent } from './microsoft-oauth';
import { createZoomMeeting, updateZoomMeeting, deleteZoomMeeting } from './zoom-oauth';
import { getAvailableSlots, validateSlot, type WorkingHours, type TimeSlot } from './availability';
import type { IStorage } from '../storage';
import type { InsertInterview, Interview } from '@shared/schema';

type CalendarProvider = 'google' | 'microsoft' | 'zoom';

export interface BookingRequest {
  organizationId: string;
  interviewerUserId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  jobId?: string;
  poolId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timezone?: string;
  provider?: CalendarProvider; // Which provider to use for video meeting (Google Meet, Teams, or Zoom)
}

export interface AvailabilityRequest {
  interviewerUserId: string;
  startDate: Date;
  endDate: Date;
  workingHours?: WorkingHours;
  slotInterval?: number;
  meetingDuration?: number;
  bufferMinsBefore?: number;
  bufferMinsAfter?: number;
  minNoticeHours?: number;
}

/**
 * Get available interview slots for an interviewer
 */
export async function getInterviewAvailability(
  request: AvailabilityRequest,
  storage: IStorage
): Promise<TimeSlot[]> {
  // Check which calendar providers are connected
  const googleAccount = await storage.getConnectedAccount(request.interviewerUserId, 'google');
  const microsoftAccount = await storage.getConnectedAccount(request.interviewerUserId, 'microsoft');
  
  if (!googleAccount && !microsoftAccount) {
    throw new Error('Interviewer has not connected a calendar (Google or Microsoft)');
  }
  
  // Default configuration
  const config = {
    workingHours: request.workingHours || {
      start: 9,
      end: 17,
      days: [1, 2, 3, 4, 5], // Monday-Friday
      timezone: 'Africa/Johannesburg',
    },
    slotInterval: request.slotInterval || 30,
    meetingDuration: request.meetingDuration || 60,
    bufferMinsBefore: request.bufferMinsBefore || 15,
    bufferMinsAfter: request.bufferMinsAfter || 15,
    minNoticeHours: request.minNoticeHours || 24,
  };
  
  // Get available slots from Google Calendar using the interviewer's credentials
  const slots = await getAvailableSlots(
    request.interviewerUserId,
    request.startDate,
    request.endDate,
    config,
    storage
  );
  
  return slots;
}

/**
 * Book an interview
 * 
 * 1. Validates slot is still available
 * 2. Creates calendar event with video meeting link (Google Meet, Teams, or Zoom)
 * 3. Saves interview to database
 * 4. Returns interview with meeting link
 */
export async function bookInterview(
  request: BookingRequest,
  storage: IStorage
): Promise<Interview> {
  // Determine which provider to use
  let provider: CalendarProvider;
  let account: any;
  
  if (request.provider) {
    // Use specified provider
    provider = request.provider;
    account = await storage.getConnectedAccount(request.interviewerUserId, provider);
    
    if (!account) {
      throw new Error(`Interviewer has not connected their ${provider} account`);
    }
  } else {
    // Auto-detect: prefer Google, then Microsoft, then Zoom
    const googleAccount = await storage.getConnectedAccount(request.interviewerUserId, 'google');
    const microsoftAccount = await storage.getConnectedAccount(request.interviewerUserId, 'microsoft');
    const zoomAccount = await storage.getConnectedAccount(request.interviewerUserId, 'zoom');
    
    if (googleAccount) {
      provider = 'google';
      account = googleAccount;
    } else if (microsoftAccount) {
      provider = 'microsoft';
      account = microsoftAccount;
    } else if (zoomAccount) {
      provider = 'zoom';
      account = zoomAccount;
    } else {
      throw new Error('Interviewer has not connected any calendar provider');
    }
  }
  
  // Validate slot is still available (prevents double-booking)
  const config = {
    workingHours: {
      start: 9,
      end: 17,
      days: [1, 2, 3, 4, 5],
      timezone: request.timezone || 'Africa/Johannesburg',
    },
    slotInterval: 30,
    meetingDuration: 60,
    bufferMinsBefore: 15,
    bufferMinsAfter: 15,
    minNoticeHours: 24,
  };
  
  const isAvailable = await validateSlot(
    request.interviewerUserId,
    request.startTime,
    request.endTime,
    config,
    storage
  );
  
  if (!isAvailable) {
    throw new Error('This time slot is no longer available');
  }
  
  // Create calendar event with video meeting link
  let eventId: string;
  let meetingLink: string;
  
  if (provider === 'google') {
    // Create Google Calendar event with Meet link
    const calendar = await getCalendarClientForUser(request.interviewerUserId, storage);
    
    const calendarEvent = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: request.title,
        description: request.description,
        start: {
          dateTime: request.startTime.toISOString(),
          timeZone: request.timezone || 'Africa/Johannesburg',
        },
        end: {
          dateTime: request.endTime.toISOString(),
          timeZone: request.timezone || 'Africa/Johannesburg',
        },
        attendees: [
          { email: request.candidateEmail },
          { email: account.email }, // Interviewer
        ],
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day
            { method: 'popup', minutes: 30 },
          ],
        },
      },
    });
    
    eventId = calendarEvent.data.id!;
    meetingLink = calendarEvent.data.hangoutLink || calendarEvent.data.conferenceData?.entryPoints?.[0]?.uri || '';
  } else if (provider === 'microsoft') {
    // Create Microsoft Teams meeting
    const result = await createTeamsMeeting(
      request.interviewerUserId,
      {
        subject: request.title,
        body: request.description,
        startTime: request.startTime.toISOString(),
        endTime: request.endTime.toISOString(),
        attendees: [request.candidateEmail],
        timezone: request.timezone || 'Africa/Johannesburg',
      },
      storage
    );
    
    eventId = result.eventId;
    meetingLink = result.joinUrl;
  } else if (provider === 'zoom') {
    // Create Zoom meeting
    const durationMins = Math.round((request.endTime.getTime() - request.startTime.getTime()) / (1000 * 60));
    
    const result = await createZoomMeeting(
      request.interviewerUserId,
      {
        topic: request.title,
        agenda: request.description,
        startTime: request.startTime.toISOString(),
        duration: durationMins,
        timezone: request.timezone || 'Africa/Johannesburg',
      },
      storage
    );
    
    eventId = result.meetingId;
    meetingLink = result.joinUrl;
  } else {
    throw new Error(`Unsupported calendar provider: ${provider}`);
  }
  
  if (!eventId) {
    throw new Error('Failed to create calendar event');
  }
  
  // Save interview to database
  const interview = await storage.createInterview({
    organizationId: request.organizationId,
    poolId: request.poolId || null,
    jobId: request.jobId || null,
    candidateUserId: null, // Could link if candidate is registered
    candidateName: request.candidateName,
    candidateEmail: request.candidateEmail,
    candidatePhone: request.candidatePhone || null,
    interviewerUserId: request.interviewerUserId,
    title: request.title,
    description: request.description || null,
    startTime: request.startTime,
    endTime: request.endTime,
    timezone: request.timezone || 'Africa/Johannesburg',
    provider: provider,
    providerEventId: eventId,
    meetingJoinUrl: meetingLink || null,
    location: null,
    status: 'scheduled',
    reminderSent: 0,
    feedback: null,
  });
  
  return interview;
}

/**
 * Reschedule an interview
 */
export async function rescheduleInterview(
  interviewId: string,
  newStartTime: Date,
  newEndTime: Date,
  storage: IStorage
): Promise<Interview> {
  const interview = await storage.getInterview(interviewId);
  
  if (!interview) {
    throw new Error('Interview not found');
  }
  
  if (interview.status === 'cancelled') {
    throw new Error('Cannot reschedule a cancelled interview');
  }
  
  const provider = interview.provider as CalendarProvider;
  
  // Validate new slot is available
  const account = await storage.getConnectedAccount(interview.interviewerUserId, provider);
  
  if (!account) {
    throw new Error('Interviewer calendar not connected');
  }
  
  const config = {
    workingHours: {
      start: 9,
      end: 17,
      days: [1, 2, 3, 4, 5],
      timezone: interview.timezone || 'Africa/Johannesburg',
    },
    slotInterval: 30,
    meetingDuration: 60,
    bufferMinsBefore: 15,
    bufferMinsAfter: 15,
    minNoticeHours: 2, // Less strict for rescheduling
  };
  
  const isAvailable = await validateSlot(
    interview.interviewerUserId,
    newStartTime,
    newEndTime,
    config,
    storage
  );
  
  if (!isAvailable) {
    throw new Error('New time slot is not available');
  }
  
  // Update calendar event based on provider
  if (interview.providerEventId) {
    if (provider === 'google') {
      const calendar = await getCalendarClientForUser(interview.interviewerUserId, storage);
      
      await calendar.events.patch({
        calendarId: 'primary',
        eventId: interview.providerEventId,
        requestBody: {
          start: {
            dateTime: newStartTime.toISOString(),
            timeZone: interview.timezone || 'Africa/Johannesburg',
          },
          end: {
            dateTime: newEndTime.toISOString(),
            timeZone: interview.timezone || 'Africa/Johannesburg',
          },
        },
      });
    } else if (provider === 'microsoft') {
      await updateMicrosoftEvent(
        interview.interviewerUserId,
        interview.providerEventId,
        {
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString(),
          timezone: interview.timezone || 'Africa/Johannesburg',
        },
        storage
      );
    } else if (provider === 'zoom') {
      const durationMins = Math.round((newEndTime.getTime() - newStartTime.getTime()) / (1000 * 60));
      
      await updateZoomMeeting(
        interview.interviewerUserId,
        interview.providerEventId,
        {
          startTime: newStartTime.toISOString(),
          duration: durationMins,
          timezone: interview.timezone || 'Africa/Johannesburg',
        },
        storage
      );
    }
  }
  
  // Update database
  await storage.updateInterview(interviewId, {
    startTime: newStartTime,
    endTime: newEndTime,
    status: 'rescheduled',
  });
  
  const updated = await storage.getInterview(interviewId);
  return updated!;
}

/**
 * Cancel an interview
 */
export async function cancelInterview(
  interviewId: string,
  storage: IStorage
): Promise<void> {
  const interview = await storage.getInterview(interviewId);
  
  if (!interview) {
    throw new Error('Interview not found');
  }
  
  if (interview.status === 'cancelled') {
    return; // Already cancelled
  }
  
  const provider = interview.provider as CalendarProvider;
  
  // Cancel calendar event based on provider
  if (interview.providerEventId) {
    try {
      if (provider === 'google') {
        const calendar = await getCalendarClientForUser(interview.interviewerUserId, storage);
        
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: interview.providerEventId,
          sendUpdates: 'all', // Notify all attendees
        });
      } else if (provider === 'microsoft') {
        await deleteMicrosoftEvent(
          interview.interviewerUserId,
          interview.providerEventId,
          storage
        );
      } else if (provider === 'zoom') {
        await deleteZoomMeeting(
          interview.interviewerUserId,
          interview.providerEventId,
          storage
        );
      }
    } catch (err) {
      console.error('Failed to delete calendar event:', err);
      // Continue to mark as cancelled in DB even if calendar delete fails
    }
  }
  
  // Update database
  await storage.updateInterview(interviewId, {
    status: 'cancelled',
  });
}
