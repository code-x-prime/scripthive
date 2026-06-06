# ScriptHive — cPanel Deployment Guide

## (Teri Hosting: scripthi / scripthive.org)

## https://generate-secret.vercel.app/32

## OVERVIEW — Kya deploy hoga kahan

| App                | Domain                 | Server folder                          |
| ------------------ | ---------------------- | -------------------------------------- |
| **Backend (API)**  | internal only          | `/home/scripthi/scripthive-api/`       |
| **Admin Panel**    | `admin.scripthive.org` | `/home/scripthi/admin.scripthive.org/` |
| **Public Website** | `scripthive.org`       | `/home/scripthi/scripthive-client/`    |

---

## PEHLE KARO — Local machine pe (apne Windows PC pe)

### A. Backend build karo

```
PowerShell mein:
cd d:\grox-project\scripthive\backend
npm run build
```

Iske baad `backend/dist/` folder ban jayega.

### B. Frontend build karo

Pehle ek file banao:

```
File: d:\grox-project\scripthive\frontend\.env.production
Content:
VITE_API_BASE_URL=https://admin.scripthive.org/api
```

Phir:

```
cd d:\grox-project\scripthive\frontend
npm run build
```

Iske baad `frontend/dist/` folder ban jayega.

---

## STEP 1 — PostgreSQL Database banao

**cPanel mein jao → scroll karo → "Manage My Databases" (Databases section mein)**

1. **PostgreSQL Databases** tab click karo
2. **Create New Database:**
   - Name: `scripthive_db`
   - Click "Create Database"
   - Server pe banega: `scripthi_scripthive_db`

3. **Create New User:**
   - Username: `scripthive_user`
   - Password: koi strong password likho (yaad rakhna — .env mein chahiye)
   - Click "Create User"
   - Server pe banega: `scripthi_scripthive_user`

4. **Add User to Database:**
   - User: `scripthi_scripthive_user`
   - Database: `scripthi_scripthive_db`
   - Click "Add" → ALL PRIVILEGES select karo

---

## STEP 2 — Backend deploy karo

### 2A. Server pe folder banao

**cPanel → Files → File Manager** kholo

Left sidebar mein `/home/scripthi/` dikhe ga
Wahan **New Folder** karo: `scripthive-api`

### 2B. Files upload karo

Apne PC pe `d:\grox-project\scripthive\backend\` mein yeh cheezein hain:

**Upload karo** (FTP ya File Manager se) `/home/scripthi/scripthive-api/` mein:

```
✅ dist/           (poora folder — npm run build ke baad bana)
✅ prisma/         (poora folder)
✅ package.json
✅ package-lock.json

❌ node_modules/   (mat upload karna — bahut bada hai)
❌ src/             (production mein chahiye nahi)
❌ .env             (local wala mat dena — alag banayenge)
```

**FTP se upload karna ho to:**

- FileZilla software use karo (free)
- Host: `scripthive.org`
- Username: `scripthi`
- Password: cPanel ka password
- Port: 21

### 2C. Node.js App banao

**cPanel → Software section → "Setup Node.js App"**

"Create Application" button click karo:

| Field                    | Value                              |
| ------------------------ | ---------------------------------- |
| Node.js version          | `20.x` (ya jo latest available ho) |
| Application mode         | `Production`                       |
| Application root         | `scripthive-api`                   |
| Application startup file | `dist/app.js`                      |
| Application URL          | _khali chhod do_                   |

"Create" karo.

### 2D. .env file banao (server pe)

**File Manager → `/home/scripthi/scripthive-api/`**

New File banao: `.env`

Content (apni values dalo jahan `<>` hai):

```
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://admin.scripthive.org

DATABASE_URL=postgresql://scripthi_scripthive_user:STEP1_WALA_PASSWORD@localhost:5432/scripthi_scripthive_db

JWT_SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz12345678
JWT_REFRESH_SECRET=ZyXwVuTsRqPoNmLkJiHgFeDcBa987654321
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

SMTP_HOST=mail.scripthive.org
SMTP_PORT=587
SMTP_USER=contact@scripthive.org
SMTP_PASS=Praveen@11553
SMTP_FROM=ScriptHive Publication <contact@scripthive.org>
ADMIN_EMAIL=info@scripthive.org

DOI_PREFIX=10.55662
UPLOADS_DIR=./uploads
MAX_FILE_SIZE_MB=50
BACKEND_PUBLIC_URL=https://scripthive.org
ADMIN_PANEL_URL=https://admin.scripthive.org
```

> JWT_SECRET mein koi bhi 32+ random characters dalo. Online generator: https://generate-secret.vercel.app/32

### 2E. Terminal mein commands chalao

**cPanel → Advanced → Terminal**

```bash
# Backend folder mein jao
cd ~/scripthive-api

# Dependencies install karo (bina dev packages)
npm install --omit=dev

# Prisma client generate karo
npx prisma generate

# Database tables banao
npx prisma migrate deploy

# Upload folders banao
mkdir -p uploads/manuscripts
mkdir -p uploads/articles
mkdir -p uploads/production
mkdir -p uploads/samples
mkdir -p uploads/media
chmod 755 uploads -R
```

### 2F. Node app restart karo

**cPanel → Setup Node.js App → scripthive-api → Restart**

### 2G. Test karo

Browser mein kholo:

```
https://admin.scripthive.org/api/journals
```

JSON response aana chahiye (ya even empty array `[]` — that's fine).

---

## STEP 3 — Admin Panel deploy karo

### 3A. `admin.scripthive.org` folder check karo

**File Manager** mein `/home/scripthi/` dekho — `admin.scripthive.org` folder already hoga (subdomain already add hai screenshot mein).

Agar nahi hai: cPanel → Domains → Subdomains → `admin` add karo pointing to `/home/scripthi/admin.scripthive.org/`

### 3B. Files upload karo

`d:\grox-project\scripthive\frontend\dist\` ke **andar ka sab kuch** upload karo:

```
Upload TO: /home/scripthi/admin.scripthive.org/

Upload karo (dist/ ke andar se):
✅ index.html
✅ assets/         (poora folder)
✅ baaki sab files
```

> Note: `dist` folder khud mat dalo — uske andar ka content directly `admin.scripthive.org/` mein.

### 3C. .htaccess file banao

**File Manager → `/home/scripthi/admin.scripthive.org/`**

New File: `.htaccess`

Content:

```apache
Options -MultiViews
RewriteEngine On

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}/$1 [R=301,L]

# Proxy /api calls to backend Node app
RewriteCond %{REQUEST_URI} ^/api
RewriteRule ^api/(.*)$ http://127.0.0.1:3001/api/$1 [P,L]

# React SPA — sab routes index.html pe
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ /index.html [QSA,L]
```

> Agar `[P,L]` (proxy) kaam na kare — hosting support se bolo `mod_proxy` enable karo. Alternatively unhe bolo reverse proxy lagao `admin.scripthive.org/api` → `127.0.0.1:3001/api`.

---

## STEP 4 — Public Website (client) deploy karo

### 4A. Server pe folder banao

**File Manager → `/home/scripthi/`**

New Folder: `scripthive-client`

### 4B. Files upload karo

`d:\grox-project\scripthive\client\` se upload karo `/home/scripthi/scripthive-client/` mein:

```
✅ server.js
✅ db.js
✅ convert.js
✅ views/           (poora folder)
✅ public/          (poora folder)
✅ package.json
✅ package-lock.json

❌ node_modules/    (mat dena)
❌ uploads/          (server pe alag banayenge)
❌ .env              (alag banayenge)
❌ database.sqlite   (local ka nahi dena)
```

### 4C. Node.js App banao (doosra app)

**cPanel → Setup Node.js App → Create Application:**

| Field                    | Value               |
| ------------------------ | ------------------- |
| Node.js version          | `20.x`              |
| Application mode         | `Production`        |
| Application root         | `scripthive-client` |
| Application startup file | `server.js`         |
| Application URL          | `scripthive.org`    |

"Create" karo.

### 4D. .env file banao

**File Manager → `/home/scripthi/scripthive-client/`**

New File: `.env`

```
PORT=3000
NODE_ENV=production
SCRIPTHIVE_API_URL=http://127.0.0.1:3001
ADMIN_PANEL_URL=https://admin.scripthive.org

SMTP_HOST=mail.scripthive.org
SMTP_PORT=587
SENDER_EMAIL=contact@scripthive.org
SENDER_PASSWORD=TUMHARI_EMAIL_PASSWORD

EDITORIAL_SMTP_HOST=mail.scripthive.org
EDITORIAL_SMTP_PORT=587
EDITORIAL_SENDER_EMAIL=editor@scripthive.org
EDITORIAL_SENDER_PASSWORD=TUMHARI_EMAIL_PASSWORD

SUBMIT_SMTP_HOST=mail.scripthive.org
SUBMIT_SMTP_PORT=587
SUBMIT_SENDER_EMAIL=article@scripthive.org
SUBMIT_SENDER_PASSWORD=TUMHARI_EMAIL_PASSWORD
```

### 4E. Terminal mein:

```bash
cd ~/scripthive-client
npm install --omit=dev

mkdir -p uploads/manuscripts
mkdir -p uploads/editorial-board/resumes
mkdir -p uploads/editorial-board/photos
chmod 755 uploads -R
```

### 4F. Node app restart karo

**cPanel → Setup Node.js App → scripthive-client → Restart**

---

## STEP 5 — Pehla login aur setup

1. Browser: `https://admin.scripthive.org`
2. Login:
   - Email: `admin@scripthive.org`
   - Password: `Admin@ScriptHive123`
3. **TURANT password change karo** — Settings ya profile mein

---

## STEP 6 — Final verification checklist

```
[ ] https://scripthive.org          → Public website load ho
[ ] https://admin.scripthive.org    → Admin login page dikhe
[ ] https://admin.scripthive.org/api/journals → JSON aaye
[ ] Admin login karo → dashboard stats dikhe
[ ] Test submission karo → admin mein dikhe
[ ] Payment gateway test karo
```

---

## CHEEZEIN DHYAN RAKHNA

| Cheez              | Kahan milegi                             |
| ------------------ | ---------------------------------------- |
| cPanel username    | `scripthi`                               |
| Home directory     | `/home/scripthi/`                        |
| DB name            | `scripthi_scripthive_db`                 |
| DB user            | `scripthi_scripthive_user`               |
| Backend folder     | `~/scripthive-api/`                      |
| Admin panel folder | `~/admin.scripthive.org/`                |
| Client folder      | `~/scripthive-client/`                   |
| Terminal           | cPanel → Advanced → Terminal             |
| Node.js apps       | cPanel → Software → Setup Node.js App    |
| File Manager       | cPanel → Files → File Manager            |
| DB manager         | cPanel → Databases → Manage My Databases |

---

## AGAR KOI PROBLEM AYE

**Backend start nahi ho raha:**

```bash
cd ~/scripthive-api
node dist/app.js
# Error message dekho
```

**Prisma error:**

```bash
cd ~/scripthive-api
npx prisma migrate deploy
# Agar fail ho: DATABASE_URL check karo .env mein
```

**Admin panel /api calls fail:**

- `.htaccess` mein proxy check karo
- Ya hosting support se bolo mod_proxy enable karo

**Client site 500 error:**

```bash
cd ~/scripthive-client
node server.js
# Error message dekho
```

---

## UPDATING PRODUCTION (baad mein)

### Frontend update karna ho:

```bash
# Local machine pe:
cd d:\grox-project\scripthive\frontend
npm run build
# dist/ ka content upload karo admin.scripthive.org/ mein
```

### Backend update karna ho:

```bash
# Local machine pe:
cd d:\grox-project\scripthive\backend
npm run build
# dist/ folder upload karo scripthive-api/ mein
# cPanel → Node.js App → Restart
```

### Client update karna ho:

```bash
# server.js / views / public upload karo scripthive-client/ mein
# cPanel → Node.js App → Restart
```

### DB migration (schema change pe):

```bash
# Terminal mein:
cd ~/scripthive-api
npx prisma migrate deploy
# Node app restart karo
```
