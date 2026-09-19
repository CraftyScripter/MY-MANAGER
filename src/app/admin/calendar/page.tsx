"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  meetLink?: string;
  attendees?: { email: string; displayName?: string }[];
  status: string;
  notes?: string;
  clientPhone?: string;
  clientName?: string;
  clientEmail?: string;
  bookedByRole?: string;
  htmlLink?: string;
}

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [cancelModalEvent, setCancelModalEvent] = useState<CalendarEvent | null>(null);
  const [selectedDetailEvent, setSelectedDetailEvent] = useState<CalendarEvent | null>(null);
  const [copiedMeet, setCopiedMeet] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [filterMode, setFilterMode] = useState<"upcoming" | "all">("upcoming");

  // Real-time synchronization signature to prevent unnecessary re-renders
  const lastDataSignatureRef = useRef<string>("");

  // Schedule modal state (Calendly style)
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split("T")[0]);
  const [duration, setDuration] = useState<number>(30); // 15, 30, 45, 60
  const [availableSlots, setAvailableSlots] = useState<{ start: string; end: string; displayTime: string; available: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string; displayTime: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const fetchEvents = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await fetch(`/api/admin/calendar/events?_t=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const incoming = data.events || [];
        const signature = incoming.map((e: CalendarEvent) => `${e.id}_${e.status}_${e.start}_${e.notes || ""}`).join("|");
        if (isBackground && signature === lastDataSignatureRef.current) {
          return;
        }
        lastDataSignatureRef.current = signature;
        setEvents(incoming);
      }
    } catch (err) {
      if (!isBackground) console.error("Failed to load events:", err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  // Real-time live synchronization (polling + focus revalidation + cross-tab broadcast)
  useEffect(() => {
    fetchEvents(false);

    // 1. Silent background poll every 10 seconds
    const interval = setInterval(() => {
      if (document.hidden || showScheduleModal || cancelModalEvent || selectedDetailEvent) return;
      fetchEvents(true);
    }, 10000);

    // 2. Instant sync when tab gains focus or becomes visible
    const handleFocus = () => fetchEvents(true);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchEvents(true);
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    // 3. Cross-tab instant sync via BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("mm_calendar_sync");
      bc.onmessage = () => {
        fetchEvents(true);
      };
    } catch (_) {}

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (bc) bc.close();
    };
  }, [fetchEvents, showScheduleModal, cancelModalEvent, selectedDetailEvent]);

  // Fetch free schedule slots dynamically when date or duration changes
  const fetchFreeSlots = useCallback(async (date: string, dur: number) => {
    try {
      setLoadingSlots(true);
      setSelectedSlot(null);
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await fetch(
        `/api/calendar/availability?date=${date}&duration=${dur}&timeZone=${encodeURIComponent(timeZone)}&_t=${Date.now()}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const allSlots = data.slots || [];
        setAvailableSlots(allSlots);
        const firstFree = allSlots.find((s: any) => s.available);
        if (firstFree) {
          setSelectedSlot(firstFree);
        }
      } else {
        setAvailableSlots([]);
      }
    } catch {
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (showScheduleModal) {
      fetchFreeSlots(meetingDate, duration);
    }
  }, [showScheduleModal, meetingDate, duration, fetchFreeSlots]);

  const copyBookingLink = () => {
    const url = `${window.location.origin}/book`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      setModalError("Please select an available time slot from your free schedule.");
      return;
    }

    setSubmitting(true);
    setModalError("");

    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await fetch("/api/admin/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || `Strategy Session with ${clientName}`,
          clientName,
          clientEmail,
          clientPhone,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          notes,
          timeZone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || "Failed to schedule meeting");
        setSubmitting(false);
        return;
      }

      setShowScheduleModal(false);
      setTitle("");
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setNotes("");
      setSelectedSlot(null);
      fetchEvents(true);

      // Broadcast to other tabs/windows
      try {
        const bc = new BroadcastChannel("mm_calendar_sync");
        bc.postMessage({ type: "booking_created", appointment: data.appointment });
        bc.close();
      } catch (_) {}
    } catch {
      setModalError("Network error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalEvent) return;
    setCancelling(true);

    try {
      const res = await fetch(`/api/admin/calendar/events/${cancelModalEvent.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCancelModalEvent(null);
        fetchEvents(true);

        // Broadcast to other tabs/windows
        try {
          const bc = new BroadcastChannel("mm_calendar_sync");
          bc.postMessage({ type: "booking_cancelled", eventId: cancelModalEvent.id });
          bc.close();
        } catch (_) {}
      }
    } catch (err) {
      console.error("Failed to cancel event:", err);
    } finally {
      setCancelling(false);
    }
  };


  const now = new Date().getTime();
  const upcomingEvents = events.filter((e) => new Date(e.end).getTime() >= now);
  const displayedEvents = filterMode === "upcoming" ? upcomingEvents : events;

  return (
    <div className="w-full min-h-screen px-6 sm:px-8 lg:px-12 py-8 space-y-8 max-w-[1700px] mx-auto transition-all">
      {/* 1. Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2 border-b border-zinc-200 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-3.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              Calendar & Meetings
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Real-Time Auto-Sync Active (10s)
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-2xl leading-relaxed">
            Automated Google Calendar engine with instant Google Meet link generation for team and clients.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={copyBookingLink}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 active:scale-97 transition flex items-center gap-2 cursor-pointer shadow-xs"
          >
            {copiedLink ? (
              <>
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="text-emerald-500 font-bold">Booking Link Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                <span>Copy Public Booking Link</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowScheduleModal(true)}
            className="btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm active:scale-97"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Schedule Meeting</span>
          </button>
        </div>
      </div>

      {/* 2. Metrics Row - Expanded Width */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="p-6 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">Upcoming Appointments</p>
            <p className="text-3xl font-extrabold text-zinc-900 dark:text-white mt-1.5">{upcomingEvents.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">Total Synced Events</p>
            <p className="text-3xl font-extrabold text-zinc-900 dark:text-white mt-1.5">{events.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <p className="text-xs font-semibold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">Google Meet Integration</p>
            <p className="text-base font-bold text-emerald-500 mt-1">Automatic Video Links</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">conferenceDataVersion: 1 Active</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. Events Table Container - Full Width */}
      <div className="w-full rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <div className="px-6 py-4.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900/80 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
            <button
              onClick={() => setFilterMode("upcoming")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterMode === "upcoming"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              Upcoming ({upcomingEvents.length})
            </button>
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterMode === "all"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              All Events ({events.length})
            </button>
          </div>

          <button
            onClick={() => fetchEvents(false)}
            disabled={loading}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-xl transition cursor-pointer flex items-center gap-1.5"
            title="Refresh events"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            <span>Sync Live</span>
          </button>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
            <p className="text-xs text-zinc-500">Querying Google Calendar and appointments...</p>
          </div>
        ) : displayedEvents.length === 0 ? (
          <div className="py-20 text-center px-4 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 text-zinc-400 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">No scheduled appointments</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Share your public booking link with clients or click "Schedule Meeting" to create one.
              </p>
            </div>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="btn-primary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-md"
            >
              Schedule First Meeting
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Event Title & Agenda</th>
                  <th className="px-6 py-3.5 font-semibold">Scheduled Date & Time</th>
                  <th className="px-6 py-3.5 font-semibold">Attendees</th>
                  <th className="px-6 py-3.5 font-semibold">Google Meet Link</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                {displayedEvents.map((event) => {
                  const startDate = new Date(event.start);
                  const endDate = new Date(event.end);
                  const isPast = endDate.getTime() < now;

                  return (
                    <tr
                      key={event.id}
                      className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition"
                    >
                      <td className="px-6 py-4.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDetailEvent(event)}
                          className="font-bold text-sm text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition text-left flex items-center gap-2.5 cursor-pointer"
                        >
                          <span>{event.summary}</span>
                          {isPast ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                              Completed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              Confirmed
                            </span>
                          )}
                        </button>
                        {event.notes ? (
                          <div
                            onClick={() => setSelectedDetailEvent(event)}
                            className="flex items-center gap-2 mt-1.5 cursor-pointer group max-w-lg"
                          >
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0 group-hover:bg-blue-500/20 transition">
                              Notes
                            </span>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate group-hover:text-zinc-900 dark:group-hover:text-zinc-200 transition">
                              {event.notes}
                            </p>
                          </div>
                        ) : event.description ? (
                          <p
                            onClick={() => setSelectedDetailEvent(event)}
                            className="text-xs text-zinc-500 line-clamp-1 mt-1 max-w-lg cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition"
                          >
                            {event.description}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-6 py-4.5 whitespace-nowrap">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {startDate.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} -{" "}
                          {endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </td>

                      <td className="px-6 py-4.5">
                        {event.attendees && event.attendees.length > 0 ? (
                          <div className="space-y-1">
                            {event.attendees.map((att, idx) => (
                              <div key={idx} className="text-xs text-zinc-700 dark:text-zinc-300 font-medium flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                <span className="truncate max-w-xs">{att.displayName || att.email}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4.5">
                        {event.meetLink ? (
                          <a
                            href={event.meetLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 transition shadow-xs"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                            <span>Join Video Meet</span>
                          </a>
                        ) : (
                          <span className="text-zinc-400 text-xs">No Meet Link</span>
                        )}
                      </td>

                      <td className="px-6 py-4.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailEvent(event)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/80 active:scale-97 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                            title="View full notes & client details"
                          >
                            <svg className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>View Notes</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancelModalEvent(event)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/80 dark:border-rose-900/50 active:scale-97 transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Theme-Based Cancel Confirmation Modal */}
      {cancelModalEvent && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Cancel Meeting?</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  This will permanently cancel this event from Google Calendar and notify participants.
                </p>
              </div>
            </div>

            {/* Event Summary Card */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                  {cancelModalEvent.summary}
                </p>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 pl-4">
                {new Date(cancelModalEvent.start).toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
              {cancelModalEvent.attendees && cancelModalEvent.attendees.length > 0 && (
                <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 pl-4">
                  <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <span className="truncate">
                    {cancelModalEvent.attendees.map(a => a.displayName || a.email).join(", ")}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalEvent(null)}
                disabled={cancelling}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 active:scale-97 transition cursor-pointer"
              >
                Keep Meeting
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 active:scale-97 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {cancelling ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Yes, Cancel Meeting</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Spacious, Modern Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-8 md:p-10 max-w-2xl w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Schedule Meeting</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Creates event on Admin Calendar with auto Google Meet link</p>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {modalError && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleScheduleSubmit} className="space-y-5">
              {/* 1. Time Limit / Duration Selector */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Select Meeting Duration (Time Limit)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 border ${
                        duration === d
                          ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20"
                          : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      <span className="text-sm">{d} min</span>
                      <span className="text-[10px] opacity-75 font-normal">session</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Date Picker */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Select Date *
                </label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split("T")[0]}
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* 3. Real-Time Free Schedule Grid (Calendly Style) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <span>Available Free Slots</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      Live Free/Busy Checked
                    </span>
                  </label>
                  {selectedSlot && (
                    <span className="text-[11px] font-semibold text-blue-500">
                      Selected: {selectedSlot.displayTime}
                    </span>
                  )}
                </div>

                {loadingSlots ? (
                  <div className="py-10 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex flex-col items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                    <p className="text-xs text-zinc-500">Checking your Google Calendar availability...</p>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-1">
                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No schedule available on this date</p>
                    <p className="text-[11px] text-zinc-500">
                      Try picking a different date or a shorter duration.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1 admin-scroll p-1">
                    {availableSlots.map((slot, index) => {
                      const isSelected = selectedSlot?.start === slot.start;
                      const isBooked = !slot.available;

                      if (isBooked) {
                        return (
                          <button
                            key={index}
                            type="button"
                            disabled={true}
                            title="This slot is booked or busy on your Google Calendar"
                            className="p-2.5 rounded-xl text-xs font-medium text-center border bg-zinc-100/70 dark:bg-zinc-900/40 border-dashed border-zinc-200 dark:border-zinc-800/80 text-zinc-400 dark:text-zinc-600 line-through cursor-not-allowed flex items-center justify-between px-3 opacity-60"
                          >
                            <span>{slot.displayTime.split(" - ")[0]}</span>
                            <span className="text-[10px] no-underline font-semibold text-red-500/80 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                              Booked
                            </span>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center border flex items-center justify-center gap-1.5 ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/25 ring-2 ring-blue-400"
                              : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 active:scale-97"
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                          <span>{slot.displayTime.split(" - ")[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. Client Information & Agenda */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Client Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="john@example.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Meeting Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Discovery Call & Strategy Demo"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Notes / Agenda (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Key discussion points, agenda, or client requirements..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedSlot}
                  className="btn-primary px-6 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer shadow-md active:scale-97"
                >
                  {submitting ? "Booking on Google Calendar..." : "Confirm & Send Invites"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Meeting Details & Client Briefing Modal */}
      {selectedDetailEvent && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 my-8 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    Meeting Details
                  </span>
                  {new Date(selectedDetailEvent.end).getTime() < now ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      Completed
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      Confirmed
                    </span>
                  )}
                  {selectedDetailEvent.bookedByRole && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/80">
                      {selectedDetailEvent.bookedByRole === "client" ? "Booked via Public Link" : `Booked by ${selectedDetailEvent.bookedByRole}`}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white pt-1">
                  {selectedDetailEvent.summary}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDetailEvent(null)}
                className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Date & Time Highlight */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 font-medium">Scheduled Date & Time</p>
                  <p className="text-sm font-bold text-zinc-900 dark:text-white">
                    {new Date(selectedDetailEvent.start).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(selectedDetailEvent.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} -{" "}
                    {new Date(selectedDetailEvent.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              {selectedDetailEvent.meetLink && (
                <div className="flex items-center gap-2">
                  <a
                    href={selectedDetailEvent.meetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span>Join Meet</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedDetailEvent.meetLink) {
                        navigator.clipboard.writeText(selectedDetailEvent.meetLink);
                        setCopiedMeet(true);
                        setTimeout(() => setCopiedMeet(false), 2000);
                      }
                    }}
                    className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition cursor-pointer"
                    title="Copy Meet link"
                  >
                    {copiedMeet ? (
                      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Client / Attendee Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Client / Attendee Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="text-[11px] text-zinc-400 font-medium">Name</span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {selectedDetailEvent.clientName ||
                      selectedDetailEvent.attendees?.[0]?.displayName ||
                      selectedDetailEvent.attendees?.[0]?.email?.split("@")[0] ||
                      "Not specified"}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="text-[11px] text-zinc-400 font-medium">Email</span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {selectedDetailEvent.clientEmail ||
                      selectedDetailEvent.attendees?.[0]?.email ||
                      "Not specified"}
                  </p>
                </div>

                {selectedDetailEvent.clientPhone && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-1 sm:col-span-2">
                    <span className="text-[11px] text-zinc-400 font-medium">Phone / WhatsApp</span>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {selectedDetailEvent.clientPhone}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes & Agenda (Prominent Callout) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span>Client Notes / Discussion Agenda</span>
                </h4>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/50">
                {selectedDetailEvent.notes ? (
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    {selectedDetailEvent.notes}
                  </p>
                ) : selectedDetailEvent.description ? (
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    {selectedDetailEvent.description}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-500 italic">
                    No additional notes or discussion points provided by the client for this meeting.
                  </p>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800 flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  const ev = selectedDetailEvent;
                  setSelectedDetailEvent(null);
                  setCancelModalEvent(ev);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 transition cursor-pointer"
              >
                Cancel Meeting
              </button>

              <div className="flex items-center gap-2">
                {selectedDetailEvent.htmlLink && (
                  <a
                    href={selectedDetailEvent.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition"
                  >
                    Google Calendar &rarr;
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDetailEvent(null)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
