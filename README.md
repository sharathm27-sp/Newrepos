# 🌊 HydroTrack - Municipal Water Leakage Complaint Tracking System

A modern, unique, and professional web application and enterprise-grade Java system designed for municipal water authorities and citizens to report, track, and resolve water pipeline leakages in real-time.

---

## 🌟 Key Highlights & Innovations

1. **Citizen Portal**:
   - **One-Minute Complaint Registration**: Multi-category reporting (Main Pipeline Burst, Distribution Valve Leak, Damaged Fire Hydrant, Domestic Meter Leakage).
   - **Interactive GIS Pinpoint Map**: Drag-and-drop location marker with GPS coordinates capture and preset ward selections.
   - **Real-Time Dynamic Water Loss Estimator**: Automatically calculates estimated water wasted in Liters/Hour based on pipe diameter and pressure.
   - **Instant Tracking Code & Receipt**: Generates municipal tracking ID (e.g., `HT-2026-1049`) with simulated QR code and printable official receipt.

2. **Role-Based Access Control (RBAC) & Separate Logins**:
   - **Public Citizen Access**: No login required to file or track complaints.
   - **Field Crew Portal**: Protected by technician credentials (Badge ID `TECH-04` or `crew@hydrotrack.gov` / `crew123`).
   - **Municipal Admin Command Center**: Protected by administrative credentials (`admin` or `admin@hydrotrack.gov` / `admin123`).
   - One-click **⚡ Auto-Fill** buttons for effortless viva and evaluator demonstrations.

3. **Live Incident Tracking & Visual Stepper**:
   - 4-stage visual timeline (*Reported* → *Dispatched* → *In Progress* → *Resolved*).
   - Assigned field response crew card with contact details, repair vehicle ID, and live ETA.
   - Citizen interactive updates & note submission to on-site technicians.

3. **Field Engineer / Technician Dispatch Mode**:
   - Mobile-optimized work order feed for on-duty municipal plumbers and hydro engineers.
   - 1-click status transitions: *Accept Job & En Route* → *Arrived On Site* → *Complete Repair & Pressure QA Test*.
   - Repair signoff modal with parts replacement log and verification of water saved.

4. **Municipal Admin Command Center**:
   - High-impact KPI counters (Total Complaints, Active Incidents, Critical Alarms, Water Saved, Average SLA Response Time).
   - **Chart.js Visual Analytics**: Leak distribution by category (Doughnut chart) and incident frequency by municipal ward (Bar chart).
   - Searchable, filterable complaint master table with CSV data export.

5. **Hydraulic Engineering Calculator**:
   - Interactive calculation based on Torricelli's orifice discharge equation:
     $$Q = C_d \cdot A \cdot \sqrt{2gH}$$
   - Calculates water loss in Liters/min, Liters/day, and municipal financial cost.

6. **Audio & Visual Feedback**:
   - Built-in Web Audio API synthesizer for clean UI chimes and emergency alert tones (zero external audio dependencies).
   - Animated celebratory confetti upon ticket submission and leak resolution.

---

## 📂 Project Structure

```
water-leakage-tracking-system/
│
├── index.html                  # Main responsive web application
├── app.js                      # Core state management, Leaflet map engine & UI controllers
├── mock-data.js                # Initial realistic municipal seed dataset
├── start_server.py             # Built-in lightweight Python HTTP server
├── run.bat                     # Windows 1-click launcher
├── README.md                   # Project documentation & presentation guide
│
└── java-backend/               # Complete Java Mini-Project Source Code
    ├── database/
    │   └── schema.sql          # MySQL / PostgreSQL DDL schema & sample records
    └── src/
        └── com/hydrotrack/
            ├── model/
            │   ├── Complaint.java      # Model entity for water complaints
            │   └── Technician.java     # Model entity for field crews
            ├── dao/
            │   ├── DBConnection.java   # JDBC Connection singleton
            │   └── ComplaintDAO.java   # CRUD operations with PreparedStatements
            ├── service/
            │   └── WaterLossCalculator.java # Engineering Torricelli flow formulas
            └── controller/
                └── ComplaintController.java # RESTful Servlet API endpoints
```

---

## 🔐 Demo Login Credentials

| Role | Username / Badge ID | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Citizen (Public)** | *No login needed* | *N/A* | Report leaks, track tickets, use map & calculator |
| **Field Crew** | `TECH-04` or `crew@hydrotrack.gov` | `crew123` | View assigned work orders, update job status, upload QA repair signoff |
| **Municipal Admin** | `admin` or `admin@hydrotrack.gov` | `admin123` | Master command center, analytics charts, complaint triage & CSV export |

*(Both login screens include a **⚡ Auto-Fill** button for instant 1-click access during demos).*

---

## 🚀 How to Run the Web Application

### Method 1: Using the 1-Click Batch File (Windows)
Double-click `run.bat` in the project folder. It will start the server and automatically launch your default browser at `http://localhost:8080`.

### Method 2: Using Python (Command Line)
In PowerShell or Terminal:
```bash
python start_server.py
```
Open your browser to: `http://localhost:8080`

### Method 3: Direct File Open
You can also directly double-click `index.html` to open it in any modern browser (Chrome, Edge, Firefox, Safari).

---

## ☕ Java Mini-Project Integration Guide

This project includes a complete Java MVC backend in `java-backend/src/`. You can use it with **Eclipse**, **IntelliJ IDEA**, **Apache NetBeans**, or **VS Code**.

### 1. Database Setup (MySQL)
1. Open MySQL Workbench or phpMyAdmin.
2. Run the SQL script located at:
   `java-backend/database/schema.sql`
3. This creates the `hydrotrack_db` database and seeds it with initial technicians and complaints.

### 2. Configure Database Credentials
Edit `java-backend/src/com/hydrotrack/dao/DBConnection.java`:
```java
private static final String DB_URL = "jdbc:mysql://localhost:3306/hydrotrack_db";
private static final String DB_USER = "root";       // Your MySQL username
private static final String DB_PASSWORD = "password"; // Your MySQL password
```

### 3. REST API Endpoints
The Java backend exposes the following endpoints via `ComplaintController.java`:
- `GET  /api/complaints` - Fetch all complaints or query single ticket `?id=HT-2026-1049`
- `POST /api/complaints` - Register a new complaint from the citizen portal
- `PUT  /api/complaints` - Update complaint status, assign technician, or mark resolved

---

## 🎓 Viva-Voce & Presentation Talking Points

If presenting this as a college/university mini project or portfolio piece, highlight these points:

1. **Problem Statement**:
   - Non-Revenue Water (NRW): Up to 35-40% of treated municipal water is lost due to undetected leaks and slow citizen reporting channels.
   - Traditional municipal complaint systems are static, opaque, and lack real-time feedback for citizens.

2. **Our Technical Solution**:
   - **Real-Time Citizen Engagement**: Geo-tagged leak reports with photographic evidence and automated prioritization.
   - **Smart Field Dispatch**: Technicians receive mobile work orders and can sign off repairs with water pressure verification.
   - **Hydraulic Loss Quantification**: Not just logging tickets, but actively calculating and displaying liters of water saved.

3. **Software Architecture**:
   - **Frontend**: Clean Vanilla JavaScript (ES6+), Tailwind CSS styling, Leaflet.js GIS map rendering, Chart.js municipal analytics.
   - **Backend**: Java Enterprise / Servlet architecture with JDBC PreparedStatement security, DAO pattern, and REST JSON APIs.
   - **Database**: Relational normalized schema with foreign key integrity.
