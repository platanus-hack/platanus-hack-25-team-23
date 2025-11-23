import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

export async function getCalendarClient(accessToken: string) {
  const auth = new OAuth2Client()
  auth.setCredentials({ access_token: accessToken })
  return google.calendar({ version: 'v3', auth })
}

export async function listEvents(accessToken: string, timeMin?: string, maxResults: number = 10) {
  const calendar = await getCalendarClient(accessToken)
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin || new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  })
  return response.data.items
}

export async function createEvent(accessToken: string, event: any) {
  const calendar = await getCalendarClient(accessToken)
  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  })
  return response.data
}

export async function updateEvent(accessToken: string, eventId: string, event: any) {
  const calendar = await getCalendarClient(accessToken)
  const response = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: event,
  })
  return response.data
}

export async function deleteEvent(accessToken: string, eventId: string) {
  const calendar = await getCalendarClient(accessToken)
  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  })
  return { success: true }
}

export async function getFreeBusy(accessToken: string, timeMin: string, timeMax: string) {
  const calendar = await getCalendarClient(accessToken)
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: 'primary' }],
    },
  })
  return response.data.calendars?.primary?.busy
}
