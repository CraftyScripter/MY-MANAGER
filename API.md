# My Manager API Documentation

Base URL: `http://localhost:3001` (or your production domain)

---

## Contact Form Submission API

Use this endpoint to receive contact form enquiries from any other platform or website (e.g. `ilovecalculator`, personal websites, client landing pages).

### Endpoints (Supported aliases)

```http
POST /api/forms/submit
POST /api/contact/submit
POST /api/promise-me/submit
```

All three endpoints accept the exact same payload and include full **CORS support** (`Access-Control-Allow-Origin: *`), allowing direct browser fetch calls from any external domain.

### Request Body (JSON)

| Field | Type | Required | Description |
|---|---|---|---|
| `platform` | `string` | **Yes** | Identifier of the platform sending the enquiry (e.g., `"ilovecalculator"`, `"my-portfolio"`) |
| `name` | `string` | **Yes** | Full name of the sender |
| `email` | `string` | **Yes** | Valid email address of the sender |
| `message` | `string` | **Yes** | Message or query submitted |
| `phone` | `string` | No | Optional phone or WhatsApp number |
| `subject` | `string` | No | Optional subject line |

---

### Example Request (JavaScript / TypeScript)

```javascript
const payload = {
  platform: "ilovecalculator", // Your platform name
  name: "John Doe",
  email: "john@example.com",
  message: "Hello, I have a question about your mortgage calculator.",
  phone: "+1 234 567 8900", // Optional
  subject: "General Inquiry", // Optional
};

const response = await fetch("https://your-my-manager-domain.com/api/forms/submit", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const data = await response.json();
if (response.ok) {
  console.log("Submission successful! ID:", data.id);
} else {
  console.error("Submission failed:", data.error);
}
```

### Example Form with In-Page Popup (No browser `alert()`)

#### Option A: React / Next.js Component

```tsx
"use client";

import { useState } from "react";

export default function ContactForm() {
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("https://your-my-manager-domain.com/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "ilovecalculator", // Your platform name
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          message: formData.message.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPopup({
          type: "success",
          title: "Message Sent!",
          message: "Thank you! We received your message and will get back to you soon.",
        });
        setFormData({ name: "", email: "", phone: "", message: "" });
      } else {
        setPopup({
          type: "error",
          title: "Submission Error",
          message: data.error || "Please verify your input and try again.",
        });
      }
    } catch {
      setPopup({
        type: "error",
        title: "Network Error",
        message: "Could not reach the server. Please check your internet connection.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Your Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          className="w-full px-4 py-2.5 rounded-xl border border-zinc-200"
        />
        <input
          type="email"
          placeholder="Your Email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          className="w-full px-4 py-2.5 rounded-xl border border-zinc-200"
        />
        <input
          type="tel"
          placeholder="Phone (Optional)"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-4 py-2.5 rounded-xl border border-zinc-200"
        />
        <textarea
          placeholder="Your Message"
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          required
          rows={4}
          className="w-full px-4 py-2.5 rounded-xl border border-zinc-200"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-zinc-900 text-white font-semibold hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send Message"}
        </button>
      </form>

      {/* In-Page Popup Modal */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center space-y-4">
            <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl font-bold ${
              popup.type === "success" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
            }`}>
              {popup.type === "success" ? "✓" : "!"}
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">{popup.title}</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{popup.message}</p>
            </div>
            <button
              onClick={() => setPopup(null)}
              className="w-full py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### Option B: Vanilla HTML / JavaScript with In-Page Popup

```html
<form id="contact-form">
  <input type="text" name="name" placeholder="Your Name" required />
  <input type="email" name="email" placeholder="Your Email" required />
  <input type="tel" name="phone" placeholder="Your Phone (Optional)" />
  <textarea name="message" placeholder="Your Message" required></textarea>
  <button type="submit" id="submit-btn">Send Message</button>
</form>

<!-- In-Page Popup Container (hidden by default) -->
<div id="contact-popup" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:9999; align-items:center; justify-content:center;">
  <div style="background:#ffffff; border-radius:16px; padding:24px; max-width:360px; width:90%; text-align:center; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
    <div id="popup-icon" style="width:48px; height:48px; border-radius:50%; margin:0 auto 12px; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:bold;"></div>
    <h3 id="popup-title" style="margin:0 0 8px; font-size:16px; font-weight:700; color:#18181b;"></h3>
    <p id="popup-message" style="margin:0 0 16px; font-size:13px; color:#71717a; line-height:1.4;"></p>
    <button id="popup-close-btn" style="width:100%; padding:10px; background:#18181b; color:#ffffff; border:none; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer;">OK</button>
  </div>
</div>

<script>
  const form = document.getElementById("contact-form");
  const popup = document.getElementById("contact-popup");
  const popupIcon = document.getElementById("popup-icon");
  const popupTitle = document.getElementById("popup-title");
  const popupMessage = document.getElementById("popup-message");
  const popupClose = document.getElementById("popup-close-btn");

  function showPopup(type, title, message) {
    popup.style.display = "flex";
    popupTitle.innerText = title;
    popupMessage.innerText = message;
    if (type === "success") {
      popupIcon.style.background = "#dcfce7";
      popupIcon.style.color = "#16a34a";
      popupIcon.innerText = "✓";
    } else {
      popupIcon.style.background = "#fee2e2";
      popupIcon.style.color = "#dc2626";
      popupIcon.innerText = "!";
    }
  }

  popupClose.addEventListener("click", () => {
    popup.style.display = "none";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      platform: "ilovecalculator", // Your platform name
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      message: form.message.value.trim(),
    };

    try {
      const res = await fetch("https://your-my-manager-domain.com/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (res.ok) {
        showPopup("success", "Message Sent!", "Thank you! We received your message and will respond soon.");
        form.reset();
      } else {
        showPopup("error", "Submission Error", result.error || "Please check your input and try again.");
      }
    } catch (err) {
      showPopup("error", "Network Error", "Could not reach server. Please try again later.");
    }
  });
</script>

---

### Success Response

**Status:** `201 Created`

```json
{
  "success": true,
  "id": "cm...unique_id"
}
```

### Error Responses

**Status:** `400 Bad Request`

```json
{
  "error": "Platform name is required (e.g. 'ilovecalculator', 'portfolio')"
}
```

Possible validation errors:
- `"Platform name is required (e.g. 'ilovecalculator', 'portfolio')"`
- `"Name is required"`
- `"Valid email is required"`
- `"Email verification failed: The domain does not have active mail servers (MX/DNS lookup failed)"`
- `"Message is required"`

**Status:** `500 Internal Server Error`

```json
{
  "error": "Internal server error"
}
```

---

## Auto Mail Verifier API (DNS & MX Verification)

Verify whether an email address's domain actually exists and is configured to receive emails via standard DNS MX (Mail Exchange) queries. Includes RFC 7505 Null MX detection (rejecting domains that explicitly refuse mail) and RFC 5321 fallback to address records.

### 1. Public Email Verification (CORS-enabled)

Use this endpoint from client applications, forms, or frontends to check email validity before or during input.

```http
GET /api/verify-email?email=user@domain.com
POST /api/verify-email
```

**Request Body (for POST):**
```json
{
  "email": "user@domain.com",
  "blockDisposable": false
}
```

**Response (`200 OK`):**
```json
{
  "valid": true,
  "email": "user@gmail.com",
  "user": "user",
  "domain": "gmail.com",
  "status": "valid",
  "hasMx": true,
  "hasARecord": false,
  "isDisposable": false,
  "primaryMx": "gmail-smtp-in.l.google.com",
  "mxRecords": [
    { "exchange": "gmail-smtp-in.l.google.com", "priority": 5 },
    { "exchange": "alt1.gmail-smtp-in.l.google.com", "priority": 10 }
  ],
  "checkedAt": "2026-09-09T16:18:41.011Z"
}
```

**Invalid Domain Response (`200 OK` with `valid: false`):**
```json
{
  "valid": false,
  "email": "fake@unknown1234987192.com",
  "domain": "unknown1234987192.com",
  "status": "invalid_domain",
  "reason": "Domain \"unknown1234987192.com\" does not exist in DNS (NXDOMAIN)",
  "hasMx": false,
  "mxRecords": []
}
```

---

## Admin Routes (Protected)

These routes require active admin session authentication cookies.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/auth/login` | Admin Login |
| POST | `/api/admin/auth/logout` | Admin Logout |
| GET | `/api/admin/auth/me` | Current authenticated user |
| GET | `/api/admin/stats` | Dashboard metrics & platform distribution |
| GET | `/api/admin/recent` | Recent submissions |
| GET | `/api/admin/promise-me` | All form submissions (paginated & filtered by platform) |
| DELETE | `/api/admin/promise-me?id=` | Delete a form submission |
| GET/POST | `/api/admin/verify-email` | Live DNS & MX verification for any email address |

