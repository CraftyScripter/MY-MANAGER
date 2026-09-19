# 📘 Google Credentials Setup Handbook (My Manager)

Yeh guide aapko step-by-step explain karegi ki **Google Cloud Console** se `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, aur `GOOGLE_REDIRECT_URI` kaise create karne hain aur application me kaise add karne hain.

---

## 📌 1. Jo Environment Variables Aapko `.env` Me Chahiye

Aapki project root me `.env` file me ye 3 keys add karni hain:

```env
GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
GOOGLE_REDIRECT_URI="http://localhost:3000/auth/google/callback"
```

> 💡 **Note:** Agar aap production domain ya Cloudflare tunnel use kar rahe hain (e.g. `https://yourdomain.com`), toh `GOOGLE_REDIRECT_URI` me `https://yourdomain.com/auth/google/callback` set karein.

---

## 🚀 2. Step-by-Step: Google Cloud Console Se Credentials Kaise Nikale

### Step 1: Google Cloud Console Open Karein
1. Browser me open karein: **[Google Cloud Console](https://console.cloud.google.com/)**
2. Apne Google Account (e.g. `copy76star76@gmail.com` ya koi bhi account) se login karein.

---

### Step 2: Naya Project Banayein (Create a Project)
1. Top-left corner me project dropdown par click karein.
2. **"New Project"** par click karein.
3. Project Name rakhein: `My Manager` (ya jo aap chahein).
4. **"Create"** button par click karein aur project select karein.

---

### Step 3: Required Google APIs Enable Karein
Hamare app ko **Drive Storage** aur **Sheets Sync** ke liye 3 APIs enable karni hongi:

1. Left sidebar se **"APIs & Services"** > **"Library"** par jayein.
2. Search bar me search karein aur ek-ek karke **"Enable"** karein:
   - 🔍 **Google Drive API** ➔ Click *Enable*
   - 🔍 **Google Sheets API** ➔ Click *Enable*
   - 🔍 **Google People API / User Profile API** (By default enabled hoti hai, verify kar lein)

---

### Step 4: OAuth Consent Screen Configure Karein
1. Left sidebar me **"APIs & Services"** > **"OAuth consent screen"** par click karein.
2. **User Type**: Select karein **External** (agar sabhi users allow karne hain) aur **Create** par click karein.
3. **App Information**:
   - **App name**: `My Manager`
   - **User support email**: Apna email address select karein.
   - **Developer contact information**: Apna email dalein.
   - Click **Save and Continue**.
4. **Scopes (Permissions)**:
   - Click **"Add or Remove Scopes"**.
   - Ye scopes search/select karein:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
     - `https://www.googleapis.com/auth/drive.file` (Per-file Drive access for BYO-storage)
     - `https://www.googleapis.com/auth/spreadsheets` (Google Sheets 2-Way Sync)
   - Click **Update** ➔ Click **Save and Continue**.
5. **Test Users**:
   - **"Add Users"** par click karke apna email (jis se aap app me login karenge e.g. `copy76star76@gmail.com`) add kar lein.
   - Click **Save and Continue**.

---

### Step 5: OAuth 2.0 Credentials Create Karein (Client ID & Secret)
1. Left sidebar me **"APIs & Services"** > **"Credentials"** par click karein.
2. Top bar me **"+ Create Credentials"** button par click karein ➔ Select karein **"OAuth client ID"**.
3. **Application type**: Select karein **"Web application"**.
4. **Name**: `My Manager Web Client`
5. **Authorized JavaScript origins**:
   - `http://localhost:3000`
   - *(Optional: Aapka Cloudflare tunnel / Production URL)*
6. **Authorized redirect URIs (MOST IMPORTANT)**:
   - `http://localhost:3000/auth/google/callback`
   - *(Optional: `https://your-tunnel-url.trycloudflare.com/auth/google/callback`)*
7. **Create** button par click karein!

---

### Step 6: Client ID & Client Secret Copy Karein
Pop-up me aapko ye dono milenge:
- **Your Client ID** (e.g. `1234567890-abcdefg12345.apps.googleusercontent.com`)
- **Your Client Secret** (e.g. `GOCSPX-xxxxxxxxxxxxxxxxxxxx`)

In dono ko copy karein.

---

## 📝 3. `.env` File Update Karein

Apne project ki `.env` file ko open karein aur values paste karein:

```env
# ==============================================
# GOOGLE AUTH, DRIVE STORAGE & SHEETS SYNC
# ==============================================
GOOGLE_CLIENT_ID="1234567890-abcdefg12345.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxxx"
GOOGLE_REDIRECT_URI="http://localhost:3000/auth/google/callback"
```

---

## 🎯 4. Test Aur Verify Kaise Karein

1. Terminal me app run karein:
   ```bash
   npm run dev
   ```
2. Browser me `http://localhost:3000` open karein.
3. **Login Screen**: Click **"Continue with Google"** — aapka Google Account login ho jayega.
4. **Sidebar Indicator**: Sidebar ke footer me **"Drive Connected"** status indicator dikhega jo encrypted backup trigger karta hai `MyManager_AppData` folder me.
5. **Leads Page (`/admin/leads`)**:
   - **"Google Sheet"** button par click karein.
   - Apna Google Sheet URL paste karein ya Drive se sheet select karein.
   - Click **"Link Sheet"** ➔ 2-Way real-time live sync activate ho jayega!
