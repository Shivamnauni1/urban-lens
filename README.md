# UrbanLens

UrbanLens is a full-stack civic tech platform that enables citizens to crowdsource road damage reports and helps municipal authorities prioritize repairs using ML-based damage classification, geospatial clustering, and urgency scoring.

---

## Quick Start

### Prerequisites
- Node.js v18+
- Python 3.9+
- MongoDB Atlas account (or local MongoDB)

### 1. Backend (Node.js)

```bash
cd backend
npm install
# Configure .env (see Environment Variables section)
npm run dev
```

### 2. ML Service (Python)

```bash
cd ml
pip install fastapi uvicorn scikit-learn numpy geopy rapidfuzz
python app.py
```

### 3. Frontend

Open `frontend/index.html` with Live Server (VS Code) or:

```bash
npx serve frontend
```

---

## 🔑 Environment Variables

Create `backend/.env`:

```env
MONGO_URI=your_mongodb_connection_string/urbanlens
JWT_SECRET=your_secret_key
ML_SERVICE_URL=http://localhost:8000
PORT=5000
```

---

## 👥 User Roles & Default Credentials

| **Citizen** -> Register via UI (role: Citizen) | Your chosen username/password |
| **Ward Authority** -> Auto-created on server start | `ward_14` / `ward_14` (replace 14 with ward number) |
| **Admin** -> Register via UI (role: Admin) | Your chosen username/password |

> Ward authority accounts for all 100 Dehradun wards are auto-created on backend startup.
> Login format: `ward_[number]` / `ward_[number]` — e.g. Ward 14 (Rishpana) → `ward_14` / `ward_14`

---


---

##  Implemented Features

### Authentication
- JWT-based authentication with 30-day token expiry
- Role-based access control (Citizen / Ward Authority / Admin)
- Token validation on page load — expired tokens auto-clear
- Ward authority login via ward number (`ward_14`)

### Citizen Features
- **Report Submission** — photo upload (JPEG/PNG, max 10MB) + GPS location
- **Ward Detection** — shows citizen which ward their report goes to before submission
- **My Reports** — view all submitted reports with status, severity, repair history
- **Citizen Dashboard** — personal stats (total/pending/resolved), doughnut chart, recent reports
- **City Heatmap** — Leaflet.js interactive map with severity-based color coding
- **Ward Analytics** — bar charts comparing wards by reports, resolution rate, avg severity

### Ward Authority Features
- Dashboard filtered to their ward only (by ward number)
- Reports table with status update dropdown
- Repair log — log action taken, update status, add notes
- Damage zones tab — clustered zones sorted by urgency score
- Manual clustering trigger for their ward
- Heatmap with ward-specific view + "Show Full City" toggle

### Admin Features
- All reports across all wards
- Bulk verify pending reports (testing utility)
- System config — tune urgency weights, clustering parameters
- Ward management — view/add/delete wards, bulk import new cities
- Run clustering across all wards

### ML Pipeline (Python FastAPI)
- `/predict` — mock CNN image classification (damage type + severity 1–5)
- `/cluster` — DBSCAN spatial clustering with scikit-learn
- `/resolve-ward` — 3-phase ward resolution:
  - Phase 1: Photon reverse geocoding
  - Phase 2: RapidFuzz fuzzy string matching (Levenshtein distance, threshold 75%)
  - Phase 3: Haversine distance to ward centroids (fallback)
- Full SQLite CRUD for ward data management

### Geospatial Intelligence
- **3-phase ward resolution** — handles Unicode diacritics, spelling variations, vague addresses
- **OpenStreetMap Overpass API** — detects road type (highway/state road/residential/lane) from GPS
- **Road type → responsible authority** mapping (NHAI / PWD / Ward Authority)
- **Haversine distance** calculation for proximity clustering

### Clustering & Urgency Scoring
- DBSCAN groups reports within 75m radius + same road type → DamageZone
- **Urgency score formula** (0–10):
  - Severity: 30%
  - Cluster size (log-scaled): 20%
  - Rainfall factor (Open-Meteo API): 15%
  - Damage type weight: 15%
  - Road type weight: 20%
- Auto-clustering every 6 hours via `node-cron`
- Ward-level type clustering (separate zones per damage type per ward)

### Multi-City Support
- SQLite stores city → ward → centroid data
- Admin adds new city wards via bulk JSON import
- Ward authority accounts auto-seeded from SQLite on backend startup

---


## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas (Mongoose) |
| ML Service | Python, FastAPI, uvicorn |
| Ward Data | SQLite (via Python) |
| ML Libraries | scikit-learn (DBSCAN), RapidFuzz, geopy |
| Frontend | Vanilla HTML, CSS, JavaScript |
| Maps | Leaflet.js, leaflet.heat |
| Charts | Chart.js |
| Geocoding | OpenStreetMap Nominatim, Photon |
| Road Data | OpenStreetMap Overpass API |
| Weather | Open-Meteo API |
| Scheduling | node-cron |
| Auth | JWT (jsonwebtoken) |
| File Upload | Multer |

---
