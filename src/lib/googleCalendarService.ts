import { prisma } from "./prisma";
import { getWorkspaceAdminGoogleAccount } from "./google";

export interface TimeSlot {
  start: string; // ISO string
  end: string;   // ISO string
  displayTime: string; // e.g., "10:00 AM - 10:30 AM"
  available: boolean;
}

export interface CalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  meetLink?: string;
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  htmlLink?: string;
  status: string;
  notes?: string;
  clientPhone?: string;
  clientName?: string;
  clientEmail?: string;
  bookedByRole?: string;
}

/**
 * Accurately constructs a Date instance matching a specific local date, hour, minute in a target timeZone.
 */
function createDateInTimeZone(dateStr: string, hour: number, minute: number, timeZone: string = "UTC"): Date {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const isoCandidate = `${dateStr}T${pad(hour)}:${pad(minute)}:00`;
  const utcDate = new Date(`${isoCandidate}Z`);

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(utcDate);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || "0";

    const y = parseInt(getPart("year"), 10);
    const m = parseInt(getPart("month"), 10);
    const d = parseInt(getPart("day"), 10);
    let h = parseInt(getPart("hour"), 10);
    if (h === 24) h = 0;
    const min = parseInt(getPart("minute"), 10);

    const formattedAsUtc = Date.UTC(y, m - 1, d, h, min, 0);
    const diff = formattedAsUtc - utcDate.getTime();
    return new Date(utcDate.getTime() - diff);
  } catch (_) {
    return new Date(`${isoCandidate}Z`);
  }
}

/**
 * Formats a Date object to a readable 12-hour time string
 */
function formatTime12h(date: Date, timeZone: string = "UTC"): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(date);
}

/**
 * Fetches available booking slots for a specific date from Admin's Google Calendar & DB
 */
export async function getAdminCalendarAvailability({
  dateStr, // YYYY-MM-DD
  timeZone = "UTC",
  slotDurationMinutes = 30,
  workStartHour = 9,
  workEndHour = 18,
  preferredUserId,
}: {
  dateStr: string;
  timeZone?: string;
  slotDurationMinutes?: number;
  workStartHour?: number;
  workEndHour?: number;
  preferredUserId?: string;
}): Promise<{ date: string; timeZone: string; slots: TimeSlot[]; connected: boolean }> {
  const adminAccount = await getWorkspaceAdminGoogleAccount(preferredUserId);

  // Define start and end of the day in requested timezone
  const startOfDay = createDateInTimeZone(dateStr, 0, 0, timeZone);
  const endOfDay = createDateInTimeZone(dateStr, 23, 59, timeZone);

  let busyIntervals: { start: number; end: number }[] = [];

  // 1. Fetch free/busy and actual events from Google Calendar API if connected
  if (adminAccount) {
    try {
      // 1a. FreeBusy Query
      const freeBusyRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminAccount.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
          timeZone,
          items: [{ id: "primary" }],
        }),
      });

      if (freeBusyRes.ok) {
        const freeBusyData = await freeBusyRes.json();
        const primaryCalendar = freeBusyData.calendars?.["primary"];
        if (primaryCalendar && primaryCalendar.busy) {
          for (const b of primaryCalendar.busy) {
            busyIntervals.push({
              start: new Date(b.start).getTime(),
              end: new Date(b.end).getTime(),
            });
          }
        }
      }

      // 1b. Direct Primary Events Query (Guarantees every booked event is caught even if freeBusy is cached)
      const eventsRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startOfDay.toISOString()}&timeMax=${endOfDay.toISOString()}&singleEvents=true`,
        {
          headers: {
            Authorization: `Bearer ${adminAccount.accessToken}`,
          },
        }
      );

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        if (eventsData.items) {
          for (const ev of eventsData.items) {
            if (ev.status === "cancelled") continue;
            const evStart = new Date(ev.start?.dateTime || ev.start?.date).getTime();
            const evEnd = new Date(ev.end?.dateTime || ev.end?.date).getTime();
            if (!isNaN(evStart) && !isNaN(evEnd)) {
              busyIntervals.push({ start: evStart, end: evEnd });
            }
          }
        }
      }
    } catch (err) {
      console.warn("Could not query Google Calendar free/busy slots:", err);
    }
  }

  // 2. Query DB appointments with resilient fallback
  try {
    let dbAppointments: any[] = [];
    try {
      if ((prisma as any).appointment?.findMany) {
        dbAppointments = await (prisma as any).appointment.findMany({
          where: {
            status: { in: ["confirmed", "scheduled"] },
          },
        });
      }
    } catch (_) {
      try {
        const rawResult: any = await (prisma as any).$runCommandRaw({
          find: "Appointment",
          filter: { status: { $in: ["confirmed", "scheduled"] } },
        });
        dbAppointments = rawResult?.cursor?.firstBatch || [];
      } catch (rawErr) {
        console.warn("Raw appointment find fallback error:", rawErr);
      }
    }

    for (const appt of dbAppointments) {
      const rawStart = appt.startTime?.$date || appt.startTime;
      const rawEnd = appt.endTime?.$date || appt.endTime;
      const sTime = new Date(rawStart).getTime();
      const eTime = new Date(rawEnd).getTime();

      if (!isNaN(sTime) && !isNaN(eTime)) {
        if (sTime < endOfDay.getTime() && eTime > startOfDay.getTime()) {
          busyIntervals.push({ start: sTime, end: eTime });
        }
      }
    }
  } catch (dbErr) {
    console.warn("DB appointments lookup:", dbErr);
  }


  // 3. Generate slots based on duration in target timeZone
  const slots: TimeSlot[] = [];
  const stepMinutes = slotDurationMinutes >= 60 ? 30 : slotDurationMinutes >= 45 ? 15 : slotDurationMinutes >= 30 ? 30 : 15;
  const workEndLimit = createDateInTimeZone(dateStr, workEndHour, 0, timeZone);

  for (let hour = workStartHour; hour < workEndHour; hour++) {
    for (let minute = 0; minute < 60; minute += stepMinutes) {
      const slotStart = createDateInTimeZone(dateStr, hour, minute, timeZone);
      const slotEnd = new Date(slotStart.getTime() + slotDurationMinutes * 60 * 1000);

      if (slotEnd.getTime() > workEndLimit.getTime()) continue;

      const slotStartMs = slotStart.getTime();
      const slotEndMs = slotEnd.getTime();

      // Check if slot is in past
      const isPast = slotStartMs < Date.now();

      // Check if slot overlaps with any busy interval
      const isBusy = busyIntervals.some((busy) => {
        return Math.max(slotStartMs, busy.start) < Math.min(slotEndMs, busy.end);
      });

      const available = !isPast && !isBusy;

      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        displayTime: `${formatTime12h(slotStart, timeZone)} - ${formatTime12h(slotEnd, timeZone)}`,
        available,
      });
    }
  }

  return {
    date: dateStr,
    timeZone,
    slots,
    connected: Boolean(adminAccount),
  };
}

/**
 * Creates a meeting on Admin's Google Calendar with an automatic Google Meet link & saves to DB.
 */
export async function createAdminCalendarBooking({
  summary,
  description,
  startTime,
  endTime,
  clientName,
  clientEmail,
  clientPhone,
  timeZone = "UTC",
  bookedByRole = "client",
  bookedByEmail,
  notes,
  preferredUserId,
}: {
  summary: string;
  description?: string;
  startTime: Date | string;
  endTime: Date | string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  timeZone?: string;
  bookedByRole?: "client" | "team_member" | "admin";
  bookedByEmail?: string;
  notes?: string;
  preferredUserId?: string;
}) {
  const startDt = new Date(startTime);
  const endDt = new Date(endTime);
  const durationMinutes = Math.round((endDt.getTime() - startDt.getTime()) / (60 * 1000));

  const adminAccount = await getWorkspaceAdminGoogleAccount(preferredUserId);
  let googleEventId: string | null = null;
  let meetLink: string | null = null;

  if (adminAccount) {
    try {
      const requestId = `meet_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const eventPayload = {
        summary,
        description: description || `Booked appointment with ${clientName} (${clientEmail}).\n\nNotes: ${notes || "None"}`,
        start: {
          dateTime: startDt.toISOString(),
          timeZone,
        },
        end: {
          dateTime: endDt.toISOString(),
          timeZone,
        },
        attendees: [
          { email: clientEmail, displayName: clientName },
          ...(bookedByEmail && bookedByEmail !== clientEmail ? [{ email: bookedByEmail }] : []),
        ],
        conferenceData: {
          createRequest: {
            requestId,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: {
          useDefault: true,
        },
      };

      const eventRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminAccount.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventPayload),
        }
      );


      if (eventRes.ok) {
        const eventData = await eventRes.json();
        googleEventId = eventData.id;
        meetLink = eventData.hangoutLink || eventData.conferenceData?.entryPoints?.[0]?.uri || null;
      } else {
        const errorText = await eventRes.text();
        console.warn("Google Calendar event creation response:", eventRes.status, errorText);
      }
    } catch (gErr) {
      console.error("Failed to create Google Calendar event:", gErr);
    }
  }

  // Save to MongoDB
  let appointment: any = {

    id: `appt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    workspaceAdminId: adminAccount?.userId || "admin",
    title: summary,
    description,
    clientName,
    clientEmail,
    clientPhone,
    startTime: startDt,
    endTime: endDt,
    durationMinutes,
    timeZone,
    status: "confirmed",
    meetLink,
    googleEventId,
    notes,
    bookedByRole,
    bookedByEmail,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    if ((prisma as any).appointment?.create) {
      appointment = await (prisma as any).appointment.create({
        data: {
          workspaceAdminId: adminAccount?.userId || "admin",
          title: summary,
          description,
          clientName,
          clientEmail,
          clientPhone,
          startTime: startDt,
          endTime: endDt,
          durationMinutes,
          timeZone,
          status: "confirmed",
          meetLink,
          googleEventId,
          notes,
          bookedByRole,
          bookedByEmail,
        },
      });
    } else {
      await (prisma as any).$runCommandRaw({
        insert: "Appointment",
        documents: [appointment],
      });
    }
  } catch (dbErr) {
    console.warn("DB appointment record creation fallback:", dbErr);
  }

  return appointment;
}


/**
 * Lists upcoming workspace appointments and Google Calendar events
 */
export async function listAdminCalendarEvents({
  timeMin,
  timeMax,
  maxResults = 50,
  preferredUserId,
}: {
  timeMin?: Date | string;
  timeMax?: Date | string;
  maxResults?: number;
  preferredUserId?: string;
}): Promise<CalendarEventItem[]> {
  const adminAccount = await getWorkspaceAdminGoogleAccount(preferredUserId);
  const minDate = timeMin ? new Date(timeMin) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const maxDate = timeMax ? new Date(timeMax) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  const events: CalendarEventItem[] = [];

  // 1. Fetch from Google Calendar API
  if (adminAccount) {
    try {
      const params = new URLSearchParams({
        timeMin: minDate.toISOString(),
        timeMax: maxDate.toISOString(),
        maxResults: maxResults.toString(),
        singleEvents: "true",
        orderBy: "startTime",
      });

      const gRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${adminAccount.accessToken}` },
        }
      );


      if (gRes.ok) {
        const data = await gRes.json();
        if (data.items) {
          for (const item of data.items) {
            events.push({
              id: item.id,
              summary: item.summary || "Untitled Event",
              description: item.description,
              start: item.start?.dateTime || item.start?.date,
              end: item.end?.dateTime || item.end?.date,
              meetLink: item.hangoutLink || item.conferenceData?.entryPoints?.[0]?.uri,
              attendees: item.attendees,
              htmlLink: item.htmlLink,
              status: item.status || "confirmed",
            });
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch Google Calendar events:", err);
    }
  }

  // 2. Fetch DB Appointments to enrich Google events with notes, phone, and client details
  let dbAppts: any[] = [];
  try {
    if ((prisma as any).appointment?.findMany) {
      dbAppts = await (prisma as any).appointment.findMany({
        where: {
          startTime: { gte: minDate, lte: maxDate },
        },
        orderBy: { startTime: "asc" },
      });
    }
  } catch (dbErr) {
    console.warn("DB appointments lookup in listAdminCalendarEvents:", dbErr);
  }

  const apptMap = new Map<string, any>();
  for (const appt of dbAppts) {
    if (appt.googleEventId) apptMap.set(appt.googleEventId, appt);
    if (appt.id) apptMap.set(appt.id, appt);
  }

  // Enrich fetched Google events
  for (const event of events) {
    const matched = apptMap.get(event.id);
    let extractedNotes = matched?.notes;

    // Fallback: parse notes from Google description if not found in DB
    if (!extractedNotes && event.description) {
      const notesMatch = event.description.match(/Notes:\s*([\s\S]*)$/i);
      if (notesMatch && notesMatch[1] && notesMatch[1].trim() !== "None") {
        extractedNotes = notesMatch[1].trim();
      }
    }

    if (matched) {
      event.notes = extractedNotes || undefined;
      event.clientPhone = matched.clientPhone || undefined;
      event.clientName = matched.clientName || undefined;
      event.clientEmail = matched.clientEmail || undefined;
      event.bookedByRole = matched.bookedByRole || undefined;
      if (!event.meetLink && matched.meetLink) {
        event.meetLink = matched.meetLink;
      }
    } else if (extractedNotes) {
      event.notes = extractedNotes;
    }
  }

  // Add any DB Appointments that might not have synced to Google Calendar yet
  for (const appt of dbAppts) {
    const exists = events.some((e) => e.id === appt.googleEventId || e.id === appt.id);
    if (!exists) {
      events.push({
        id: appt.id,
        summary: appt.title,
        description: appt.description || undefined,
        start: appt.startTime instanceof Date ? appt.startTime.toISOString() : appt.startTime,
        end: appt.endTime instanceof Date ? appt.endTime.toISOString() : appt.endTime,
        meetLink: appt.meetLink || undefined,
        attendees: [
          { email: appt.clientEmail, displayName: appt.clientName },
          ...(appt.bookedByEmail ? [{ email: appt.bookedByEmail }] : []),
        ],
        status: appt.status,
        notes: appt.notes || undefined,
        clientPhone: appt.clientPhone || undefined,
        clientName: appt.clientName || undefined,
        clientEmail: appt.clientEmail || undefined,
        bookedByRole: appt.bookedByRole || undefined,
      });
    }
  }

  // Sort chronologically
  return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

/**
 * Cancels an appointment and deletes it from Google Calendar
 */
export async function cancelAdminCalendarBooking(
  appointmentId: string,
  preferredUserId?: string
) {
  let appointment: any = null;
  if ((prisma as any).appointment?.findUnique) {
    appointment = await (prisma as any).appointment.findUnique({
      where: { id: appointmentId },
    });
  }

  const adminAccount = await getWorkspaceAdminGoogleAccount(preferredUserId);
  if (adminAccount && (appointment?.googleEventId || appointmentId)) {
    const eventId = appointment?.googleEventId || appointmentId;
    try {
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminAccount.accessToken}` },
        }
      );
    } catch (delErr) {
      console.warn("Failed to delete Google Calendar event:", delErr);
    }
  }

  if ((prisma as any).appointment?.update) {
    try {
      return await (prisma as any).appointment.update({
        where: { id: appointmentId },
        data: { status: "cancelled" },
      });
    } catch (_) {}
  }

  return { id: appointmentId, status: "cancelled" };
}

