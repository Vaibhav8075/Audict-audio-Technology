# DCM Call Audit & Feedback Management Platform

An AI-powered quality auditing and self-evaluation platform designed for customer service and quality assurance teams. This secure workspace enables administrators to upload call recordings, generate AI evaluation metrics, design custom feedback questionnaires, and compile detailed feedback databases.

---

##  Key Features

###  Privacy-First Security & Visibility
* **Strict Role Boundaries**: Employees can view the list of public call audits (offering official assurance of compliance), but other users' call details and audio players are **strictly locked** (marked with a lock icon).
* **JWT Protected Audio Streaming**: Direct audio file paths are never exposed. Audio files are fetched securely via authenticated binary blob interceptors and bound dynamically using WaveSurfer.js.

###  Call Evaluation
* **AI Transcription**: Automatic call transcription using Whisper API.
* **AI Call Metrics**: Computes call quality scores, Customer Satisfaction (CSAT) gauges, and customer sentiments using Llama models.
* **Topic & Keyword Extraction**: Extracts recurring themes and keywords dynamically.
* **Actionable Suggestions**: Generates customized recommendations for call agents to improve their interactions.
* **ISO Yearly Week Tracker**: Tags calls automatically using the ISO week of the year and year they were uploaded for streamlined temporal grouping.

###  Custom Feedback & Form Builders
* **Dynamic Form Builder**: Admins can customize the questionnaire at any time—adding, editing, or removing questions with types like Yes/No, Rating (1-5), and Open Text.
* **Permanent Feedback Logs**: Submissions are preserved forever in the database. Clicking a log opens a detailed modal mapping out the full questionnaire and employee responses.

###  Retention & Auto-Cleanups
* **Dynamic Audio Retention Policy**: Admins can customize the retention duration (in days) dynamically from the Admin Settings dashboard. Call recordings (audio files) are automatically cleaned up from disk after the specified number of days, while all feedback and textual metadata are preserved permanently.
* **Active Background Scheduler**: An integrated APScheduler engine manages daily file expiry runs and weekly disk safety cleanups.

###  Professional Dashboard Analytics
* **Consolidated Trends**: Area charts tracking daily audit activity volumes over a rolling 7-day window.
* **Legible Charting**: Recharts-based high-contrast tooltips fully readable in both Light and Dark themes.

---

## 🔄 System Workflow & Data Flow

### 1. System Workflow Sequence
This workflow outlines the step-by-step lifecycle of a call audit:

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    actor Agent as Call Agent (Employee)
    actor HOD as HOD Evaluator
    participant Sys as DCM System (Backend / AI)
    participant Groq as Groq AI Cloud

    Admin->>Sys: Create call audit & upload recording audio
    activate Sys
    Sys->>Sys: Write audio binary to storage disk
    Sys->>Groq: Request transcription (Whisper Large V3)
    Groq-->>Sys: Return text transcript
    Sys->>Groq: Request call scoring & insights (Llama 3.3)
    Groq-->>Sys: Return Quality Score, CSAT, Sentiment & Summary
    Sys-->>Admin: Audit created & AI Insights ready
    deactivate Sys

    Sys-->>Agent: Send Dashboard Notification
    Agent->>Sys: View audit details & play secure waveform audio
    Agent->>Sys: Complete and submit Self-Evaluation Form

    HOD->>Sys: View agent's evaluation responses
    HOD->>Sys: Submit HOD QA Compliance Rating & Comments
    Sys->>Sys: Compile scorecard metrics and leaderboard averages
```

### 2. Application Data Flow Architecture
This diagram displays how user interactions traverse the platform infrastructure:

```mermaid
graph TD
    User([User: Admin / HOD / Agent]) <-->|HTTPS / JSON Payload| Nginx[Nginx Reverse Proxy]
    
    subgraph Frontend [Frontend Layer]
        Nginx <-->|Serves static build| HTML[React SPA: index.html / JS / CSS]
        HTML -->|Audio Waveform rendering| WS[WaveSurfer.js]
    end
    
    subgraph Backend [FastAPI Backend Service]
        Nginx <-->|Reverse Proxy API requests| API[FastAPI REST Router]
        API <-->|Secure Audio Stream| WS
        API -->|Outbound HTTPS request| Groq[Groq AI Cloud API]
        Scheduler[APScheduler Service] -->|Triggers Daily Expiry| Clean[File Cleanup Utility]
    end

    subgraph Storage [Server Data Storage]
        API <-->|SQL Database Operations| DB[(PostgreSQL / SQLite Database)]
        API <-->|Write/Read Audio File| Disk[(Filesystem: backend/storage/recordings/)]
        Clean -->|Delete expired audio| Disk
    end
```

---

##  Tech Stack

### Backend Layer
* **Core**: FastAPI (Python 3)
* **ORM & Database**: SQLAlchemy (SQLite for local development, PostgreSQL 18+ for production deployment)
* **Task Scheduling**: APScheduler (Daily cleanup workers)
* **AI Integrations**: Groq Whisper STT (`whisper-large-v3`) & Llama-3.3 (`llama-3.3-70b-versatile`)

### Frontend Layer
* **Framework**: React & Vite
* **Styling**: Vanilla CSS & TailwindCSS (configured with Neutral Luxury and Coffee theme variables)
* **Media Rendering**: WaveSurfer.js (secure waveform audio rendering)
* **Visualizations**: Recharts (with custom tooltips)

---

##  Storage Architecture (Where Data is Stored)

The system uses a modern, high-performance split storage architecture:

1. **Database (User Accounts, Audits, Feedback, QA Evaluations, Logs)**:
   * **Local Development**: Stored in a local file at `backend/dcm_audit.db` (SQLite).
   * **Production Deployment**: Stored in a secure **PostgreSQL** database named `dcm_db` (located on the server's OS filesystem at `/var/lib/postgresql/18/main/`).
2. **Call Recording Audios (Large Binary Files)**:
   * Saved directly onto the server's filesystem under the folder `backend/storage/recordings/`.
   * Only the lightweight file path references (e.g. `storage/recordings/xxxx.mp3`) are stored in the database. This keeps the database lightweight, fast, and easy to backup.
3. **App Code & Configuration**:
   * Stored under `/home/root1/Audict-audio-Technology/`.
   * Credentials and database URLs are configured via `/home/root1/Audict-audio-Technology/backend/.env`.

---

##  Setup & Installation

### 1. Backend Setup
Navigate into the `backend/` directory:
```bash
cd backend
```

Create and activate a virtual environment:
```bash
python -m venv venv
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate
```

Install requirements:
```bash
pip install -r requirements.txt
```

Create a `.env` file inside `backend/` containing:
```env
GROQ_API_KEY=your_groq_api_key_here
API_KEY=your_jwt_signing_secret_here
RECORDING_EXPIRY_DAYS=7
STORAGE_PATH=storage/recordings
DATABASE_URL=sqlite:///./dcm_audit.db # Use SQLite locally, or PostgreSQL in production
```

Run the backend server:
```bash
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Frontend Setup
Navigate into the root directory and install dependencies:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```

The application will be accessible at `http://localhost:5173`.

---

##  Production Deployment (Ubuntu Server with PostgreSQL)

For deploying this platform on a local network Ubuntu Server at `192.168.1.2`, follow these instructions:

### 1. Install and Configure PostgreSQL
Install PostgreSQL 18:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib -y
```

Log in to the PostgreSQL prompt:
```bash
sudo -u postgres psql
```

Create the database, user, and configure ownership/permissions:
```sql
CREATE DATABASE dcm_db;
CREATE USER dcm_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE dcm_db TO dcm_user;
\c dcm_db
GRANT ALL ON SCHEMA public TO dcm_user;
ALTER DATABASE dcm_db OWNER TO dcm_user;
\q
```

Update your `/home/root1/Audict-audio-Technology/backend/.env` file with the connection string (if your password has special characters like `@`, URL-encode them as `%40`):
```env
DATABASE_URL=postgresql://dcm_user:your_secure_password@localhost:5432/dcm_db
```

### 2. SQLite to PostgreSQL Database Migration
If you already have existing audits and user accounts inside SQLite, run the built-in migration utility scripts:

1. **Migrate Records**: Run the copier to import all tables into PostgreSQL:
   ```bash
   backend/venv/bin/python backend/migrate_sqlite_to_postgres.py
   ```
2. **Sync Counters**: Run the sequence reset script to avoid key conflicts on new database entries:
   ```bash
   backend/venv/bin/python backend/sync_postgres_sequences.py
   ```

### 3. Backend Service Setup (Systemd)
Register FastAPI as a Systemd service. Create `/etc/systemd/system/dcm-backend.service`:
```ini
[Unit]
Description=FastAPI Backend for DCM Audit System
After=network.target

[Service]
User=root1
WorkingDirectory=/home/root1/Audict-audio-Technology/backend
ExecStart=/home/root1/Audict-audio-Technology/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable dcm-backend
sudo systemctl start dcm-backend
```

### 4. Frontend Hosting Setup (Nginx)
Install Nginx on the server:
```bash
sudo apt update
sudo apt install -y nginx
```

Build the production assets:
```bash
npm run build
```

Configure Nginx to serve the frontend and reverse-proxy the API requests. Create `/etc/nginx/sites-available/dcm`:
```nginx
server {
    listen 80;
    server_name _; # Wildcard server name to respond to any local IP

    # Serve compiled static files
    location / {
        root /home/root1/Audict-audio-Technology/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Reverse proxy backend API calls
    location /_/backend/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 100M;
    }
}
```

Enable the configuration and disable the default site:
```bash
sudo ln -sf /etc/nginx/sites-available/dcm /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

##  Security Architecture
1. **API Interceptors**: The frontend utilizes custom Axios interceptors to inject authorization headers dynamically.
2. **Blob Audio Handlers**: HTML5 audio tags are blocked from direct URL requests. Instead, audio data is fetched inside an authorized stream block as a `responseType: 'blob'`, dynamically building local object URLs (`URL.createObjectURL`).
3. **Data Preservation**: Feedback logs, audit records, and user logs are permanently preserved to retain clean auditing trails.
