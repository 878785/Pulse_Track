# PulseTrack — Health Analytics & Data Structure Intelligence

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.x-blue?logo=python" />
  <img src="https://img.shields.io/badge/Flask-Backend-black?logo=flask" />
  <img src="https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite" />
  <img src="https://img.shields.io/badge/Data%20Structure-Circular%20Linked%20List-purple" />
  <img src="https://img.shields.io/badge/Deployment-Render-46E3B7?logo=render" />
  <img src="https://img.shields.io/badge/Status-Live-success" />
</p>

<h2 align="center">Your Health. Your Data. Your Insights.</h2>

<p align="center">
  A full-stack health analytics application powered by Python, Flask, SQLite and a custom Circular Linked List implementation.
</p>

<p align="center">
  <a href="https://pulse-track-t61e.onrender.com/">
    <img src="https://img.shields.io/badge/🚀_OPEN_LIVE_APPLICATION-Visit_PulseTrack-6C63FF?style=for-the-badge" />
  </a>
  <a href="https://github.com/878785/Pulse_Track/tree/main/pulsetrack-health-analytics-application">
    <img src="https://img.shields.io/badge/💻_VIEW_SOURCE_CODE-GitHub-24292F?style=for-the-badge&logo=github" />
  </a>
</p>

---

## 📌 About the Project

**PulseTrack** is a full-stack health analytics dashboard designed to record, manage, visualize and analyze daily health metrics.

The core of this application is a custom-built **Circular Linked List**, implemented in Python to manage health records dynamically. SQLite provides persistent storage, while Flask connects the backend logic with the interactive dashboard.

Instead of using a conventional database-only approach for record management, PulseTrack demonstrates how a fundamental data structure can power real-world application logic.

### 🎯 Project Objectives

- Implement Circular Linked List operations in a practical application.
- Manage daily health records dynamically.
- Understand the integration of data structures with databases.
- Visualize health statistics through interactive charts.
- Demonstrate CRUD operations using RESTful APIs.
- Maintain data persistence using SQLite.

## 🌐 Live Application

**Try PulseTrack directly in your browser:**

https://pulse-track-t61e.onrender.com/

No local installation is required to explore the deployed dashboard.

## ✨ Key Features

| Feature | Description |
|---|---|
| 📊 Overview Dashboard | Displays health statistics, totals and averages. |
| 📝 Health Records | Add, search, update and delete daily records. |
| 📅 Interactive Calendar | Explore health activity by date. |
| 📈 Analytics | Visualize steps, calories and sleep trends. |
| 🔗 Circular Linked List | Demonstrates live nodes, head, tail and pointers. |
| ⚙️ List Operations | Perform insertion, searching and deletion. |
| 📤 CSV Export | Export records for Excel and Google Sheets. |
| 📦 JSON Export | Download structured data backups. |
| 📥 JSON Import | Validate and restore previous records. |
| 🎨 Theme Settings | Customize dark, light and system appearance. |
| 💾 Persistent Storage | Save health records using SQLite. |

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Python | Core application logic |
| Flask | Backend framework and API |
| Circular Linked List | Dynamic health-record management |
| SQLite | Persistent database storage |
| HTML5 | Dashboard structure |
| CSS3 | Responsive interface and styling |
| JavaScript | Interactive frontend functionality |
| Chart.js | Data visualization |
| Jinja2 | Server-side templating |
| Gunicorn | Production application server |
| Render | Cloud deployment |

## 🧠 Core Data Structure: Circular Linked List

The most important technical component of PulseTrack is its custom Python Circular Linked List.

Each node stores:

- Unique record ID
- Date
- Steps
- Calories
- Sleep duration
- Reference to the next node

### Structure

```text
       HEAD
         |
         v
     +--------+
     | Node 1 |
     +--------+
         |
         v
     +--------+
     | Node 2 |
     +--------+
         |
         v
     +--------+
     | Node 3 |
     +--------+
         |
         +-----------> HEAD
```

The last node points back to the first node, creating a circular structure.

### Operations and Complexity

| Operation | Complexity | Explanation |
|---|---|---|
| Insertion at tail | O(1) pointer relinking | Connects the new node to the list |
| Search | O(n) | Traverses nodes to find a date |
| Update | O(n) | Searches for the record before updating |
| Delete | O(n) | Finds and removes the matching node |
| Traversal | O(n) | Visits each node exactly once |

**Important:** Checking date uniqueness makes the complete insertion operation O(n), even though tail pointer relinking itself is O(1).

## 🏗️ Application Architecture

```text
             USER
              |
              v
       FLASK WEB APP
              |
       +------+------+
       |             |
       v             v
   REST APIs     Dashboard
       |             |
       v             v
    SERVICES     JavaScript
       |
       v
 CIRCULAR LINKED LIST
       |
       v
   SQLITE DATABASE
```

### Data Flow

1. The user enters a health record through the dashboard.
2. JavaScript sends the request to the Flask API.
3. The service validates the incoming data.
4. The Circular Linked List performs the required operation.
5. SQLite stores the updated records.
6. The dashboard refreshes its statistics and visualizations.

## 📂 Project Structure

```text
pulsetrack-health-analytics-application/
│
├── app.py
├── requirements.txt
│
├── database/
│   ├── Database connection and schema
│   └── Query helpers
│
├── routes/
│   ├── Flask page routes
│   └── REST API blueprints
│
├── services/
│   ├── Health record management
│   └── Analytics logic
│
├── structures/
│   ├── Circular Linked List
│   └── Node implementation
│
├── templates/
│   ├── Dashboard templates
│   └── Page partials
│
├── modules/
│   ├── Charts
│   ├── Calendar
│   ├── Exports
│   └── Linked List Visualizer
│
├── tests/
│   └── Unit tests
│
├── style.css
└── script.js
```

## 🔌 REST API Documentation

| Method | Endpoint | Function |
|---|---|---|
| GET | `/api/records` | Retrieve all records |
| GET | `/api/records?search=` | Search records |
| GET | `/api/records/<date>` | Find a record by date |
| POST | `/api/records` | Insert a new record |
| PUT | `/api/records/<date>` | Update a record |
| DELETE | `/api/records/<date>` | Delete a record |
| DELETE | `/api/records` | Clear all records |
| POST | `/api/records/import` | Import JSON records |
| GET | `/api/dashboard/stats` | Retrieve dashboard statistics |
| GET | `/api/analytics` | Retrieve analytics |
| GET | `/api/calendar` | Retrieve calendar records |
| GET | `/api/data-structure` | Inspect linked-list information |
| GET | `/api/settings/storage` | Retrieve storage information |

### Record Validation

| Field | Validation |
|---|---|
| Date | YYYY-MM-DD |
| Steps | 0–200,000 |
| Calories | 0–20,000 |
| Sleep | 0–24 hours |

Only one health record is allowed per date.

## 💻 Installation & Local Setup

### Prerequisites

- Python 3.x
- Git
- Code editor (VS Code recommended)

### Step 1: Clone the Repository

```powershell
git clone https://github.com/878785/Pulse_Track.git
```

### Step 2: Navigate to the Application

```powershell
cd Pulse_Track/pulsetrack-health-analytics-application
```

### Step 3: Create Virtual Environment

```powershell
py -m venv .venv
```

### Step 4: Activate Environment

```powershell
.\.venv\Scripts\Activate.ps1
```

### Step 5: Install Dependencies

```powershell
python -m pip install -r requirements.txt
```

### Step 6: Run Application

```powershell
python app.py
```

### Step 7: Open in Browser

http://127.0.0.1:5000/

## ☁️ Cloud Deployment

PulseTrack is deployed using Render.

**Live URL:** https://pulse-track-t61e.onrender.com/

The application uses a single Flask Web Service for both the dashboard and API.

For persistent SQLite storage on Render:

1. Connect the GitHub repository to a Render Web Service.
2. Set the build command to `pip install -r requirements.txt`.
3. Set the start command to:

```bash
gunicorn app:app --bind 0.0.0.0:$PORT
```

4. Attach a persistent disk mounted at `/var/data`.
5. Configure the environment variable:

```text
PULSETRACK_DATABASE=/var/data/pulsetrack.db
```

**Note:** Persistent disks may require a paid Render plan. Without persistent storage, SQLite records may not survive service restarts or redeployments.

## 🧪 Testing

Run the unit tests using:

```powershell
python -m unittest discover -s tests -v
```

The test suite can be used to verify the Circular Linked List implementation and related functionality.

## 📸 Application Screenshots

Add screenshots of your actual deployed application in this section.

Recommended screenshots:

1. Dashboard Overview
2. Health Records Management
3. Interactive Calendar
4. Analytics Dashboard
5. Circular Linked List Visualization
6. Export and Import Interface
7. Theme Settings

Store your screenshots in a folder named `screenshots/` and reference them like this:

```markdown
![PulseTrack Dashboard](screenshots/dashboard.png)
![Analytics](screenshots/analytics.png)
![Circular Linked List](screenshots/linked-list.png)
```

## 🔮 Future Enhancements

- User authentication and individual profiles.
- Advanced health analytics and personalized reports.
- Additional data visualization options.
- Scheduled report generation.
- Improved data backup and recovery.
- Integration with external health-data sources.

## 👨‍💻 Developed By

**Sumit Mishra**

Master of Computer Applications (MCA)  
Manav Rachna Institute of Research and Studies

**Project:** PulseTrack — Health Analytics & Data Structure Intelligence

**GitHub:** https://github.com/878785

**Live Application:** https://pulse-track-t61e.onrender.com/

---

<p align="center">
  <b>Built with Python, Flask, SQLite and Circular Linked Lists.</b>
  <br/>
  <i>Turning Data Structures into Real-World Applications.</i>
</p>
