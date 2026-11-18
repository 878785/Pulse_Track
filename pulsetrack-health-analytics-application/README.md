# PulseTrack

PulseTrack is a Flask health analytics dashboard. Its Python circular linked list manages live records, and SQLite persists them between runs. The responsive dashboard includes health records, calendar, analytics, a linked-list explainer, CSV/JSON export, JSON import, and theme settings.

## Run on Windows

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Open <http://127.0.0.1:5000>. To stop the server, press `Ctrl+C`.

The application creates `data\pulsetrack.db` on the first run. Health records are managed by the backend circular linked list and written to SQLite on every change. Theme and appearance preferences remain in browser storage.

## Deploy the complete app on Render

This project serves its dashboard and Flask API from the same application, so the simplest deployment is one Render Web Service (not a separate Netlify site).

1. Push the project to a GitHub repository. Do not upload `.venv` or `data\pulsetrack.db`; `.gitignore` excludes both.
2. In Render, choose **New → Web Service** and connect the repository. Set the root directory to the project root.
3. Choose Python. Set the build command to `pip install -r requirements.txt`.
4. Set the start command to `gunicorn app:app --bind 0.0.0.0:$PORT`.
5. In the service settings, attach a persistent disk mounted at `/var/data`.
6. Add the environment variable `PULSETRACK_DATABASE` with value `/var/data/pulsetrack.db`.
7. Deploy, open the generated `https://...onrender.com` address, and test by saving a record.

**Important:** SQLite must be placed on a persistent disk or records can disappear when the service restarts or redeploys. The Render disk path and environment variable above make the database survive those events. Persistent disks may require a paid Render plan. The app and its API use the same domain, so no separate Netlify frontend or CORS setup is needed.

## Project layout

```text
app.py
database/       SQLite schema, connection and query helpers
routes/         Flask page/API blueprints
services/       Health-record and analytics logic
structures/     Python circular linked list and node
templates/      Jinja2 dashboard shell and one partial per app page
modules/        Browser-side charts, calendar, exports and live visualizer
style.css       Responsive design system
script.js       Browser application controller
```

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/records` | List health records; use `?search=` to search the linked-list traversal |
| GET | `/api/records/<date>` | Search a record by date |
| POST | `/api/records` | Add a record |
| PUT | `/api/records/<date>` | Update a record |
| DELETE | `/api/records/<date>` | Delete a record |
| DELETE | `/api/records` | Clear all records |
| POST | `/api/records/import` | Validate and import a JSON records array |
| GET | `/api/dashboard/stats` | Dashboard totals and averages |
| GET | `/api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD` | Analytics records and stats |
| GET | `/api/calendar?year=YYYY&month=M` | Calendar month records |
| GET | `/api/data-structure` | Live linked-list head, tail and integrity |
| GET | `/api/settings/storage` | SQLite storage information |

Record fields are `date` (`YYYY-MM-DD`), `steps` (0–200,000), `calories` (0–20,000), and `sleep` (0–24 hours). Only one record per date is allowed.

## Tests

```powershell
python -m unittest discover -s tests -v
```
