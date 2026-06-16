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

###  Custom Feedback & Form Builders
* **Dynamic Form Builder**: Admins can customize the questionnaire at any time—adding, editing, or removing questions with types like Yes/No, Rating (1-5), and Open Text.
* **Permanent Feedback Logs**: Submissions are preserved forever in the database. Clicking a log opens a detailed modal mapping out the full questionnaire and employee responses.

###  Retention & Auto-Cleanups
* **7-Day Retention Limit**: Call recordings (audio files) are automatically cleaned up from disk 7 days after upload to minimize storage overhead, while all feedback and textual metadata are preserved permanently.
* **Active Background Scheduler**: An integrated APScheduler engine manages daily file expiry runs and weekly disk safety cleanups.

###  Professional Dashboard Analytics
* **Consolidated Trends**: Area charts tracking daily audit activity volumes over a rolling 7-day window.
* **Legible Charting**: Recharts-based high-contrast tooltips fully readable in both Light and Dark themes.

---

##  Tech Stack

### Backend Layer
* **Core**: FastAPI (Python 3)
* **ORM & Database**: SQLAlchemy & SQLite
* **Task Scheduling**: APScheduler (Daily cleanup workers)
* **AI Integrations**: Groq Whisper STT (`whisper-large-v3`) & Llama-3.3 (`llama-3.3-70b-versatile`)

### Frontend Layer
* **Framework**: React & Vite
* **Styling**: Vanilla CSS & TailwindCSS (configured with Neutral Luxury and Coffee theme variables)
* **Media Rendering**: WaveSurfer.js (secure waveform audio rendering)
* **Visualizations**: Recharts (with custom tooltips)

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

## 🚀 Production Deployment (Ubuntu Server)

For deploying this platform on a local network Ubuntu Server (e.g. an old PC serving as a local server at `192.168.1.2`), follow these instructions:

### 1. Backend Service Setup (Systemd)
To ensure the FastAPI backend runs continuously in the background and restarts on reboot, register it as a Systemd service:

Create `/etc/systemd/system/dcm-backend.service`:
```bash
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

### 2. Frontend Hosting Setup (Nginx)
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

Ensure the firewall is updated or disabled:
```bash
sudo ufw allow 'Nginx Full'
# or disable entirely
sudo ufw disable
```

---

## 🔒 Security Architecture
1. **API Interceptors**: The frontend utilizes custom Axios interceptors to inject authorization headers dynamically.
2. **Blob Audio Handlers**: HTML5 audio tags are blocked from direct URL requests. Instead, audio data is fetched inside an authorized stream block as a `responseType: 'blob'`, dynamically building local object URLs (`URL.createObjectURL`).
3. **Data Preservation**: Feedback logs, audit records, and user logs are permanently preserved to retain clean auditing trails.
