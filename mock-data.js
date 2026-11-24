/**
 * HydroTrack - Water Leakage Complaint Tracking System
 * Mock Data Store & State Management
 */

const INITIAL_COMPLAINTS = [
  {
    id: "HT-2026-1049",
    category: "Main Pipeline Burst",
    severity: "Critical",
    severityLevel: 4, // 1: Low, 2: Medium, 3: High, 4: Critical
    location: {
      address: "Intersection of 5th Main & 12th Cross, Indiranagar",
      ward: "Ward 12 - East Central",
      landmark: "Near Metro Pillar 142",
      lat: 12.9784,
      lng: 77.6408
    },
    reporter: {
      name: "Rajesh Sharma",
      phone: "+91 98765 43210",
      email: "rajesh.sharma@example.com"
    },
    description: "High-pressure underground drinking water transmission line burst. Water gushing onto the main road creating severe waterlogging and pressure drop in adjacent residential blocks.",
    pipeDiameter: "300mm (Transmission Main)",
    waterLossRateLph: 14500, // Liters per hour
    reportedAt: "2026-11-23T18:40:00Z",
    status: "In Progress", // Reported, Dispatched, In Progress, Resolved
    assignedTechnician: {
      id: "TECH-04",
      name: "Vikas Kumar (Senior Hydro Engineer)",
      phone: "+91 94421 88901",
      vehicle: "Emergency Repair Van #07",
      eta: "On-Site (Active Work)"
    },
    timeline: [
      { status: "Reported", time: "18:40", note: "Complaint logged by citizen with photo evidence." },
      { status: "Triaged", time: "18:45", note: "Priority escalated to Critical by Municipal AI system." },
      { status: "Dispatched", time: "18:52", note: "Crew 04 dispatched with heavy trenching equipment." },
      { status: "In Progress", time: "19:15", note: "Excavation completed. Isolation valve closed; clamp sleeve installation underway." }
    ],
    photoUrl: "assets/images/burst-pipe.svg",
    estimatedWaterSavedUponFix: 116000
  },
  {
    id: "HT-2026-1050",
    category: "Street Valve Leakage",
    severity: "High",
    severityLevel: 3,
    location: {
      address: "Opposite Community Park, 7th Sector, HSR Layout",
      ward: "Ward 174 - South Sector",
      landmark: "Next to Electrical Substation",
      lat: 12.9121,
      lng: 77.6446
    },
    reporter: {
      name: "Sneha Reddy",
      phone: "+91 98234 11099",
      email: "sneha.r@example.com"
    },
    description: "Distribution valve casing cracked. Continuous stream of potable water overflowing into storm drain for past 6 hours.",
    pipeDiameter: "150mm (Sub-Distribution)",
    waterLossRateLph: 4800,
    reportedAt: "2026-11-23T16:15:00Z",
    status: "Dispatched",
    assignedTechnician: {
      id: "TECH-09",
      name: "Ramesh Naik (Field Technician)",
      phone: "+91 91102 33451",
      vehicle: "Utility Utility Truck #12",
      eta: "15 mins away (ETA 22:30)"
    },
    timeline: [
      { status: "Reported", time: "16:15", note: "Citizen complaint registered via mobile web portal." },
      { status: "Triaged", time: "16:30", note: "Work order approved by Ward Engineer." },
      { status: "Dispatched", time: "22:10", note: "Technician Ramesh assigned following previous job completion." }
    ],
    photoUrl: "assets/images/street-valve.svg",
    estimatedWaterSavedUponFix: 45000
  },
  {
    id: "HT-2026-1051",
    category: "Fire Hydrant Damage",
    severity: "Critical",
    severityLevel: 4,
    location: {
      address: "Commercial Ring Road, near City Center Mall",
      ward: "Ward 08 - Central Business District",
      landmark: "Near Mall Gate #2",
      lat: 12.9719,
      lng: 77.6012
    },
    reporter: {
      name: "Amitabh Sen (Traffic Warden)",
      phone: "+91 99001 22883",
      email: "traffic.warden08@citygov.org"
    },
    description: "Hydrant sheared off after vehicular impact. Water fountain reaching 15 feet high, obstructing traffic lanes.",
    pipeDiameter: "200mm (High Pressure Fire Ring)",
    waterLossRateLph: 22000,
    reportedAt: "2026-11-23T21:05:00Z",
    status: "Reported",
    assignedTechnician: null,
    timeline: [
      { status: "Reported", time: "21:05", note: "Emergency complaint received from Traffic Warden." }
    ],
    photoUrl: "assets/images/fire-hydrant.svg",
    estimatedWaterSavedUponFix: 88000
  },
  {
    id: "HT-2026-1048",
    category: "Meter Box & Service Connection",
    severity: "Medium",
    severityLevel: 2,
    location: {
      address: "#42, 3rd Cross, Malleshwaram",
      ward: "Ward 45 - North West",
      landmark: "Opposite Canara Bank",
      lat: 13.0031,
      lng: 77.5643
    },
    reporter: {
      name: "Kavitha Nambiar",
      phone: "+91 97405 66782",
      email: "kavitha.n@example.com"
    },
    description: "Rust degradation at the ferrule connection to domestic meter. Moderate steady seepage forming stagnant puddle.",
    pipeDiameter: "25mm (Domestic Service Line)",
    waterLossRateLph: 350,
    reportedAt: "2026-11-23T11:20:00Z",
    status: "Resolved",
    assignedTechnician: {
      id: "TECH-02",
      name: "Anand Verma",
      phone: "+91 98860 45123",
      vehicle: "Bike Unit #05",
      eta: "Completed"
    },
    timeline: [
      { status: "Reported", time: "11:20", note: "Complaint logged." },
      { status: "Triaged", time: "11:45", note: "Assigned to Zone Plumber Anand Verma." },
      { status: "Dispatched", time: "12:10", note: "Plumber on way." },
      { status: "In Progress", time: "13:00", note: "Ferrule valve tightened, brass nipple replaced." },
      { status: "Resolved", time: "14:15", note: "Repair completed. Pressure verified at 2.8 bar. Leak sealed." }
    ],
    photoUrl: "assets/images/meter-leak.svg",
    resolutionNotes: "Replaced degraded GI fitting with anti-corrosive CPVC union. 0 leaks detected under 3 bar pressure.",
    resolvedAt: "2026-11-23T14:15:00Z",
    estimatedWaterSavedUponFix: 8400
  },
  {
    id: "HT-2026-1045",
    category: "Road Sub-surface Leakage",
    severity: "High",
    severityLevel: 3,
    location: {
      address: "80 Feet Road, Koramangala 4th Block",
      ward: "Ward 67 - South East",
      landmark: "Near Sony World Junction",
      lat: 12.9345,
      lng: 77.6252
    },
    reporter: {
      name: "Deepak Joshi",
      phone: "+91 94481 99201",
      email: "deepak.j@example.com"
    },
    description: "Water bubbling up continuously from asphalt cracks. Sub-base weakening observed, risk of road cave-in.",
    pipeDiameter: "200mm (Ductile Iron Pipe)",
    waterLossRateLph: 8200,
    reportedAt: "2026-11-22T09:00:00Z",
    status: "Resolved",
    assignedTechnician: {
      id: "TECH-04",
      name: "Vikas Kumar (Senior Hydro Engineer)",
      phone: "+91 94421 88901",
      vehicle: "Emergency Repair Van #07",
      eta: "Completed"
    },
    timeline: [
      { status: "Reported", time: "09:00", note: "Citizen complaint registered with road video." },
      { status: "Triaged", time: "09:20", note: "Emergency squad alerted." },
      { status: "In Progress", time: "10:30", note: "Acoustic leak detection pinpointed joint failure." },
      { status: "Resolved", time: "16:45", note: "Cast iron collar installed and road temporarily patched." }
    ],
    photoUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=800&q=80",
    resolutionNotes: "Acoustic sensor identified bell-and-spigot joint separation. Re-caulked and installed external repair band.",
    resolvedAt: "2026-11-22T16:45:00Z",
    estimatedWaterSavedUponFix: 196800
  },
  {
    id: "HT-2026-1042",
    category: "Public Tap / Standpost Leak",
    severity: "Low",
    severityLevel: 1,
    location: {
      address: "Gandhi Bazar Circle, Basavanagudi",
      ward: "Ward 154 - South Heritage",
      landmark: "Near Vidyarthi Bhavan",
      lat: 12.9438,
      lng: 77.5739
    },
    reporter: {
      name: "Suresh Rao",
      phone: "+91 98450 77112",
      email: "suresh.rao@example.com"
    },
    description: "Public drinking tap washer worn out, dripping continuously day and night.",
    pipeDiameter: "15mm (Public Standpost)",
    waterLossRateLph: 90,
    reportedAt: "2026-11-21T14:00:00Z",
    status: "Resolved",
    assignedTechnician: {
      id: "TECH-08",
      name: "Pooja Shankar",
      phone: "+91 94498 12345",
      vehicle: "Utility Bike #02",
      eta: "Completed"
    },
    timeline: [
      { status: "Reported", time: "14:00", note: "Logged by citizen." },
      { status: "Resolved", time: "17:30", note: "Brass spindle & rubber washer replaced with push-cock valve." }
    ],
    photoUrl: "https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80",
    resolvedAt: "2026-11-21T17:30:00Z",
    estimatedWaterSavedUponFix: 2160
  }
];

const TECHNICIANS_LIST = [
  { id: "TECH-04", name: "Vikas Kumar", role: "Senior Hydro Engineer", phone: "+91 94421 88901", status: "Active On-Site", currentJob: "HT-2026-1049", rating: 4.9, zone: "East Central" },
  { id: "TECH-09", name: "Ramesh Naik", role: "Field Technician", phone: "+91 91102 33451", status: "Dispatched", currentJob: "HT-2026-1050", rating: 4.7, zone: "South Sector" },
  { id: "TECH-01", name: "Sunil Gowda", role: "Rapid Response Specialist", phone: "+91 98801 77623", status: "Available", currentJob: null, rating: 4.8, zone: "Central CBD" },
  { id: "TECH-02", name: "Anand Verma", role: "Lead Plumber", phone: "+91 98860 45123", status: "Available", currentJob: null, rating: 4.9, zone: "North West" },
  { id: "TECH-08", name: "Pooja Shankar", role: "Water Quality & Valve Tech", phone: "+91 94498 12345", status: "Available", currentJob: null, rating: 4.9, zone: "South Heritage" }
];

const WARDS_DATA = [
  { id: "W12", name: "Ward 12 - East Central", openLeaks: 1, criticalCount: 1, officer: "Er. K. Natarajan" },
  { id: "W174", name: "Ward 174 - South Sector", openLeaks: 1, criticalCount: 0, officer: "Er. S. Meenakshi" },
  { id: "W08", name: "Ward 08 - Central Business District", openLeaks: 1, criticalCount: 1, officer: "Er. H. Farooq" },
  { id: "W45", name: "Ward 45 - North West", openLeaks: 0, criticalCount: 0, officer: "Er. P. Bopaiah" },
  { id: "W67", name: "Ward 67 - South East", openLeaks: 0, criticalCount: 0, officer: "Er. T. Venkatesh" }
];
