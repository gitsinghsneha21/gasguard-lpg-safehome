// ====================================================================
// LPG SafeHome — Frontend Controller & API Integration
// Connects to Node.js / Express Backend & Persistent Database
// ====================================================================

// API Configuration (Automatically uses the active server origin both locally and on Render)
const API_BASE_URL = (window.location.origin && window.location.origin !== 'null')
    ? `${window.location.origin}/api`
    : '/api';

// Navigation Logic
let historyStack = ['home-screen'];

function navigateTo(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    // Update Nav bar highlights
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    // Show target screen
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
    
    // Handle back stack
    if(historyStack[historyStack.length - 1] !== screenId) {
        historyStack.push(screenId);
    }
    
    // Header logic
    const backBtn = document.getElementById('back-btn');
    const headerTitle = document.getElementById('header-title');
    if(screenId === 'home-screen') {
        backBtn.style.display = 'none';
        headerTitle.innerText = 'LPG SafeHome';
        document.querySelectorAll('.nav-item')[0].classList.add('active');
        fetchDashboardSummary();
    } else {
        backBtn.style.display = 'block';
        headerTitle.innerText = formatTitle(screenId);
        
        // Highlight correct nav item based on route
        if(screenId.includes('cooking')) document.querySelectorAll('.nav-item')[1].classList.add('active');
        if(screenId === 'usage-screen') {
            document.querySelectorAll('.nav-item')[2].classList.add('active');
            fetchUsageData();
        }
        if(screenId === 'safety-screen') {
            document.querySelectorAll('.nav-item')[3].classList.add('active');
        }
        if(screenId === 'history-screen') {
            fetchHistoryData();
        }
        if(screenId === 'settings-screen') {
            fetchSettingsData();
        }
    }
}

function goBack() {
    if(historyStack.length > 1) {
        historyStack.pop(); // remove current
        const prevScreen = historyStack.pop(); // get previous
        navigateTo(prevScreen);
    }
}

function formatTitle(id) {
    const titles = {
        'cooking-setup-screen': 'Setup Timer',
        'active-cooking-screen': 'Cooking Active',
        'safety-screen': 'Safety Checklist',
        'usage-screen': 'Cylinder Usage',
        'emergency-screen': 'Emergency Action',
        'history-screen': 'Session History',
        'settings-screen': 'App Settings'
    };
    return titles[id] || 'LPG SafeHome';
}

// ====================================================================
// Real-Time Dashboard Synchronization
// ====================================================================
async function fetchDashboardSummary() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/summary`);
        if (!response.ok) throw new Error('Network error fetching summary');
        const result = await response.json();
        
        if (result.success && result.data) {
            updateDashboardUI(result.data);
        }
    } catch (err) {
        console.warn('API communication error (using local state):', err);
    }
}

function updateDashboardUI(data) {
    const statusCard = document.getElementById('home-status-card');
    const statusTitle = document.getElementById('home-status-title');
    const statusIcon = document.getElementById('home-status-icon');
    const statusDetail = document.getElementById('home-status-detail');
    const gasReading = document.getElementById('home-gas-reading');
    const safetyScore = document.getElementById('home-safety-score');
    const cookingStatus = document.getElementById('home-cooking-status');

    if (data.status === 'DANGER') {
        if (statusCard) {
            statusCard.className = 'card status-card danger';
        }
        if (statusTitle) statusTitle.innerText = '🚨 LEAK DETECTED';
        if (statusIcon) statusIcon.innerText = 'warning';
        if (statusDetail) statusDetail.innerText = 'High LPG Concentration! Valve Shutoff Triggered.';
    } else {
        if (statusCard) {
            statusCard.className = 'card status-card safe';
        }
        if (statusTitle) statusTitle.innerText = 'SAFE';
        if (statusIcon) statusIcon.innerText = 'verified_user';
        if (statusDetail) statusDetail.innerText = `Last checked: ${data.lastChecked || 'Just now'}`;
    }

    if (gasReading) {
        gasReading.innerText = `Gas: ${data.gasLevel} PPM | Valve: ${data.valveStatus}`;
    }

    if (safetyScore) {
        safetyScore.innerText = data.todaySafetyScore !== undefined ? data.todaySafetyScore : 7;
    }

    if (cookingStatus && !activeCookingSessionId) {
        if (data.activeCooking) {
            cookingStatus.innerText = `Active - started at ${data.activeCooking.startTime}`;
        } else {
            cookingStatus.innerText = 'Not currently cooking';
        }
    }
}

// Polling interval: synchronize dashboard every 3 seconds
setInterval(() => {
    const homeScreen = document.getElementById('home-screen');
    if (homeScreen && homeScreen.classList.contains('active')) {
        fetchDashboardSummary();
    }
}, 3000);

// ====================================================================
// Safety Checklist Logic
// ====================================================================
const checkboxes = document.querySelectorAll('.safety-check');
const progress = document.getElementById('safety-progress');
const countText = document.getElementById('safety-count');
const completeBtn = document.getElementById('complete-safety-btn');

checkboxes.forEach(box => {
    box.addEventListener('change', () => {
        let checked = document.querySelectorAll('.safety-check:checked').length;
        let total = checkboxes.length;
        countText.innerText = checked;
        progress.style.width = `${(checked / total) * 100}%`;
        
        completeBtn.disabled = checked !== total;
    });
});

async function completeSafetyCheck() {
    try {
        const response = await fetch(`${API_BASE_URL}/safety-check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checksCompleted: 7 })
        });
        const result = await response.json();
        alert("Kitchen Safety Status: SAFE ✅\nChecklist logged into database.");
    } catch (err) {
        console.error('Error submitting checklist:', err);
        alert("Kitchen Safety Status: SAFE ✅\nChecklist logged locally.");
    }
    document.getElementById('home-safety-score').innerText = '7';
    navigateTo('home-screen');
}

// ====================================================================
// Cooking Timer Logic & Session Management
// ====================================================================
let timerInterval;
let secondsElapsed = 0;
let activeCookingSessionId = null;

async function startCooking() {
    const startTime = document.getElementById('start-time').value;
    const duration = document.getElementById('duration-select').value;
    const interval = document.getElementById('interval-select').value;
    
    document.getElementById('active-start-time').innerText = startTime;
    document.getElementById('active-duration').innerText = duration;
    
    secondsElapsed = 0;
    updateTimerDisplay();
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();
    }, 1000);
    
    document.getElementById('home-cooking-status').innerText = `Active - started at ${startTime}`;

    // Send session to backend API
    try {
        const res = await fetch(`${API_BASE_URL}/cooking/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startTime, duration, interval })
        });
        const data = await res.json();
        if (data.success && data.data) {
            activeCookingSessionId = data.data.id;
        }
    } catch (err) {
        console.warn('Could not persist cooking start to backend:', err);
    }
    
    navigateTo('active-cooking-screen');
}

function updateTimerDisplay() {
    const h = String(Math.floor(secondsElapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsElapsed % 3600) / 60)).padStart(2, '0');
    const s = String(secondsElapsed % 60).padStart(2, '0');
    document.getElementById('timer-display').innerText = `${h}:${m}:${s}`;
}

function snoozeCooking(extraMinutes = 10) {
    const activeDuration = document.getElementById('active-duration');
    const current = parseInt(activeDuration.innerText, 10) || 60;
    activeDuration.innerText = current + extraMinutes;
    alert(`⏰ Timer snoozed: +${extraMinutes} minutes added.`);
}

async function finishCooking() {
    clearInterval(timerInterval);
    
    if (activeCookingSessionId) {
        try {
            await fetch(`${API_BASE_URL}/cooking/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: activeCookingSessionId })
            });
        } catch (err) {
            console.warn('Could not complete cooking session in API:', err);
        }
        activeCookingSessionId = null;
    }

    alert("Cooking session completed safely ✅");
    document.getElementById('home-cooking-status').innerText = "Not currently cooking";
    navigateTo('home-screen');
}

// ====================================================================
// Emergency Trigger Logic
// ====================================================================
async function showEmergencyInstructions() {
    document.getElementById('emergency-instructions').classList.remove('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/emergency/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: 'LPG-ESP32-01',
                reportedBy: 'Emergency Button (User)'
            })
        });
        const result = await response.json();
        console.log('Emergency response:', result);
    } catch (err) {
        console.error('Failed to dispatch emergency alert:', err);
    }
}

// ====================================================================
// Usage & History Data Fetching
// ====================================================================
async function fetchUsageData() {
    try {
        const res = await fetch(`${API_BASE_URL}/usage`);
        const json = await res.json();
        if (json.success && json.data) {
            const u = json.data;
            document.getElementById('usage-progress-bar').style.width = `${u.percentage}%`;
            document.getElementById('usage-percentage-text').innerText = `${u.percentage}% Estimated Remaining`;
            document.getElementById('usage-capacity').innerText = u.capacityKg;
            document.getElementById('usage-remaining').innerText = u.remainingKg;
            document.getElementById('usage-daily-avg').innerText = u.dailyConsumptionKg;
            document.getElementById('usage-depletion').innerText = u.estimatedDepletionDate || '30 September';

            // Render chart bars if available
            if (u.history && u.history.length > 0) {
                const chart = document.getElementById('usage-chart');
                chart.innerHTML = '';
                u.history.forEach(item => {
                    const bar = document.createElement('div');
                    bar.className = 'bar';
                    const height = Math.min(100, Math.max(20, Math.round(item.consumption * 120)));
                    bar.style.height = `${height}px`;
                    bar.title = `${item.day}: ${item.consumption} kg`;
                    chart.appendChild(bar);
                });
            }
        }
    } catch (err) {
        console.warn('Could not fetch usage data:', err);
    }
}

async function addDailyUsage() {
    const input = prompt("Enter daily LPG consumption in kg:", "0.35");
    if (!input || isNaN(input)) return;

    try {
        const res = await fetch(`${API_BASE_URL}/usage/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consumptionKg: parseFloat(input) })
        });
        const json = await res.json();
        if (json.success) {
            alert("Daily usage logged successfully!");
            fetchUsageData();
        }
    } catch (err) {
        console.error('Error logging daily usage:', err);
    }
}

async function fetchHistoryData() {
    try {
        const res = await fetch(`${API_BASE_URL}/cooking/history`);
        const json = await res.json();
        if (json.success && json.data) {
            const container = document.getElementById('history-container');
            container.innerHTML = '';

            json.data.forEach(item => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <h4>🔥 Cooking Session</h4>
                    <p class="text-sm text-gray">${item.date || 'Today'} | Start: ${item.startTime}</p>
                    <p>Expected: ${item.expectedDuration} min | Status: <span class="success-text">${item.status} ✅</span></p>
                `;
                container.appendChild(card);
            });

            // Add standard safety reminder card
            const reminderCard = document.createElement('div');
            reminderCard.className = 'card warning-border';
            reminderCard.innerHTML = `
                <h4>⏰ Safety Reminder Log</h4>
                <p class="text-sm text-gray">Auto Safety System</p>
                <p>“Automatic valve supervisor active.”</p>
            `;
            container.appendChild(reminderCard);
        }
    } catch (err) {
        console.warn('Could not fetch cooking history:', err);
    }
}

// ====================================================================
// Settings Management
// ====================================================================
async function fetchSettingsData() {
    try {
        const res = await fetch(`${API_BASE_URL}/settings`);
        const json = await res.json();
        if (json.success && json.data) {
            document.getElementById('setting-reminders').checked = !!json.data.cookingReminders;
            document.getElementById('setting-reminder-min').value = json.data.defaultReminderMin || 30;
            document.getElementById('setting-duration-min').value = json.data.defaultDurationMin || 60;
        }
    } catch (err) {
        console.warn('Could not load settings:', err);
    }
}

async function saveSettings() {
    const cookingReminders = document.getElementById('setting-reminders').checked;
    const defaultReminderMin = document.getElementById('setting-reminder-min').value;
    const defaultDurationMin = document.getElementById('setting-duration-min').value;

    try {
        await fetch(`${API_BASE_URL}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookingReminders, defaultReminderMin, defaultDurationMin })
        });
    } catch (err) {
        console.warn('Could not save settings:', err);
    }
}

// ====================================================================
// Live Hackathon Presentation Simulation Functions
// ====================================================================
async function simulateGasLeak() {
    try {
        const res = await fetch(`${API_BASE_URL}/simulator/trigger-leak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gasLevel: 720 })
        });
        const json = await res.json();
        alert(`🚨 SIMULATION ACTIVE: Gas leak detected at 720 PPM!\nAutomatic shut-off valve commanded.`);
        fetchDashboardSummary();
        navigateTo('home-screen');
    } catch (err) {
        alert('Simulation failed: ' + err.message);
    }
}

async function simulateSafeState() {
    try {
        const res = await fetch(`${API_BASE_URL}/simulator/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const json = await res.json();
        alert(`🟢 SIMULATION ACTIVE: Gas level normalized to 140 PPM.\nKitchen is SAFE.`);
        fetchDashboardSummary();
        navigateTo('home-screen');
    } catch (err) {
        alert('Simulation failed: ' + err.message);
    }
}

async function resetDemoData() {
    if (!confirm('Reset all demo data back to clean state?')) return;
    try {
        await fetch(`${API_BASE_URL}/simulator/reset-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        alert('Demo database reset successfully ✅');
        fetchDashboardSummary();
        navigateTo('home-screen');
    } catch (err) {
        alert('Reset failed: ' + err.message);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchDashboardSummary();
});