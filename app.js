/**
 * HydroTrack - Water Leakage Complaint Tracking System
 * Core Frontend Application Logic
 */

class SoundController {
  constructor() {
    this.audioCtx = null;
    this.enabled = true;
  }

  init() {
    if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1) {
    if (!this.enabled) return;
    try {
      this.init();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  playSuccess() {
    if (!this.enabled) return;
    setTimeout(() => this.playTone(523.25, 'triangle', 0.12, 0.15), 0); // C5
    setTimeout(() => this.playTone(659.25, 'triangle', 0.14, 0.15), 100); // E5
    setTimeout(() => this.playTone(783.99, 'triangle', 0.25, 0.2), 200); // G5
  }

  playAlert() {
    if (!this.enabled) return;
    this.playTone(880, 'sawtooth', 0.12, 0.12);
    setTimeout(() => this.playTone(440, 'sawtooth', 0.18, 0.15), 120);
  }

  playClick() {
    if (!this.enabled) return;
    this.playTone(900, 'sine', 0.04, 0.05);
  }
}

const sounds = new SoundController();

// App State
class HydroTrackApp {
  constructor() {
    this.complaints = this.loadComplaints();
    this.currentUser = this.loadUser();
    this.activeView = 'citizen'; // 'citizen', 'technician', 'admin'
    this.citizenSubTab = 'report'; // 'report', 'track', 'map', 'stats'
    this.leafletMap = null;
    this.mapMarkers = [];
    this.pickerMap = null;
    this.pickerMarker = null;
    this.selectedComplaintForTrack = null;
    this.charts = {};

    this.init();
  }

  loadUser() {
    try {
      const stored = localStorage.getItem('hydrotrack_user_v1');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return { role: 'citizen', name: 'Citizen', id: null };
  }

  saveUser(user = this.currentUser) {
    try {
      localStorage.setItem('hydrotrack_user_v1', JSON.stringify(user));
    } catch (e) {}
  }

  loadComplaints() {
    try {
      const stored = localStorage.getItem('hydrotrack_complaints_v1');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Could not read localStorage, using default seed", e);
    }
    this.saveComplaints(INITIAL_COMPLAINTS);
    return [...INITIAL_COMPLAINTS];
  }

  saveComplaints(data = this.complaints) {
    try {
      localStorage.setItem('hydrotrack_complaints_v1', JSON.stringify(data));
    } catch (e) {
      console.error("Storage error", e);
    }
  }

  init() {
    this.bindGlobalEvents();
    this.setupAuthEvents();
    this.renderAuthStatus();
    this.updateStatsCards();
    this.renderRecentTicketsTicker();
    this.setupReportForm();
    this.setupWaterLossCalculator();
    this.renderTechnicianPortal();
    this.renderAdminPortal();

    // Check URL parameters for view redirection (from login.html)
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    if (viewParam && (viewParam === 'technician' || viewParam === 'admin')) {
      this.switchView(viewParam, true);
    } else {
      this.switchView('citizen', true);
    }
  }

  bindGlobalEvents() {
    // Nav view switcher
    document.querySelectorAll('[data-view-target]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        sounds.playClick();
        const view = btn.getAttribute('data-view-target');
        this.switchView(view);
      });
    });

    // Track search input and button binding
    const trackSearchBtn = document.getElementById('trackSearchBtn');
    const trackSearchInput = document.getElementById('trackSearchInput');
    if (trackSearchBtn && trackSearchInput) {
      const executeTrackSearch = () => {
        sounds.playClick();
        const query = trackSearchInput.value.trim();
        if (query) {
          this.trackComplaint(query);
        } else {
          this.showToast("Please enter a Ticket ID or phone number", "alert");
        }
      };

      trackSearchBtn.addEventListener('click', executeTrackSearch);
      trackSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeTrackSearch();
        }
      });
    }

    // Citizen sub-tab switcher
    document.querySelectorAll('[data-citizen-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        sounds.playClick();
        const tab = btn.getAttribute('data-citizen-tab');
        this.switchCitizenTab(tab);
      });
    });

    // Audio toggle
    const audioToggle = document.getElementById('audioToggleBtn');
    if (audioToggle) {
      audioToggle.addEventListener('click', () => {
        sounds.enabled = !sounds.enabled;
        audioToggle.innerHTML = sounds.enabled 
          ? `<i data-lucide="volume-2" class="w-4 h-4 text-emerald-400"></i>`
          : `<i data-lucide="volume-x" class="w-4 h-4 text-slate-400"></i>`;
        lucide.createIcons();
      });
    }

    // Reset Data button
    const resetBtn = document.getElementById('resetDataBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm("Reset HydroTrack back to default municipal sample data?")) {
          this.complaints = [...INITIAL_COMPLAINTS];
          this.saveComplaints();
          this.refreshAllViews();
          this.showToast("System database restored to default seed data", "info");
        }
      });
    }
  }

  renderAuthStatus() {
    const container = document.getElementById('authStatusContainer');
    const crewLock = document.getElementById('crewLockBadge');
    const adminLock = document.getElementById('adminLockBadge');

    if (crewLock) {
      if (this.currentUser.role === 'technician' || this.currentUser.role === 'admin') {
        crewLock.classList.add('hidden');
      } else {
        crewLock.classList.remove('hidden');
      }
    }

    if (adminLock) {
      if (this.currentUser.role === 'admin') {
        adminLock.classList.add('hidden');
      } else {
        adminLock.classList.remove('hidden');
      }
    }

    if (!container) return;

    if (this.currentUser.role === 'citizen') {
      container.innerHTML = `
        <button id="openLoginModalBtn" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all shadow-sm">
          <i data-lucide="lock" class="w-3.5 h-3.5 text-sky-400"></i>
          <span>Staff Login</span>
        </button>
      `;
    } else if (this.currentUser.role === 'technician') {
      container.innerHTML = `
        <div class="flex items-center gap-2 bg-slate-800/90 border border-sky-500/40 rounded-xl px-2.5 py-1 text-xs">
          <span class="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
          <span class="text-sky-300 font-bold truncate max-w-[130px]">${this.currentUser.name}</span>
          <button id="logoutBtn" class="text-rose-400 hover:text-rose-300 ml-1 text-[11px] underline font-semibold">Logout</button>
        </div>
      `;
    } else if (this.currentUser.role === 'admin') {
      container.innerHTML = `
        <div class="flex items-center gap-2 bg-slate-800/90 border border-emerald-500/40 rounded-xl px-2.5 py-1 text-xs">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="text-emerald-300 font-bold truncate max-w-[140px]">${this.currentUser.name}</span>
          <button id="logoutBtn" class="text-rose-400 hover:text-rose-300 ml-1 text-[11px] underline font-semibold">Logout</button>
        </div>
      `;
    }

    lucide.createIcons({ root: container });

    const openBtn = document.getElementById('openLoginModalBtn');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        sounds.playClick();
        this.showAuthModal('crew');
      });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        sounds.playClick();
        this.currentUser = { role: 'citizen', name: 'Citizen', id: null };
        this.saveUser();
        this.renderAuthStatus();
        this.showToast("Signed out successfully. Switched to Citizen mode.", "info");
        this.switchView('citizen', true);
      });
    }
  }

  quickLogin(role) {
    sounds.playClick();
    if (role === 'technician') {
      this.currentUser = {
        role: 'technician',
        name: 'Vikas Kumar (TECH-04)',
        id: 'TECH-04',
        title: 'Senior Hydro Engineer'
      };
      this.saveUser();
      this.renderAuthStatus();
      sounds.playSuccess();
      this.showToast("Logged in as Field Crew (Vikas Kumar)!", "success");
      this.switchView('technician', true);
    } else if (role === 'admin') {
      this.currentUser = {
        role: 'admin',
        name: 'Er. K. Natarajan',
        id: 'ADM-01',
        title: 'Chief Municipal Engineer'
      };
      this.saveUser();
      this.renderAuthStatus();
      sounds.playSuccess();
      this.showToast("Logged in as Municipal Admin (Er. Natarajan)!", "success");
      this.switchView('admin', true);
    }
  }

  showAuthModal(targetTab = 'crew', noticeText = '') {
    const modal = document.getElementById('authModal');
    const noticeBanner = document.getElementById('authNoticeBanner');
    const noticeEl = document.getElementById('authNoticeText');
    if (!modal) return;

    if (noticeText) {
      if (noticeBanner) noticeBanner.classList.remove('hidden');
      if (noticeEl) noticeEl.textContent = noticeText;
    } else {
      if (noticeBanner) noticeBanner.classList.add('hidden');
    }

    this.switchAuthTab(targetTab);
    modal.classList.remove('hidden');
    sounds.playAlert();
  }

  hideAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('hidden');
  }

  switchAuthTab(tab) {
    const tabCrewBtn = document.getElementById('authTabCrewBtn');
    const tabAdminBtn = document.getElementById('authTabAdminBtn');
    const crewForm = document.getElementById('crewLoginForm');
    const adminForm = document.getElementById('adminLoginForm');
    const subtitle = document.getElementById('authModalSubtitle');

    if (tab === 'crew') {
      if (tabCrewBtn) {
        tabCrewBtn.className = "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-sky-600 text-white shadow-md shadow-sky-600/30";
      }
      if (tabAdminBtn) {
        tabAdminBtn.className = "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-slate-900 text-slate-400 hover:text-white";
      }
      if (crewForm) crewForm.classList.remove('hidden');
      if (adminForm) adminForm.classList.add('hidden');
      if (subtitle) subtitle.textContent = "Field Crew & Plumber Rapid Dispatch Access";
    } else {
      if (tabAdminBtn) {
        tabAdminBtn.className = "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-emerald-600 text-white shadow-md shadow-emerald-600/30";
      }
      if (tabCrewBtn) {
        tabCrewBtn.className = "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-slate-900 text-slate-400 hover:text-white";
      }
      if (adminForm) adminForm.classList.remove('hidden');
      if (crewForm) crewForm.classList.add('hidden');
      if (subtitle) subtitle.textContent = "Municipal Water Authority Command Center Access";
    }
    lucide.createIcons();
  }

  setupAuthEvents() {
    // Close modal
    const closeBtn = document.getElementById('closeAuthModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        sounds.playClick();
        this.hideAuthModal();
      });
    }

    // Tab buttons
    const tabCrew = document.getElementById('authTabCrewBtn');
    if (tabCrew) {
      tabCrew.addEventListener('click', () => {
        sounds.playClick();
        this.switchAuthTab('crew');
      });
    }

    const tabAdmin = document.getElementById('authTabAdminBtn');
    if (tabAdmin) {
      tabAdmin.addEventListener('click', () => {
        sounds.playClick();
        this.switchAuthTab('admin');
      });
    }

    // Auto-fill Crew
    const autoFillCrew = document.getElementById('autoFillCrewBtn');
    if (autoFillCrew) {
      autoFillCrew.addEventListener('click', () => {
        sounds.playClick();
        document.getElementById('crewUsernameInput').value = 'TECH-04';
        document.getElementById('crewPasswordInput').value = 'crew123';
      });
    }

    // Auto-fill Admin
    const autoFillAdmin = document.getElementById('autoFillAdminBtn');
    if (autoFillAdmin) {
      autoFillAdmin.addEventListener('click', () => {
        sounds.playClick();
        document.getElementById('adminUsernameInput').value = 'admin';
        document.getElementById('adminPasswordInput').value = 'admin123';
      });
    }

    // Crew Login Form submit
    const crewForm = document.getElementById('crewLoginForm');
    if (crewForm) {
      crewForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sounds.playClick();
        const username = document.getElementById('crewUsernameInput').value.trim();
        const password = document.getElementById('crewPasswordInput').value;

        if ((username.toUpperCase().startsWith('TECH') || username.toLowerCase().includes('crew')) && password === 'crew123') {
          this.currentUser = {
            role: 'technician',
            name: 'Vikas Kumar (TECH-04)',
            id: 'TECH-04',
            title: 'Senior Hydro Engineer'
          };
          this.saveUser();
          this.hideAuthModal();
          this.renderAuthStatus();
          sounds.playSuccess();
          this.showToast("Welcome, Vikas Kumar! Field Crew Workstation Unlocked.", "success");
          this.switchView('technician', true);
        } else {
          sounds.playAlert();
          this.showToast("Invalid Technician credentials! (Use Demo: TECH-04 / crew123)", "error");
        }
      });
    }

    // Admin Login Form submit
    const adminForm = document.getElementById('adminLoginForm');
    if (adminForm) {
      adminForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sounds.playClick();
        const username = document.getElementById('adminUsernameInput').value.trim();
        const password = document.getElementById('adminPasswordInput').value;

        if ((username.toLowerCase() === 'admin' || username.toLowerCase().includes('admin@')) && password === 'admin123') {
          this.currentUser = {
            role: 'admin',
            name: 'Er. K. Natarajan',
            id: 'ADM-01',
            title: 'Chief Municipal Engineer'
          };
          this.saveUser();
          this.hideAuthModal();
          this.renderAuthStatus();
          sounds.playSuccess();
          this.showToast("Welcome, Administrator! Command Center Unlocked.", "success");
          this.switchView('admin', true);
        } else {
          sounds.playAlert();
          this.showToast("Invalid Administrator credentials! (Use Demo: admin / admin123)", "error");
        }
      });
    }
  }

  switchView(viewName, force = false) {
    // Role-based access protection
    if (!force) {
      if (viewName === 'technician' && this.currentUser.role !== 'technician' && this.currentUser.role !== 'admin') {
        this.showAuthModal('crew', 'Restricted Access: Please sign in with your Field Crew Badge or credentials.');
        return;
      }
      if (viewName === 'admin' && this.currentUser.role !== 'admin') {
        this.showAuthModal('admin', 'Restricted Access: Municipal Command Center requires Administrator authentication.');
        return;
      }
    }

    this.activeView = viewName;
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('[data-view-target]').forEach(b => {
      b.classList.remove('bg-sky-500/20', 'text-sky-400', 'border-sky-500');
      b.classList.add('text-slate-400', 'border-transparent');
    });

    const targetSection = document.getElementById(`view-${viewName}`);
    const targetNavBtn = document.querySelector(`[data-view-target="${viewName}"]`);
    
    if (targetSection) targetSection.classList.remove('hidden');
    if (targetNavBtn) {
      targetNavBtn.classList.add('bg-sky-500/20', 'text-sky-400', 'border-sky-500');
      targetNavBtn.classList.remove('text-slate-400', 'border-transparent');
    }

    if (viewName === 'citizen') {
      this.switchCitizenTab(this.citizenSubTab);
    } else if (viewName === 'technician') {
      this.renderTechnicianPortal();
    } else if (viewName === 'admin') {
      this.renderAdminPortal();
      setTimeout(() => this.initOrUpdateCharts(), 100);
    }

    lucide.createIcons();
  }

  switchCitizenTab(tabName) {
    this.citizenSubTab = tabName;
    document.querySelectorAll('.citizen-subview').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('[data-citizen-tab]').forEach(b => {
      b.classList.remove('bg-sky-600', 'text-white', 'shadow-lg', 'shadow-sky-500/25');
      b.classList.add('text-slate-400', 'hover:text-white', 'bg-slate-800/60');
    });

    const activeSec = document.getElementById(`citizen-${tabName}`);
    const activeBtn = document.querySelector(`[data-citizen-tab="${tabName}"]`);
    if (activeSec) activeSec.classList.remove('hidden');
    if (activeBtn) {
      activeBtn.classList.add('bg-sky-600', 'text-white', 'shadow-lg', 'shadow-sky-500/25');
      activeBtn.classList.remove('text-slate-400', 'hover:text-white', 'bg-slate-800/60');
    }

    if (tabName === 'map') {
      setTimeout(() => this.initOrUpdatePublicMap(), 150);
    } else if (tabName === 'report') {
      setTimeout(() => this.initPickerMap(), 150);
    } else if (tabName === 'track') {
      if (!this.selectedComplaintForTrack && this.complaints.length > 0) {
        this.trackComplaint(this.complaints[0].id);
      }
    }

    lucide.createIcons();
  }

  // --- Toast Notifications ---
  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200',
      error: 'bg-rose-950/90 border-rose-500/60 text-rose-200',
      info: 'bg-sky-950/90 border-sky-500/60 text-sky-200',
      alert: 'bg-amber-950/90 border-amber-500/60 text-amber-200'
    };

    const icons = {
      success: 'check-circle-2',
      error: 'alert-circle',
      info: 'info',
      alert: 'alert-triangle'
    };

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-2 opacity-0 ${colors[type] || colors.info}`;
    toast.innerHTML = `
      <i data-lucide="${icons[type] || 'info'}" class="w-5 h-5 flex-shrink-0"></i>
      <div class="text-sm font-medium">${message}</div>
    `;

    container.appendChild(toast);
    lucide.createIcons({ root: toast });

    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 20);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-x-4');
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  // --- Top Metrics & Tickers ---
  updateStatsCards() {
    const total = this.complaints.length;
    const resolved = this.complaints.filter(c => c.status === 'Resolved').length;
    const active = total - resolved;
    const critical = this.complaints.filter(c => c.severity === 'Critical' && c.status !== 'Resolved').length;
    
    let totalWaterSaved = this.complaints.reduce((acc, c) => acc + (c.estimatedWaterSavedUponFix || 0), 0);
    // Add current live saved metric
    const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const countEls = {
      'stat-total-complaints': total,
      'stat-active-leaks': active,
      'stat-resolved-leaks': resolved,
      'stat-critical-alerts': critical,
      'stat-resolution-rate': `${resolvedPct}%`,
      'stat-water-saved': `${(totalWaterSaved / 1000).toFixed(1)}k L`
    };

    for (const [id, val] of Object.entries(countEls)) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    }
  }

  renderRecentTicketsTicker() {
    const tickerContainer = document.getElementById('recentTicketsTicker');
    if (!tickerContainer) return;

    tickerContainer.innerHTML = '';
    const recent = [...this.complaints].reverse().slice(0, 5);

    recent.forEach(c => {
      const chip = document.createElement('button');
      chip.className = "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-mono text-slate-300 transition-all hover:scale-105";
      const statusColor = c.status === 'Resolved' ? 'bg-emerald-500' : (c.status === 'In Progress' ? 'bg-sky-500' : (c.status === 'Dispatched' ? 'bg-amber-500' : 'bg-rose-500'));
      chip.innerHTML = `
        <span class="w-2 h-2 rounded-full ${statusColor} animate-pulse"></span>
        <span class="font-bold text-sky-400">${c.id}</span>
        <span class="text-slate-400 truncate max-w-[120px]">${c.category}</span>
      `;
      chip.addEventListener('click', () => {
        sounds.playClick();
        this.switchView('citizen');
        this.switchCitizenTab('track');
        this.trackComplaint(c.id);
      });
      tickerContainer.appendChild(chip);
    });
  }

  // --- Report a Leak Flow ---
  setupReportForm() {
    const form = document.getElementById('reportLeakForm');
    if (!form) return;

    // Real-time calculation of estimated water loss based on pipe diameter selection
    const pipeSelector = document.getElementById('pipeDiameterSelect');
    const leakRatePreview = document.getElementById('formLeakRatePreview');

    const updateCalculatedRate = () => {
      if (!pipeSelector || !leakRatePreview) return;
      const rates = {
        '15mm (Domestic Standpost)': 90,
        '25mm (Domestic Service Line)': 450,
        '100mm (Local Feeder)': 2800,
        '150mm (Sub-Distribution)': 5200,
        '200mm (High Pressure Fire Ring)': 18000,
        '300mm (Transmission Main)': 32000
      };
      const rate = rates[pipeSelector.value] || 1500;
      leakRatePreview.textContent = `~${rate.toLocaleString()} Liters / Hour loss`;
    };

    if (pipeSelector) {
      pipeSelector.addEventListener('change', updateCalculatedRate);
      updateCalculatedRate();
    }

    // Preset location quick chips
    document.querySelectorAll('.preset-loc-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        sounds.playClick();
        const address = chip.getAttribute('data-address');
        const ward = chip.getAttribute('data-ward');
        const landmark = chip.getAttribute('data-landmark');
        const lat = parseFloat(chip.getAttribute('data-lat'));
        const lng = parseFloat(chip.getAttribute('data-lng'));

        document.getElementById('reportAddress').value = address;
        document.getElementById('reportWard').value = ward;
        document.getElementById('reportLandmark').value = landmark;
        document.getElementById('reportLat').value = lat;
        document.getElementById('reportLng').value = lng;

        if (this.pickerMarker && this.pickerMap) {
          this.pickerMarker.setLatLng([lat, lng]);
          this.pickerMap.panTo([lat, lng]);
        }
      });
    });

    // --- Interactive Photo Evidence Attachment Handler ---
    this.currentUploadedPhoto = null;

    const photoInput = document.getElementById('reportPhotoInput');
    const photoDropzone = document.getElementById('photoDropzone');
    const dropzoneEmpty = document.getElementById('dropzoneEmptyState');
    const previewContainer = document.getElementById('photoPreviewContainer');
    const previewImg = document.getElementById('photoPreviewImg');
    const previewName = document.getElementById('photoFileName');
    const removePhotoBtn = document.getElementById('removePhotoBtn');
    const photoStatusBadge = document.getElementById('photoStatusBadge');

    const setAttachedPhoto = (dataUrl, fileName) => {
      this.currentUploadedPhoto = dataUrl;
      if (previewImg) previewImg.src = dataUrl;
      if (previewName) previewName.textContent = fileName || 'Photo Evidence Attached';
      if (dropzoneEmpty) dropzoneEmpty.classList.add('hidden');
      if (previewContainer) previewContainer.classList.remove('hidden');
      if (photoStatusBadge) {
        photoStatusBadge.textContent = 'Attached';
        photoStatusBadge.className = 'text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold';
      }
      sounds.playSuccess();
    };

    const clearAttachedPhoto = () => {
      this.currentUploadedPhoto = null;
      if (photoInput) photoInput.value = '';
      if (previewImg) previewImg.src = '';
      if (previewContainer) previewContainer.classList.add('hidden');
      if (dropzoneEmpty) dropzoneEmpty.classList.remove('hidden');
      if (photoStatusBadge) {
        photoStatusBadge.textContent = 'Optional';
        photoStatusBadge.className = 'text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700';
      }
    };

    if (photoDropzone && photoInput) {
      photoDropzone.addEventListener('click', (e) => {
        if (e.target.closest('#removePhotoBtn')) return;
        photoInput.click();
      });

      photoInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (uploadEvent) => {
            setAttachedPhoto(uploadEvent.target.result, file.name);
          };
          reader.readAsDataURL(file);
        }
      });

      // Drag and drop handlers
      photoDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        photoDropzone.classList.add('border-sky-500', 'bg-sky-950/20');
      });
      ['dragleave', 'drop'].forEach(evt => {
        photoDropzone.addEventListener(evt, () => {
          photoDropzone.classList.remove('border-sky-500', 'bg-sky-950/20');
        });
      });
      photoDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (uploadEvent) => {
            setAttachedPhoto(uploadEvent.target.result, file.name);
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (removePhotoBtn) {
      removePhotoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearAttachedPhoto();
      });
    }

    // Sample test photo chips
    document.querySelectorAll('.sample-photo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sampleUrl = btn.getAttribute('data-sample');
        const sampleName = btn.getAttribute('data-name');
        setAttachedPhoto(sampleUrl, sampleName);
        this.showToast(`Attached sample photo: ${sampleName}`, 'info');
      });
    });

    // Form Submit
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      sounds.playClick();

      const category = document.getElementById('reportCategory').value;
      const severity = document.getElementById('reportSeverity').value;
      const address = document.getElementById('reportAddress').value;
      const ward = document.getElementById('reportWard').value;
      const landmark = document.getElementById('reportLandmark').value || "Near main road";
      const description = document.getElementById('reportDescription').value;
      const reporterName = document.getElementById('reportName').value;
      const reporterPhone = document.getElementById('reportPhone').value;
      const pipeDiameter = document.getElementById('pipeDiameterSelect').value;
      const lat = parseFloat(document.getElementById('reportLat').value) || 12.9716;
      const lng = parseFloat(document.getElementById('reportLng').value) || 77.5946;

      // Highly relatable municipal situation photos
      const photoMap = {
        'Main Pipeline Burst': 'assets/images/burst-pipe.svg',
        'Street Valve Leakage': 'assets/images/street-valve.svg',
        'Fire Hydrant Damage': 'assets/images/fire-hydrant.svg',
        'Meter Box & Service Connection': 'assets/images/meter-leak.svg',
        'Road Sub-surface Leakage': 'assets/images/burst-pipe.svg',
        'Public Tap / Standpost Leak': 'assets/images/street-valve.svg'
      };

      const newId = `HT-2026-${Math.floor(1055 + Math.random() * 900)}`;
      const severityMap = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
      const ratesMap = {
        '15mm (Domestic Standpost)': 90,
        '25mm (Domestic Service Line)': 450,
        '100mm (Local Feeder)': 2800,
        '150mm (Sub-Distribution)': 5200,
        '200mm (High Pressure Fire Ring)': 18000,
        '300mm (Transmission Main)': 32000
      };

      const lossRate = ratesMap[pipeDiameter] || 2500;
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const newComplaint = {
        id: newId,
        category,
        severity,
        severityLevel: severityMap[severity] || 2,
        location: {
          address,
          ward,
          landmark,
          lat,
          lng
        },
        reporter: {
          name: reporterName,
          phone: reporterPhone,
          email: `${reporterName.toLowerCase().replace(/\s+/g, '.') || 'citizen'}@example.com`
        },
        description,
        pipeDiameter,
        waterLossRateLph: lossRate,
        reportedAt: now.toISOString(),
        status: "Reported",
        assignedTechnician: null,
        timeline: [
          { status: "Reported", time: timeStr, note: "Complaint logged by citizen with geo-tagged location." },
          { status: "Triaged", time: timeStr, note: "Auto-triaged by HydroTrack GovTech AI Engine. Priority score: " + (severity === 'Critical' ? '98/100 (Immediate Crew Required)' : '72/100') }
        ],
        photoUrl: this.currentUploadedPhoto || photoMap[category] || photoMap['Main Pipeline Burst'],
        estimatedWaterSavedUponFix: lossRate * 8
      };

      // Add to front of array
      this.complaints.unshift(newComplaint);
      this.saveComplaints();

      // Trigger Celebration & Audio
      sounds.playSuccess();
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }

      // Trigger Native Device Notification & In-App SMS Toast
      this.triggerSmsAlert(newComplaint);

      this.showToast(`Complaint registered successfully! Ticket ID: ${newId}`, 'success');
      form.reset();
      clearAttachedPhoto();

      // Show Success Modal with printable ticket
      this.showRegistrationSuccessModal(newComplaint);

      // Refresh data throughout app
      this.refreshAllViews();
    });
  }

  triggerSmsAlert(complaint) {
    // 1. Request & fire Real Browser OS Desktop Notification
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          new Notification(`📱 HydroTrack SMS Alert`, {
            body: `To: ${complaint.reporter.phone}\nTicket ${complaint.id} logged. Emergency response crew dispatched.`,
            icon: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=128&q=80'
          });
        } catch (e) {}
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(perm => {
          if (perm === "granted") {
            try {
              new Notification(`📱 HydroTrack SMS Alert`, {
                body: `To: ${complaint.reporter.phone}\nTicket ${complaint.id} logged. Emergency response crew dispatched.`
              });
            } catch (e) {}
          }
        });
      }
    }

    // 2. Realistic In-App Phone SMS Notification Pop-up
    const existingPopup = document.getElementById('phoneSmsSimulatorBanner');
    if (existingPopup) existingPopup.remove();

    const banner = document.createElement('div');
    banner.id = 'phoneSmsSimulatorBanner';
    banner.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] bg-slate-900/95 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-2xl backdrop-blur-xl transition-all duration-500 transform translate-y-0 text-left';
    banner.innerHTML = `
      <div class="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[11px] text-slate-400">
        <span class="flex items-center gap-1.5 font-bold text-emerald-400">
          <i data-lucide="message-square" class="w-3.5 h-3.5"></i> SMS GATEWAY SIMULATOR • JUST NOW
        </span>
        <span class="font-mono text-slate-400">To: ${complaint.reporter.phone}</span>
      </div>
      <div class="mt-2 text-xs text-slate-200 leading-relaxed font-sans">
        <b class="text-white">HydroTrack Alert:</b> Dear citizen, your complaint for <b>${complaint.category}</b> at ${complaint.location.ward} has been registered under Ticket <span class="text-sky-300 font-mono font-bold">${complaint.id}</span>. Crew 04 dispatched. Track status online at http://localhost:8080.
      </div>
      <div class="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
        <span class="text-emerald-400 font-medium">✓ Carrier Network Delivered</span>
        <button onclick="this.parentElement.parentElement.remove()" class="text-slate-400 hover:text-white font-semibold underline">Dismiss</button>
      </div>
    `;

    document.body.appendChild(banner);
    lucide.createIcons({ root: banner });

    setTimeout(() => {
      if (banner && banner.parentNode) {
        banner.classList.add('opacity-0', '-translate-y-4');
        setTimeout(() => banner.remove(), 400);
      }
    }, 7000);
  }

  showRegistrationSuccessModal(complaint) {
    const modal = document.getElementById('ticketSuccessModal');
    const content = document.getElementById('modalTicketContent');
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="p-6 bg-slate-900/90 rounded-2xl border border-sky-500/40 text-left space-y-4 font-sans">
        <div class="flex items-center justify-between pb-3 border-b border-slate-700/60">
          <div>
            <span class="text-xs uppercase tracking-wider text-sky-400 font-bold">Municipal Water Board • Rapid Response</span>
            <h3 class="text-2xl font-black text-white font-mono">${complaint.id}</h3>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-semibold ${complaint.severity === 'Critical' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'}">
            ${complaint.severity} Priority
          </span>
        </div>

        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div class="text-slate-400 text-xs">Category</div>
            <div class="font-semibold text-slate-200">${complaint.category}</div>
          </div>
          <div>
            <div class="text-slate-400 text-xs">Ward / Zone</div>
            <div class="font-semibold text-slate-200">${complaint.location.ward}</div>
          </div>
          <div class="col-span-2">
            <div class="text-slate-400 text-xs">Location</div>
            <div class="font-semibold text-slate-200">${complaint.location.address}</div>
          </div>
          <div>
            <div class="text-slate-400 text-xs">Reported By</div>
            <div class="font-semibold text-slate-200">${complaint.reporter.name} (${complaint.reporter.phone})</div>
          </div>
          <div>
            <div class="text-slate-400 text-xs">Est. Flow Wasted</div>
            <div class="font-semibold text-rose-400">${complaint.waterLossRateLph.toLocaleString()} Liters/Hr</div>
          </div>
        </div>

        <div class="p-3.5 bg-sky-950/40 border border-sky-800/60 rounded-xl space-y-2.5">
          <div class="flex items-center justify-between text-xs text-slate-300">
            <div>
              <span class="text-emerald-400 font-bold flex items-center gap-1">
                <i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-400"></i> SMS Dispatched
              </span>
              <span class="text-slate-400 text-[11px]">Confirmation logged for ${complaint.reporter.phone}</span>
            </div>
            <div class="w-10 h-10 bg-white rounded p-1 flex items-center justify-center flex-shrink-0">
              <!-- Simulated QR Code Icon -->
              <svg class="w-8 h-8 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm13-2h-3v3h3v-3zm3 0h-2v2h2v-2zm-3 5h-2v3h2v-3zm2 1h2v2h-2v-2zm2-4h-2v2h2v-2zm-2 5h3v2h-3v-2z"/>
              </svg>
            </div>
          </div>

          <!-- Real WhatsApp Direct Alert Link -->
          <a href="https://api.whatsapp.com/send?text=${encodeURIComponent('💧 HydroTrack Water Authority Alert%0A%0ATicket ID: ' + complaint.id + '%0ACategory: ' + complaint.category + '%0ALocation: ' + complaint.location.address + '%0ASeverity: ' + complaint.severity + '%0AStatus: Crew 04 Dispatched%0A%0ATrack status online at http://localhost:8080')}" target="_blank" class="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/30">
            <i data-lucide="message-circle" class="w-4 h-4"></i> Receive Ticket Copy on WhatsApp
          </a>
        </div>

        <div class="flex gap-3 pt-2">
          <button id="modalTrackBtn" class="flex-1 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-all shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2">
            <i data-lucide="compass" class="w-4 h-4"></i> Track Complaint Live
          </button>
          <button id="modalCloseBtn" class="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-all border border-slate-700">
            Close
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    lucide.createIcons({ root: modal });

    document.getElementById('modalTrackBtn').addEventListener('click', () => {
      modal.classList.add('hidden');
      this.switchCitizenTab('track');
      this.trackComplaint(complaint.id);
    });

    document.getElementById('modalCloseBtn').addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  // --- Complaint Tracking Engine ---
  trackComplaint(ticketId) {
    const trimmedId = (ticketId || '').trim();
    const complaint = this.complaints.find(c => c.id.toLowerCase() === trimmedId.toLowerCase() || c.reporter.phone.includes(trimmedId));

    const resultBox = document.getElementById('trackingResultContainer');
    const emptyBox = document.getElementById('trackingEmptyContainer');
    if (!resultBox) return;

    if (!complaint) {
      if (emptyBox) emptyBox.classList.remove('hidden');
      resultBox.classList.add('hidden');
      this.showToast(`No complaint ticket found for "${trimmedId}"`, 'alert');
      return;
    }

    if (emptyBox) emptyBox.classList.add('hidden');
    resultBox.classList.remove('hidden');
    this.selectedComplaintForTrack = complaint;

    // Status mapping for progress stepper
    const steps = ['Reported', 'Dispatched', 'In Progress', 'Resolved'];
    const currentStepIdx = steps.indexOf(complaint.status);

    const statusBadgeColors = {
      'Reported': 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      'Dispatched': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      'In Progress': 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      'Resolved': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    };

    resultBox.innerHTML = `
      <div class="bg-slate-800/60 rounded-2xl border border-slate-700/60 overflow-hidden shadow-2xl backdrop-blur-xl">
        <!-- Ticket Header Banner -->
        <div class="p-6 bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border-b border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <span class="font-mono text-2xl font-black text-white">${complaint.id}</span>
              <span class="px-3 py-1 rounded-full text-xs font-bold border ${statusBadgeColors[complaint.status] || 'bg-slate-700 text-slate-300'}">
                ● ${complaint.status.toUpperCase()}
              </span>
              <span class="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                ${complaint.severity} Urgency
              </span>
            </div>
            <p class="text-sm text-slate-400 mt-1 flex items-center gap-2">
              <i data-lucide="map-pin" class="w-4 h-4 text-sky-400"></i> ${complaint.location.address} (${complaint.location.ward})
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button id="printTicketBtn" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-all">
              <i data-lucide="printer" class="w-4 h-4"></i> Print Receipt
            </button>
            <button id="viewOnMapBtn" class="px-3 py-2 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 text-xs font-semibold border border-sky-500/40 flex items-center gap-1.5 transition-all">
              <i data-lucide="map" class="w-4 h-4"></i> View on Live Map
            </button>
          </div>
        </div>

        <!-- 4-Stage Stepper Progress Bar -->
        <div class="p-6 border-b border-slate-700/60 bg-slate-900/40">
          <div class="relative flex items-center justify-between max-w-2xl mx-auto">
            <!-- Background connecting line -->
            <div class="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-700 z-0"></div>
            <!-- Active colored line -->
            <div class="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-sky-500 to-emerald-500 z-0 transition-all duration-700" 
                 style="width: ${Math.max(0, (currentStepIdx / (steps.length - 1)) * 90)}%;"></div>

            ${steps.map((st, i) => {
              const isPastOrCurrent = i <= currentStepIdx;
              const isCurrent = i === currentStepIdx;
              const circleBg = isPastOrCurrent ? 'bg-sky-500 text-white ring-4 ring-sky-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700';
              return `
                <div class="relative z-10 flex flex-col items-center">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${circleBg}">
                    ${isPastOrCurrent ? `<i data-lucide="${i === currentStepIdx && st !== 'Resolved' ? 'loader-2' : 'check'}" class="w-5 h-5 ${isCurrent && st !== 'Resolved' ? 'animate-spin' : ''}"></i>` : (i + 1)}
                  </div>
                  <span class="text-xs font-semibold mt-2 ${isCurrent ? 'text-sky-300 font-bold' : (isPastOrCurrent ? 'text-slate-300' : 'text-slate-500')}">${st}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Ticket Body Details & Timeline -->
        <div class="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left 2 Cols: Details, Leak Photo, Technician Card -->
          <div class="lg:col-span-2 space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
                <span class="text-xs text-slate-400">Leak Category</span>
                <div class="text-base font-semibold text-white">${complaint.category}</div>
                <div class="text-xs text-slate-400">Pipe: ${complaint.pipeDiameter}</div>
              </div>

              <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
                <span class="text-xs text-slate-400">Estimated Water Loss Rate</span>
                <div class="text-base font-bold text-rose-400 font-mono">${complaint.waterLossRateLph.toLocaleString()} L/hour</div>
                <div class="text-xs text-emerald-400">Est. saved on fix: ${(complaint.estimatedWaterSavedUponFix || 0).toLocaleString()} L</div>
              </div>
            </div>

            <!-- Description -->
            <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
              <span class="text-xs text-slate-400">Complaint Description</span>
              <p class="text-sm text-slate-300 leading-relaxed">${complaint.description}</p>
            </div>

            <!-- Assigned Technician Information Card -->
            <div class="p-5 rounded-2xl bg-gradient-to-br from-sky-950/40 via-slate-900 to-slate-900 border border-sky-500/30">
              <h4 class="text-xs font-bold uppercase tracking-wider text-sky-400 mb-3 flex items-center gap-2">
                <i data-lucide="wrench" class="w-4 h-4"></i> Assigned Field Response Crew
              </h4>
              ${complaint.assignedTechnician ? `
                <div class="flex items-center justify-between gap-4 flex-wrap">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-xl bg-sky-600/30 border border-sky-500/50 flex items-center justify-center text-sky-300 font-bold text-lg">
                      ${complaint.assignedTechnician.name.split(' ').map(n=>n[0]).join('')}
                    </div>
                    <div>
                      <div class="font-bold text-white text-base">${complaint.assignedTechnician.name}</div>
                      <div class="text-xs text-slate-400 flex items-center gap-2">
                        <span><i data-lucide="truck" class="w-3.5 h-3.5 inline text-sky-400"></i> ${complaint.assignedTechnician.vehicle}</span>
                        <span>•</span>
                        <span class="text-emerald-400 font-semibold">${complaint.assignedTechnician.eta}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <a href="tel:${complaint.assignedTechnician.phone}" class="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20">
                      <i data-lucide="phone-call" class="w-4 h-4"></i> Call Crew
                    </a>
                  </div>
                </div>
              ` : `
                <div class="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs text-amber-300 flex items-center gap-2">
                  <i data-lucide="clock" class="w-4 h-4 flex-shrink-0"></i>
                  Currently in queue. Smart dispatch engine is allocating nearest available emergency hydro crew.
                </div>
              `}
            </div>

            ${complaint.photoUrl ? `
              <div class="rounded-xl overflow-hidden border border-slate-700/60 relative group">
                <img src="${complaint.photoUrl}" alt="Leak Photo Evidence" class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500">
                <div class="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-1 rounded text-xs text-slate-300 backdrop-blur-sm">
                  Photo Evidence Submitted by Citizen
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Right Col: Real-time Incident Audit Log / Stepper -->
          <div class="p-5 rounded-2xl bg-slate-900/80 border border-slate-700/60 space-y-4">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <i data-lucide="activity" class="w-4 h-4 text-sky-400"></i> Activity & Audit Log
            </h4>
            
            <div class="space-y-4 relative pl-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
              ${complaint.timeline.map((item, idx) => `
                <div class="relative pl-3">
                  <div class="absolute -left-[19px] top-1 w-3 h-3 rounded-full ${idx === complaint.timeline.length - 1 ? 'bg-sky-400 ring-4 ring-sky-400/20 animate-pulse' : 'bg-slate-600'}"></div>
                  <div class="flex items-center justify-between text-xs font-semibold text-slate-200">
                    <span>${item.status}</span>
                    <span class="text-slate-400 font-mono">${item.time}</span>
                  </div>
                  <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">${item.note}</p>
                </div>
              `).join('')}
            </div>

            <!-- Citizen Action Card -->
            <div class="pt-4 border-t border-slate-700/60">
              <button id="citizenFeedbackBtn" class="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-2 transition-all">
                <i data-lucide="message-square" class="w-4 h-4 text-sky-400"></i> Send Note / Landmark Update
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    lucide.createIcons({ root: resultBox });

    document.getElementById('viewOnMapBtn').addEventListener('click', () => {
      this.switchCitizenTab('map');
      if (this.leafletMap) {
        this.leafletMap.flyTo([complaint.location.lat, complaint.location.lng], 15, { duration: 1.2 });
      }
    });

    document.getElementById('printTicketBtn').addEventListener('click', () => {
      window.print();
    });

    document.getElementById('citizenFeedbackBtn').addEventListener('click', () => {
      const note = prompt(`Add extra location landmark or update for Ticket ${complaint.id}:`);
      if (note) {
        complaint.timeline.push({
          status: "Citizen Note",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          note: `Citizen Remark: "${note}"`
        });
        this.saveComplaints();
        this.trackComplaint(complaint.id);
        this.showToast("Your update has been sent to the dispatched engineer", "success");
      }
    });
  }

  // --- Interactive Leaflet GIS Maps ---
  initPickerMap() {
    const mapEl = document.getElementById('reportPickerMap');
    if (!mapEl) return;

    if (this.pickerMap) {
      setTimeout(() => {
        if (this.pickerMap) this.pickerMap.invalidateSize();
      }, 100);
      return;
    }

    const defaultLat = 12.9716;
    const defaultLng = 77.5946;

    this.pickerMap = L.map('reportPickerMap', {
      zoomControl: true,
      attributionControl: false
    }).setView([defaultLat, defaultLng], 13);

    // Free OpenStreetMap Tiles - 100% Free & No API Key Required
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.pickerMap);

    // Custom High-Visibility SVG Droplet Pin (No external PNG dependency)
    const pickerPinIcon = L.divIcon({
      className: 'picker-pin-wrapper',
      html: `
        <div style="transform: translate(-14px, -32px); cursor: grab;">
          <div style="background-color: #ef4444; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(239,68,68,0.6); border: 2.5px solid white;">
            <div style="width: 8px; height: 8px; background: white; border-radius: 50%; transform: rotate(45deg);"></div>
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });

    this.pickerMarker = L.marker([defaultLat, defaultLng], {
      draggable: true,
      icon: pickerPinIcon
    }).addTo(this.pickerMap);

    this.pickerMarker.bindPopup("<b>Selected Leak Location</b><br>Drag pin or click map to adjust").openPopup();

    const updateInputs = (lat, lng) => {
      document.getElementById('reportLat').value = lat.toFixed(5);
      document.getElementById('reportLng').value = lng.toFixed(5);
    };

    updateInputs(defaultLat, defaultLng);

    this.pickerMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      updateInputs(pos.lat, pos.lng);
    });

    this.pickerMap.on('click', (e) => {
      this.pickerMarker.setLatLng(e.latlng);
      updateInputs(e.latlng.lat, e.latlng.lng);
      sounds.playClick();
    });

    setTimeout(() => {
      if (this.pickerMap) this.pickerMap.invalidateSize();
    }, 200);

    const locateBtn = document.getElementById('reportGeoLocateBtn');
    if (locateBtn) {
      locateBtn.addEventListener('click', () => {
        sounds.playClick();
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              this.pickerMap.setView([latitude, longitude], 15);
              this.pickerMarker.setLatLng([latitude, longitude]);
              updateInputs(latitude, longitude);
              this.showToast("GPS coordinates locked from your device", "success");
            },
            () => {
              this.showToast("Simulating municipal GPS coordinates lock", "info");
              this.pickerMap.setView([12.9784, 77.6408], 15);
              this.pickerMarker.setLatLng([12.9784, 77.6408]);
              updateInputs(12.9784, 77.6408);
            }
          );
        }
      });
    }
  }

  initOrUpdatePublicMap() {
    const mapEl = document.getElementById('publicHeatmap');
    if (!mapEl) return;

    if (!this.leafletMap) {
      this.leafletMap = L.map('publicHeatmap', {
        zoomControl: true,
        attributionControl: false
      }).setView([12.9716, 77.6046], 12);

      // Free OpenStreetMap Tiles - 100% Free & No API Key Required
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.leafletMap);

      // Filter Buttons on Map
      document.querySelectorAll('[data-map-filter]').forEach(b => {
        b.addEventListener('click', () => {
          sounds.playClick();
          document.querySelectorAll('[data-map-filter]').forEach(btn => {
            btn.classList.remove('bg-sky-600', 'text-white');
            btn.classList.add('bg-slate-800', 'text-slate-300');
          });
          b.classList.add('bg-sky-600', 'text-white');
          b.classList.remove('bg-slate-800', 'text-slate-300');
          this.renderMapMarkers(b.getAttribute('data-map-filter'));
        });
      });
    }

    setTimeout(() => {
      if (this.leafletMap) this.leafletMap.invalidateSize();
    }, 150);
    this.renderMapMarkers('all');
  }

  renderMapMarkers(filter = 'all') {
    if (!this.leafletMap) return;

    // Clear existing markers
    this.mapMarkers.forEach(m => this.leafletMap.removeLayer(m));
    this.mapMarkers = [];

    const filtered = this.complaints.filter(c => {
      if (filter === 'all') return true;
      if (filter === 'active') return c.status !== 'Resolved';
      if (filter === 'critical') return c.severity === 'Critical';
      if (filter === 'resolved') return c.status === 'Resolved';
      return true;
    });

    filtered.forEach(c => {
      const color = c.status === 'Resolved' ? '#10b981' : (c.severity === 'Critical' ? '#ef4444' : (c.status === 'In Progress' ? '#0ea5e9' : '#f59e0b'));
      const pulseClass = c.status !== 'Resolved' ? 'pulse-pin' : '';

      const customIcon = L.divIcon({
        className: 'custom-leak-marker',
        html: `
          <div class="relative flex items-center justify-center">
            ${c.status !== 'Resolved' ? `<div class="absolute w-8 h-8 rounded-full animate-ping opacity-50" style="background-color: ${color}"></div>` : ''}
            <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white text-white text-xs font-bold" style="background-color: ${color}">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([c.location.lat, c.location.lng], { icon: customIcon }).addTo(this.leafletMap);

      marker.bindPopup(`
        <div class="p-2 space-y-2 text-slate-800 font-sans" style="min-width: 220px;">
          <div class="flex items-center justify-between border-b pb-1">
            <span class="font-mono font-bold text-sky-700 text-sm">${c.id}</span>
            <span class="text-xs px-2 py-0.5 rounded font-semibold text-white" style="background-color: ${color}">${c.status}</span>
          </div>
          <div class="text-xs font-bold text-slate-900">${c.category}</div>
          <div class="text-xs text-slate-600">${c.location.address}</div>
          <div class="text-xs font-semibold text-rose-600">Rate: ${c.waterLossRateLph.toLocaleString()} L/hr</div>
          <button onclick="window.hydroApp.trackComplaint('${c.id}'); window.hydroApp.switchCitizenTab('track');" class="w-full mt-2 py-1 bg-sky-600 text-white rounded text-xs font-semibold hover:bg-sky-700">
            Track Details →
          </button>
        </div>
      `);

      this.mapMarkers.push(marker);
    });
  }

  // --- Water Loss Engineering Calculator ---
  setupWaterLossCalculator() {
    const diamSelect = document.getElementById('calcDiameter');
    const pressureSlider = document.getElementById('calcPressure');
    const pressureVal = document.getElementById('calcPressureVal');
    const outLpm = document.getElementById('calcOutLpm');
    const outLpd = document.getElementById('calcOutLpd');
    const outCost = document.getElementById('calcOutCost');

    if (!pressureSlider) return;

    const calculate = () => {
      const dMm = parseFloat(diamSelect.value) || 25;
      const bar = parseFloat(pressureSlider.value) || 2.5;
      if (pressureVal) pressureVal.textContent = `${bar.toFixed(1)} bar`;

      // Orifice hydraulic leakage formula approximation:
      // Q = Cd * A * sqrt(2 * g * H)
      // For water utility leak estimation:
      // Area in cm2 = pi * (d_cm / 2)^2
      const radiusCm = (dMm / 10) / 2;
      const effectiveOrificeAreaCm2 = 0.08 * (Math.PI * radiusCm * radiusCm); // 8% equivalent aperture leak
      const headMeters = bar * 10.197; // 1 bar ≈ 10.2m water column
      const dischargeLitersPerMin = 0.62 * effectiveOrificeAreaCm2 * Math.sqrt(2 * 9.81 * headMeters) * 6;
      const lpm = Math.max(1, Math.round(dischargeLitersPerMin));
      const lpd = lpm * 60 * 24;
      const costPerDay = Math.round((lpd / 1000) * 45); // Avg municipal treatment cost ₹45 per 1,000 L

      if (outLpm) outLpm.textContent = `${lpm.toLocaleString()} L/min`;
      if (outLpd) outLpd.textContent = `${lpd.toLocaleString()} L/day`;
      if (outCost) outCost.textContent = `₹${costPerDay.toLocaleString()} / day`;
    };

    pressureSlider.addEventListener('input', calculate);
    diamSelect.addEventListener('change', calculate);
    calculate();
  }

  // --- Field Engineer / Technician Portal ---
  renderTechnicianPortal() {
    const container = document.getElementById('technicianJobsList');
    if (!container) return;

    container.innerHTML = '';
    const activeJobs = this.complaints.filter(c => c.status !== 'Resolved');

    if (activeJobs.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-700/60 text-slate-400">
          <i data-lucide="check-circle" class="w-12 h-12 text-emerald-400 mx-auto mb-2"></i>
          <h3 class="text-lg font-bold text-white">All Clear! No Active Work Orders</h3>
          <p class="text-sm">Great work! All municipal water leak tickets have been resolved.</p>
        </div>
      `;
      lucide.createIcons({ root: container });
      return;
    }

    activeJobs.forEach(job => {
      const card = document.createElement('div');
      card.className = "p-6 rounded-2xl bg-slate-900/80 border border-slate-700/70 shadow-xl space-y-4 hover:border-sky-500/50 transition-all";

      const badgeColor = job.severity === 'Critical' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

      card.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-3">
            <span class="font-mono text-xl font-black text-white">${job.id}</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeColor}">
              ${job.severity}
            </span>
            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-sky-400 border border-slate-700">
              Status: ${job.status}
            </span>
          </div>
          <div class="text-xs font-mono text-slate-400">
            Reported: ${new Date(job.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div class="space-y-1 text-sm">
          <div class="font-bold text-slate-200 text-base">${job.category}</div>
          <p class="text-slate-400 text-xs flex items-center gap-1.5">
            <i data-lucide="map-pin" class="w-4 h-4 text-sky-400 flex-shrink-0"></i> ${job.location.address}
          </p>
          <div class="text-xs text-slate-400 font-mono">Landmark: ${job.location.landmark} | Ward: ${job.location.ward}</div>
        </div>

        <div class="p-3 bg-slate-950/60 rounded-xl border border-slate-800 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span class="text-slate-500">Pipe Spec:</span>
            <span class="text-slate-300 font-semibold ml-1">${job.pipeDiameter}</span>
          </div>
          <div>
            <span class="text-slate-500">Est. Loss:</span>
            <span class="text-rose-400 font-bold ml-1">${job.waterLossRateLph.toLocaleString()} L/hr</span>
          </div>
        </div>

        <!-- Action Buttons for Tech -->
        <div class="pt-2 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div class="flex gap-2">
            ${job.status === 'Reported' ? `
              <button onclick="window.hydroApp.techAction('${job.id}', 'Dispatched')" class="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all flex items-center gap-1.5">
                <i data-lucide="truck" class="w-4 h-4"></i> Accept & En Route
              </button>
            ` : ''}

            ${job.status === 'Dispatched' ? `
              <button onclick="window.hydroApp.techAction('${job.id}', 'In Progress')" class="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all flex items-center gap-1.5">
                <i data-lucide="wrench" class="w-4 h-4"></i> Arrived / Start Work
              </button>
            ` : ''}

            ${job.status === 'In Progress' ? `
              <button onclick="window.hydroApp.showResolveModal('${job.id}')" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-600/30">
                <i data-lucide="check-circle" class="w-4 h-4"></i> Complete Repair & Test
              </button>
            ` : ''}
          </div>

          <button onclick="window.open('https://maps.google.com?q=${job.location.lat},${job.location.lng}', '_blank')" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5">
            <i data-lucide="navigation" class="w-3.5 h-3.5 text-sky-400"></i> Open GPS
          </button>
        </div>
      `;

      container.appendChild(card);
    });

    lucide.createIcons({ root: container });
  }

  techAction(jobId, newStatus) {
    sounds.playClick();
    const job = this.complaints.find(c => c.id === jobId);
    if (!job) return;

    job.status = newStatus;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (newStatus === 'Dispatched') {
      job.assignedTechnician = {
        id: "TECH-04",
        name: "Vikas Kumar (Senior Hydro Engineer)",
        phone: "+91 94421 88901",
        vehicle: "Emergency Repair Van #07",
        eta: "12 mins away"
      };
      job.timeline.push({ status: "Dispatched", time: timeStr, note: "Technician Vikas Kumar accepted dispatch order." });
      this.showToast(`Work order ${jobId} accepted! Status: Dispatched`, 'info');
    } else if (newStatus === 'In Progress') {
      job.timeline.push({ status: "In Progress", time: timeStr, note: "Crew arrived on-site. Excavation & valve isolation begun." });
      this.showToast(`Technician on-site for ${jobId}`, 'info');
    }

    this.saveComplaints();
    this.refreshAllViews();
  }

  showResolveModal(jobId) {
    sounds.playClick();
    const job = this.complaints.find(c => c.id === jobId);
    if (!job) return;

    const modal = document.getElementById('resolveJobModal');
    const content = document.getElementById('resolveJobModalContent');
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="p-6 bg-slate-900 rounded-2xl border border-emerald-500/40 text-left space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <span class="text-xs font-bold text-emerald-400 uppercase tracking-wider">Field Repair Verification</span>
            <h3 class="text-xl font-black text-white font-mono">${job.id}</h3>
          </div>
          <span class="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/40 font-semibold">
            Quality Assurance Test
          </span>
        </div>

        <form id="resolveJobForm" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Parts Replaced / Repair Work Carried Out</label>
            <input type="text" id="resolvePartsNote" required value="Installed 200mm anti-corrosive split sleeve clamp. Pressure restored to 3.8 bar." class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500">
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Pressure Tested (Bar)</label>
              <input type="number" step="0.1" id="resolvePressureTest" value="3.8" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Est. Liters Saved</label>
              <input type="number" id="resolveLitersSaved" value="${job.waterLossRateLph * 10}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono">
            </div>
          </div>

          <div class="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400">
            <i data-lucide="shield-check" class="w-4 h-4 text-emerald-400 inline mr-1"></i>
            Signing off will notify the reporting citizen and update the municipal GIS live dashboard.
          </div>

          <div class="flex gap-3 pt-2">
            <button type="submit" class="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2">
              <i data-lucide="check" class="w-4 h-4"></i> Submit & Close Ticket
            </button>
            <button type="button" id="cancelResolveBtn" class="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm border border-slate-700">
              Cancel
            </button>
          </div>
        </form>
      </div>
    `;

    modal.classList.remove('hidden');
    lucide.createIcons({ root: modal });

    document.getElementById('cancelResolveBtn').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    document.getElementById('resolveJobForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const partsNote = document.getElementById('resolvePartsNote').value;
      const litersSaved = parseInt(document.getElementById('resolveLitersSaved').value) || 20000;

      job.status = 'Resolved';
      job.resolutionNotes = partsNote;
      job.resolvedAt = new Date().toISOString();
      job.estimatedWaterSavedUponFix = litersSaved;
      job.timeline.push({
        status: "Resolved",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note: `Repair completed: ${partsNote}`
      });

      this.saveComplaints();
      sounds.playSuccess();
      if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 80 });

      modal.classList.add('hidden');
      this.showToast(`Ticket ${job.id} marked as RESOLVED! Water saved: ${litersSaved.toLocaleString()} L`, 'success');
      this.refreshAllViews();
    });
  }

  // --- Municipal Admin Command Center ---
  renderAdminPortal() {
    const tableBody = document.getElementById('adminComplaintsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    const searchVal = (document.getElementById('adminSearchInput')?.value || '').toLowerCase();
    const filterStatus = document.getElementById('adminFilterStatus')?.value || 'all';
    const filterUrgency = document.getElementById('adminFilterUrgency')?.value || 'all';

    const filtered = this.complaints.filter(c => {
      const matchSearch = c.id.toLowerCase().includes(searchVal) || 
                          c.location.address.toLowerCase().includes(searchVal) ||
                          c.reporter.name.toLowerCase().includes(searchVal) ||
                          c.category.toLowerCase().includes(searchVal);
      const matchStatus = filterStatus === 'all' || c.status === filterStatus;
      const matchUrgency = filterUrgency === 'all' || c.severity === filterUrgency;
      return matchSearch && matchStatus && matchUrgency;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-slate-500">
            No complaints match current filters.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(c => {
      const row = document.createElement('tr');
      row.className = "border-b border-slate-800 hover:bg-slate-800/40 text-sm transition-all";

      const urgencyColor = c.severity === 'Critical' ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' : 
                           (c.severity === 'High' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-sky-400 bg-sky-500/10 border-sky-500/30');

      const statusColor = c.status === 'Resolved' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                          (c.status === 'In Progress' ? 'text-sky-400 bg-sky-500/10 border-sky-500/30' :
                          (c.status === 'Dispatched' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'));

      row.innerHTML = `
        <td class="py-3 px-4 font-mono font-bold text-sky-400">${c.id}</td>
        <td class="py-3 px-4 font-semibold text-slate-200">
          <div>${c.category}</div>
          <div class="text-xs text-slate-500 font-normal truncate max-w-[180px]">${c.description}</div>
        </td>
        <td class="py-3 px-4">
          <div class="text-slate-300 text-xs">${c.location.address}</div>
          <div class="text-slate-500 text-[11px]">${c.location.ward}</div>
        </td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-xs font-semibold border ${urgencyColor}">
            ${c.severity}
          </span>
        </td>
        <td class="py-3 px-4 font-mono text-xs text-rose-400">
          ${c.waterLossRateLph.toLocaleString()} L/hr
        </td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-xs font-semibold border ${statusColor}">
            ${c.status}
          </span>
        </td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="window.hydroApp.trackComplaint('${c.id}'); window.hydroApp.switchView('citizen'); window.hydroApp.switchCitizenTab('track');" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400" title="Inspect">
              <i data-lucide="eye" class="w-4 h-4"></i>
            </button>
            <button onclick="window.hydroApp.quickDeleteComplaint('${c.id}')" class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400" title="Delete">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      `;

      tableBody.appendChild(row);
    });

    lucide.createIcons({ root: tableBody });

    // Bind admin filters
    ['adminSearchInput', 'adminFilterStatus', 'adminFilterUrgency'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.dataset.bound) {
        el.dataset.bound = "true";
        el.addEventListener('input', () => this.renderAdminPortal());
      }
    });

    // CSV Export button
    const exportBtn = document.getElementById('adminExportCsvBtn');
    if (exportBtn && !exportBtn.dataset.bound) {
      exportBtn.dataset.bound = "true";
      exportBtn.addEventListener('click', () => this.exportComplaintsToCSV());
    }
  }

  quickDeleteComplaint(id) {
    if (confirm(`Are you sure you want to delete ticket ${id}?`)) {
      this.complaints = this.complaints.filter(c => c.id !== id);
      this.saveComplaints();
      this.showToast(`Ticket ${id} removed`, 'info');
      this.refreshAllViews();
    }
  }

  exportComplaintsToCSV() {
    const headers = ["Ticket ID", "Category", "Severity", "Ward", "Address", "Status", "Water Loss Rate (L/hr)", "Reporter", "Reported At"];
    const rows = this.complaints.map(c => [
      c.id,
      `"${c.category}"`,
      c.severity,
      `"${c.location.ward}"`,
      `"${c.location.address.replace(/"/g, '""')}"`,
      c.status,
      c.waterLossRateLph,
      `"${c.reporter.name}"`,
      c.reportedAt
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `hydrotrack_complaints_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast("Exported municipal complaint dataset as CSV", "success");
  }

  // --- Chart.js Visualizations ---
  initOrUpdateCharts() {
    if (typeof Chart === 'undefined') return;

    // 1. Category Breakdown Doughnut Chart
    const ctxCat = document.getElementById('chartCategoryBreakdown');
    if (ctxCat) {
      const catCounts = {};
      this.complaints.forEach(c => {
        catCounts[c.category] = (catCounts[c.category] || 0) + 1;
      });

      if (this.charts.cat) this.charts.cat.destroy();
      this.charts.cat = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
          labels: Object.keys(catCounts),
          datasets: [{
            data: Object.values(catCounts),
            backgroundColor: ['#0284c7', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } } }
          }
        }
      });
    }

    // 2. Ward Frequency Bar Chart
    const ctxWard = document.getElementById('chartWardAnalysis');
    if (ctxWard) {
      const wardCounts = {};
      this.complaints.forEach(c => {
        const shortWard = c.location.ward.split(' - ')[0] || c.location.ward;
        wardCounts[shortWard] = (wardCounts[shortWard] || 0) + 1;
      });

      if (this.charts.ward) this.charts.ward.destroy();
      this.charts.ward = new Chart(ctxWard, {
        type: 'bar',
        data: {
          labels: Object.keys(wardCounts),
          datasets: [{
            label: 'Incidents Reported',
            data: Object.values(wardCounts),
            backgroundColor: '#0ea5e9',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: '#334155' } },
            x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }

  refreshAllViews() {
    this.updateStatsCards();
    this.renderRecentTicketsTicker();
    this.renderTechnicianPortal();
    this.renderAdminPortal();
    if (this.activeView === 'admin') {
      this.initOrUpdateCharts();
    }
    if (this.citizenSubTab === 'map') {
      this.renderMapMarkers();
    }
  }
}

// Global bootstrap
window.addEventListener('DOMContentLoaded', () => {
  window.hydroApp = new HydroTrackApp();
  lucide.createIcons();
});
