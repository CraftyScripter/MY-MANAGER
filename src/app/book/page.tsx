"use client";

import { useState, useEffect, useCallback } from "react";
import ThemeToggle from "@/components/ThemeToggle";

interface TimeSlot {
  start: string;
  end: string;
  displayTime: string;
  available: boolean;
}

export default function PublicBookingPage() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Default to tomorrow
    return d.toISOString().split("T")[0];
  });
  const [duration, setDuration] = useState<number>(30);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Form fields
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookedMeeting, setBookedMeeting] = useState<{
    title: string;
    startTime: string;
    meetLink?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchSlots = useCallback(async (dateStr: string, dur: number) => {
    try {
      setLoadingSlots(true);
      setSelectedSlot(null);
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await fetch(`/api/calendar/availability?date=${dateStr}&duration=${dur}&timeZone=${encodeURIComponent(timeZone)}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
      }
    } catch {
      console.error("Failed to load availability");
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots(selectedDate, duration);
  }, [selectedDate, duration, fetchSlots]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await fetch("/api/calendar/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Strategy Session with ${clientName}`,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          clientName,
          clientEmail,
          clientPhone,
          notes,
          timeZone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to schedule appointment");
        setSubmitting(false);
        return;
      }

      setBookedMeeting({
        title: `Strategy Session with ${clientName}`,
        startTime: selectedSlot.start,
        meetLink: data.meetLink,
      });
    } catch {
      setErrorMessage("Something went wrong while booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex flex-col justify-between transition-colors duration-200">
      {/* Top Navbar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-[#09090b]/70 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/myicon.png" alt="Logo" className="w-8 h-8 rounded-xl object-contain shadow-xs" />
          <div>
            <h1 className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">My Manager</h1>
            <p className="text-[10px] text-zinc-500">Live Workspace Scheduling</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle variant="button" />
          <a
            href="/"
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
          >
            Home
          </a>
        </div>
      </header>

      {/* Main Booking Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 flex items-center justify-center">
        {bookedMeeting ? (
          /* Booking Confirmation Card */
          <div className="w-full max-w-md bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>

            <div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Meeting Confirmed!
              </span>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-3">You're on the Calendar</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Calendar invitation and details have been synced to Google Calendar.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-left space-y-2">
              <div className="text-xs text-zinc-500">Scheduled Time</div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                {new Date(bookedMeeting.startTime).toLocaleString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>

              {bookedMeeting.meetLink && (
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Google Meet Link:</span>
                  <a
                    href={bookedMeeting.meetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-blue-500 hover:underline inline-flex items-center gap-1"
                  >
                    Join Meet Call &rarr;
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setBookedMeeting(null);
                setSelectedSlot(null);
                setClientName("");
                setClientEmail("");
                setNotes("");
              }}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
            >
              Book Another Meeting
            </button>
          </div>
        ) : (
          /* Step-by-Step Interactive Booking Layout */
          <div className="w-full bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
            {/* Left Column: Host Details */}
            <div className="p-6 md:p-8 md:col-span-4 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 border border-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                    MM
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 dark:text-white">Strategy Session</h2>
                    <p className="text-xs text-zinc-500">{duration} Min One-on-One</p>
                  </div>
                </div>

                {/* Duration Limit Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Select Duration
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[15, 30, 45, 60].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDuration(d)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer text-center border ${
                          duration === d
                            ? "bg-blue-600 text-white border-blue-500 shadow-xs"
                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300"
                        }`}
                      >
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5 text-xs text-zinc-600 dark:text-zinc-400 pt-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{duration} Minutes Session</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span>Google Meet Video Call</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                    </svg>
                    <span>Real-time Google Calendar Sync</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-400">
                Powered by My Manager Workspace
              </div>
            </div>

            {/* Right Column: Date, Slot Picker & Form */}
            <div className="p-6 md:p-8 md:col-span-8">
              {!selectedSlot ? (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-zinc-900 dark:text-white">Select Date & Time</h3>
                      <p className="text-xs text-zinc-500">Pick an open time slot from our live schedule</p>
                    </div>

                    <input
                      type="date"
                      value={selectedDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {loadingSlots ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-3">
                      <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                      <p className="text-xs text-zinc-500">Checking Google Calendar free slots...</p>
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="py-12 text-center text-xs text-zinc-500 space-y-1">
                      <p className="font-semibold text-zinc-700 dark:text-zinc-300">No schedule available on this date</p>
                      <p>Please select another date or choose a shorter duration.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1 admin-scroll p-1">
                      {slots.map((slot, index) => {
                        const isBooked = !slot.available;

                        if (isBooked) {
                          return (
                            <button
                              key={index}
                              disabled={true}
                              title="This slot is already booked"
                              className="p-3 rounded-xl text-xs font-medium text-center border bg-zinc-100/70 dark:bg-zinc-900/40 border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 line-through cursor-not-allowed flex items-center justify-between px-3 opacity-60"
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
                            onClick={() => setSelectedSlot(slot)}
                            className="p-3 rounded-xl text-xs font-semibold text-center border transition-all cursor-pointer bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 active:scale-97 shadow-xs flex items-center justify-center gap-1.5"
                          >
                            <span>{slot.displayTime.split(" - ")[0]}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Contact Form for Selected Slot */
                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <div>
                      <span className="text-xs text-zinc-500">Selected Slot:</span>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">
                        {new Date(selectedSlot.start).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        at {selectedSlot.displayTime}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSlot(null)}
                      className="text-xs text-blue-500 hover:underline font-medium"
                    >
                      Change Slot
                    </button>
                  </div>

                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                      {errorMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Sarah Connor"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                        Your Email *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="sarah@example.com"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                      Phone / WhatsApp (Optional)
                    </label>
                    <input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                      What would you like to discuss?
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Brief overview of your project or goals..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 cursor-pointer shadow-md mt-2"
                  >
                    {submitting ? "Booking Meeting..." : "Confirm & Schedule Google Meet"}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800">
        © {new Date().getFullYear()} My Manager SaaS. All rights reserved.
      </footer>
    </div>
  );
}
