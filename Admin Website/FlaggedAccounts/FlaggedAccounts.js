// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getDatabase, ref, onValue, update, push, set, get } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA9ADVig4CiO2Y3ELl3unzXajdzxCgRxHI",
  authDomain: "toda-contribution-system.firebaseapp.com",
  databaseURL: "https://toda-contribution-system-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "toda-contribution-system",
  storageBucket: "toda-contribution-system.firebasestorage.app",
  messagingSenderId: "536068566619",
  appId: "1:536068566619:web:ff7cc576e59b76ae58997e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Global variables
let allAccounts = [];
let filteredAccounts = [];
let currentPage = 1;
let itemsPerPage = 25;
let selectedFlag = null;
let confirmCallback = null;

// Flag type configurations
const FLAG_TYPES = {
  // Driver Flags
  LOW_CONTRIBUTIONS: {
    category: 'driver',
    severity: 'high',
    points: 75,
    name: 'Low Contributions',
    icon: '💰',
    color: '#f97316'
  },
  INACTIVE_ACCOUNT: {
    category: 'driver',
    severity: 'medium',
    points: 50,
    name: 'Inactive Account',
    icon: '💤',
    color: '#eab308'
  },
  HIGH_CANCELLATION_RATE: {
    category: 'driver',
    severity: 'high',
    points: 75,
    name: 'High Cancellation Rate',
    icon: '🚫',
    color: '#f97316'
  },
  CONTRIBUTION_IRREGULARITIES: {
    category: 'driver',
    severity: 'high',
    points: 75,
    name: 'Contribution Irregularities',
    icon: '📉',
    color: '#f97316'
  },
  CUSTOMER_COMPLAINTS: {
    category: 'driver',
    severity: 'critical',
    points: 100,
    name: 'Customer Complaints',
    icon: '😡',
    color: '#ef4444'
  },
  RFID_ISSUES: {
    category: 'driver',
    severity: 'medium',
    points: 50,
    name: 'RFID Issues',
    icon: '🏷️',
    color: '#eab308'
  },
  
  // Customer Flags
  NO_SHOW: {
    category: 'customer',
    severity: 'critical',
    points: 100,
    name: 'No-Show Pattern',
    icon: '👻',
    color: '#ef4444'
  },
  NON_PAYMENT: {
    category: 'customer',
    severity: 'critical',
    points: 100,
    name: 'Non-Payment',
    icon: '💸',
    color: '#ef4444'
  },
  WRONG_PIN: {
    category: 'customer',
    severity: 'medium',
    points: 50,
    name: 'Wrong Location PIN',
    icon: '📍',
    color: '#eab308'
  },
  ABUSIVE_BEHAVIOR: {
    category: 'customer',
    severity: 'critical',
    points: 100,
    name: 'Abusive Behavior',
    icon: '🤬',
    color: '#ef4444'
  },
  EXCESSIVE_CANCELLATIONS: {
    category: 'customer',
    severity: 'high',
    points: 75,
    name: 'Excessive Cancellations',
    icon: '❌',
    color: '#f97316'
  },
  DISCOUNT_ABUSE: {
    category: 'customer',
    severity: 'high',
    points: 75,
    name: 'Discount Abuse',
    icon: '🎫',
    color: '#f97316'
  }
};

// Show notification message
function showMessage(text, type = 'success') {
  const container = document.getElementById('messageContainer');
  const message = document.createElement('div');
  message.className = `message ${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  message.innerHTML = `
    <span class="message-icon">${icons[type] || icons.info}</span>
    <span class="message-text">${text}</span>
  `;
  
  container.appendChild(message);
  
  setTimeout(() => {
    message.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => message.remove(), 300);
  }, 4000);
}

// Confirmation dialog
function showConfirm(message, title = '⚠️ Confirm Action', confirmText = 'Confirm') {
  return new Promise((resolve) => {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmBtn').textContent = confirmText;
    document.getElementById('confirmModal').classList.add('active');
    
    confirmCallback = (result) => {
      document.getElementById('confirmModal').classList.remove('active');
      confirmCallback = null;
      resolve(result);
    };
  });
}

window.handleConfirm = function() {
  if (confirmCallback) confirmCallback(true);
}

window.closeConfirmModal = function() {
  if (confirmCallback) confirmCallback(false);
}

// Nested confirmation (for use inside account modal)
let nestedConfirmCallback = null;

function showNestedConfirm(message, title = '⚠️ Confirm Action', confirmText = 'Confirm') {
  return new Promise((resolve) => {
    const modal = document.getElementById('nestedConfirmModal');
    if (!modal) {
      // Fallback to regular confirm if nested modal not available
      resolve(confirm(message));
      return;
    }
    
    document.getElementById('nestedConfirmTitle').textContent = title;
    document.getElementById('nestedConfirmMessage').textContent = message;
    document.getElementById('nestedConfirmBtn').textContent = confirmText;
    modal.style.display = 'flex';
    
    nestedConfirmCallback = (result) => {
      modal.style.display = 'none';
      nestedConfirmCallback = null;
      resolve(result);
    };
  });
}

window.handleNestedConfirm = function() {
  if (nestedConfirmCallback) nestedConfirmCallback(true);
}

window.closeNestedConfirm = function() {
  if (nestedConfirmCallback) nestedConfirmCallback(false);
}

// Helper function to recalculate and update flag score for an account
async function recalculateFlagScore(accountId, accountType) {
  try {
    const flagCollectionPath = accountType === 'driver' ? 'driverFlags' : 'userFlags';
    const accountPath = accountType === 'driver' ? 'drivers' : 'users';
    
    // Get all flags for this account
    const allFlagsRef = ref(db, `${flagCollectionPath}/${accountId}`);
    const allFlagsSnap = await get(allFlagsRef);
    let totalScore = 0;
    
    // Sum up points from active flags only
    if (allFlagsSnap.exists()) {
      allFlagsSnap.forEach(childSnap => {
        const flag = childSnap.val();
        // Only count active flags (not resolved or dismissed)
        if (flag.status === 'active') {
          totalScore += (flag.points || 0);
        }
      });
    }
    
    // Determine status based on total score
    const newStatus = totalScore > 300 ? 'suspended' 
      : totalScore > 150 ? 'restricted' 
      : totalScore > 50 ? 'monitored' 
      : 'good';
    
    // Update account with recalculated score and status
    const accountRef = ref(db, `${accountPath}/${accountId}`);
    await update(accountRef, {
      flagScore: totalScore,
      flagStatus: newStatus
    });
    
    return { totalScore, newStatus };
  } catch (error) {
    console.error('Error recalculating flag score:', error);
    throw error;
  }
}

// Load all accounts with their flag status
function loadFlaggedAccounts() {
  allAccounts = [];
  
  const driversRef = ref(db, 'drivers');
  const usersRef = ref(db, 'users');
  const driverFlagsRef = ref(db, 'driverFlags');
  const userFlagsRef = ref(db, 'userFlags');
  
  // Load all drivers
  get(driversRef).then((driversSnapshot) => {
    const drivers = driversSnapshot.val() || {};
    
    // Load driver flags
    get(driverFlagsRef).then((flagsSnapshot) => {
      const driverFlags = flagsSnapshot.exists() ? flagsSnapshot.val() : {};
      
      // Process each driver
      Object.keys(drivers).forEach(driverId => {
        const driver = drivers[driverId];
        const flags = driverFlags[driverId] || {};
        const flagArray = Object.keys(flags).map(fid => ({ flagId: fid, ...flags[fid] }));
        const activeFlags = flagArray.filter(f => f.status === 'active');
        
        // Calculate flag score from active flags (not stored value)
        const flagScore = activeFlags.reduce((total, flag) => total + (flag.points || 0), 0);
        
        // Determine status based on calculated score
        let flagStatus = 'good';
        if (flagScore >= 301) flagStatus = 'suspended';
        else if (flagScore >= 151) flagStatus = 'restricted';
        else if (flagScore >= 51) flagStatus = 'monitored';
        
        allAccounts.push({
          accountId: driverId,
          accountType: 'driver',
          accountName: driver.driverName || driver.name || 'Unknown Driver',
          accountPhone: driver.phoneNumber || 'N/A',
          accountEmail: driver.email || 'N/A',
          flagScore: flagScore,
          flagStatus: flagStatus,
          activeFlags: activeFlags,
          allFlags: flagArray,
          totalFlags: flagArray.length
        });
      });
      
      // Now load customers
      loadCustomerAccounts();
    });
  });
}

function loadCustomerAccounts() {
  const usersRef = ref(db, 'users');
  const userFlagsRef = ref(db, 'userFlags');
  
  // Load all users
  get(usersRef).then((usersSnapshot) => {
    const users = usersSnapshot.val() || {};
    
    // Load user flags
    get(userFlagsRef).then((flagsSnapshot) => {
      const userFlags = flagsSnapshot.exists() ? flagsSnapshot.val() : {};
      
      // Process each customer
      Object.keys(users).forEach(userId => {
        const user = users[userId];
        
        // Only include passengers
        if (user.userType === 'PASSENGER') {
          const flags = userFlags[userId] || {};
          const flagArray = Object.keys(flags).map(fid => ({ flagId: fid, ...flags[fid] }));
          const activeFlags = flagArray.filter(f => f.status === 'active');
          
          // Calculate flag score from active flags (not stored value)
          const flagScore = activeFlags.reduce((total, flag) => total + (flag.points || 0), 0);
          
          // Determine status based on calculated score
          let flagStatus = 'good';
          if (flagScore >= 301) flagStatus = 'suspended';
          else if (flagScore >= 151) flagStatus = 'restricted';
          else if (flagScore >= 51) flagStatus = 'monitored';
          
          allAccounts.push({
            accountId: userId,
            accountType: 'customer',
            accountName: user.name || 'Unknown Customer',
            accountPhone: user.phoneNumber || 'N/A',
            accountEmail: user.email || 'N/A',
            flagScore: flagScore,
            flagStatus: flagStatus,
            activeFlags: activeFlags,
            allFlags: flagArray,
            totalFlags: flagArray.length
          });
        }
      });
      
      // Sort by flag score (highest first), then by name
      allAccounts.sort((a, b) => {
        if (b.flagScore !== a.flagScore) {
          return b.flagScore - a.flagScore;
        }
        return a.accountName.localeCompare(b.accountName);
      });
      
      updateStats();
      applyFilters();
    });
  });
}

// Update statistics
function updateStats() {
  const total = allAccounts.length;
  const suspended = allAccounts.filter(a => a.flagStatus === 'suspended').length;
  const restricted = allAccounts.filter(a => a.flagStatus === 'restricted').length;
  const monitored = allAccounts.filter(a => a.flagStatus === 'monitored').length;
  const good = allAccounts.filter(a => a.flagStatus === 'good').length;
  
  document.getElementById('totalAccounts').textContent = total;
  document.getElementById('suspendedCount').textContent = suspended;
  document.getElementById('restrictedCount').textContent = restricted;
  document.getElementById('monitoredCount').textContent = monitored;
  document.getElementById('goodCount').textContent = good;
}

// Apply filters
window.applyFilters = function() {
  const accountType = document.getElementById('accountTypeFilter').value;
  const flagStatus = document.getElementById('flagStatusFilter').value;
  const flaggedOnly = document.getElementById('flaggedOnlyFilter').value;
  const search = document.getElementById('searchInput').value.toLowerCase();
  
  filteredAccounts = allAccounts.filter(account => {
    const matchesAccountType = accountType === 'all' || account.accountType === accountType;
    const matchesFlagStatus = flagStatus === 'all' || account.flagStatus === flagStatus;
    const matchesFlaggedOnly = flaggedOnly === 'all' || 
      (flaggedOnly === 'flagged' && account.flagScore > 0) ||
      (flaggedOnly === 'clean' && account.flagScore === 0);
    const matchesSearch = !search || 
      account.accountName.toLowerCase().includes(search) ||
      account.accountPhone.includes(search) ||
      account.accountEmail.toLowerCase().includes(search) ||
      account.accountId.toLowerCase().includes(search);
    
    return matchesAccountType && matchesFlagStatus && matchesFlaggedOnly && matchesSearch;
  });
  
  currentPage = 1;
  displayAccounts();
}

// Display accounts
function displayAccounts() {
  const tbody = document.getElementById('flaggedTableBody');
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageAccounts = filteredAccounts.slice(start, end);
  
  if (pageAccounts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <p>No accounts found</p>
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = pageAccounts.map(account => {
      const initials = account.accountName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const statusClass = account.flagStatus || 'good';
      const statusEmoji = {
        suspended: '🚫',
        restricted: '⚠️',
        monitored: '👀',
        good: '✅'
      }[statusClass] || '✅';
      
      return `
        <tr class="account-row ${account.flagScore > 0 ? 'has-flags' : 'no-flags'}">
          <td>
            <div class="account-info">
              <div class="account-avatar">${initials}</div>
              <div class="account-details">
                <h4>${account.accountName}</h4>
                <p>${account.accountPhone}</p>
              </div>
            </div>
          </td>
          <td>
            <span class="badge ${account.accountType}">${account.accountType}</span>
          </td>
          <td>
            <span class="flag-score ${account.flagScore > 0 ? 'has-score' : 'no-score'}">
              ${account.flagScore} pts
            </span>
          </td>
          <td>
            <span class="status-badge ${statusClass}">
              ${statusEmoji} ${statusClass}
            </span>
          </td>
          <td>
            <span class="${account.activeFlags.length > 0 ? 'active-flags-count' : 'no-flags-text'}">
              ${account.activeFlags.length > 0 
                ? `🚩 ${account.activeFlags.length} active` 
                : 'No active flags'}
            </span>
          </td>
          <td>
            <div class="flag-types-preview">
              ${account.activeFlags.length > 0 
                ? account.activeFlags.slice(0, 2).map(flag => {
                    const flagType = FLAG_TYPES[flag.type] || {};
                    return `<span class="flag-mini" title="${flagType.name || flag.type}">${flagType.icon || '🚩'} ${flagType.name || flag.type}</span>`;
                  }).join('')
                : '<span class="no-flags-text">Clean record</span>'}
              ${account.activeFlags.length > 2 ? `<span class="more-flags">+${account.activeFlags.length - 2} more</span>` : ''}
            </div>
          </td>
          <td>
            <button class="action-btn" onclick="viewAccountDetails('${account.accountId}', '${account.accountType}')">
              View Details
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
  
  // Update table count
  document.getElementById('tableCount').textContent = `${filteredAccounts.length} account${filteredAccounts.length !== 1 ? 's' : ''}`;
  
  // Update pagination
  const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);
  document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages || 1}`;
  
  const prevBtn = document.querySelectorAll('.page-btn')[0];
  const nextBtn = document.querySelectorAll('.page-btn')[1];
  
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage >= totalPages;
}

// Change page
window.changePage = function(direction) {
  const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);
  const newPage = currentPage + direction;
  
  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    displayAccounts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// View flag details
window.viewFlagDetails = async function(accountId, flagId) {
  const account = filteredAccounts.find(f => f.accountId === accountId && f.flagId === flagId);
  if (!account) return;
  
  selectedFlag = account;
  
  // Get full account data
  const accountRef = ref(db, `${account.accountType === 'driver' ? 'drivers' : 'users'}/${accountId}`);
  const snapshot = await get(accountRef);
  const fullAccount = snapshot.val();
  
  const flagType = FLAG_TYPES[account.type] || {};
  
  let detailsHTML = `
    <div class="flag-detail-section">
      <h3>${flagType.icon || '🚩'} ${flagType.name || account.type}</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-label">Account Type</div>
          <div class="detail-value">${account.accountType}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Severity</div>
          <div class="detail-value">
            <span class="badge ${account.severity}">${account.severity}</span>
          </div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Points</div>
          <div class="detail-value">${account.points || 0}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Status</div>
          <div class="detail-value">
            <span class="badge ${account.status}">${account.status}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="flag-detail-section">
      <h3>👤 Account Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-label">Name</div>
          <div class="detail-value">${account.accountName}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Phone</div>
          <div class="detail-value">${account.accountPhone}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Email</div>
          <div class="detail-value">${account.accountEmail}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Total Flag Score</div>
          <div class="detail-value">
            <span class="flag-score ${getSeverityByScore(account.flagScore)}">${account.flagScore || 0}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="flag-detail-section">
      <h3>📋 Flag Details</h3>
      <div class="detail-grid">
        ${Object.keys(account.details || {}).map(key => `
          <div class="detail-item">
            <div class="detail-label">${formatKey(key)}</div>
            <div class="detail-value">${formatValue(account.details[key])}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  // Add timeline if actions exist
  if (account.actions && account.actions.length > 0) {
    detailsHTML += `
      <div class="flag-detail-section">
        <h3>📅 Action Timeline</h3>
        <div class="timeline">
          ${account.actions.map(action => `
            <div class="timeline-item">
              <div class="timeline-date">${new Date(action.timestamp).toLocaleString()}</div>
              <div class="timeline-content"><strong>${action.action}</strong></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Add notes if available
  if (account.notes) {
    detailsHTML += `
      <div class="flag-detail-section">
        <h3>📝 Notes</h3>
        <div class="detail-item">
          <div class="detail-value">${account.notes}</div>
        </div>
      </div>
    `;
  }
  
  document.getElementById('flagDetailsContent').innerHTML = detailsHTML;
  document.getElementById('flagDetailsModal').classList.add('active');
}

// View account details (all flags)
window.viewAccountDetails = async function(accountId, accountType) {
  try {
    const account = allAccounts.find(a => a.accountId === accountId && a.accountType === accountType);
    if (!account) {
      showMessage('Account not found', 'error');
      return;
    }
    
    const statusInfo = {
      suspended: { emoji: '🚫', label: 'Suspended', desc: '301+ points' },
      restricted: { emoji: '⚠️', label: 'Restricted', desc: '151-300 points' },
      monitored: { emoji: '👀', label: 'Monitored', desc: '51-150 points' },
      good: { emoji: '✅', label: 'Good Standing', desc: '0-50 points' }
    }[account.flagStatus] || { emoji: '✅', label: 'Good', desc: '' };
    
    const activeFlags = account.activeFlags || [];
    const resolvedFlags = (account.allFlags || []).filter(f => f.status === 'resolved');
    const dismissedFlags = (account.allFlags || []).filter(f => f.status === 'dismissed');
    
    const modalHTML = `
      <div class="modal-header">
        <h2>${account.accountType === 'driver' ? '🚗' : '👤'} ${account.accountName}</h2>
        <button class="close-btn" onclick="closeAccountModal()">×</button>
      </div>
      
      <div class="account-overview-grid">
        <div class="overview-card">
          <div class="overview-label">Account Type</div>
          <div class="overview-value"><span class="badge ${account.accountType}">${account.accountType}</span></div>
        </div>
        <div class="overview-card">
          <div class="overview-label">Flag Score</div>
          <div class="overview-value">
            <span class="flag-score ${account.flagScore > 0 ? 'has-score' : 'no-score'}">${account.flagScore} pts</span>
          </div>
        </div>
        <div class="overview-card">
          <div class="overview-label">Status</div>
          <div class="overview-value">
            <span class="status-badge ${account.flagStatus}">${statusInfo.emoji} ${statusInfo.label}</span>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">${statusInfo.desc}</div>
          </div>
        </div>
        <div class="overview-card">
          <div class="overview-label">Total Flags</div>
          <div class="overview-value">${account.totalFlags}</div>
        </div>
      </div>
      
      <div class="account-contact-info">
        <h3>📇 Contact Information</h3>
        <div class="info-grid">
          ${account.accountEmail !== 'N/A' ? `<div><strong>Email:</strong> ${account.accountEmail}</div>` : ''}
          <div><strong>Phone:</strong> ${account.accountPhone}</div>
          <div><strong>Account ID:</strong> <code>${accountId}</code></div>
        </div>
      </div>
      
      ${activeFlags.length > 0 ? `
        <div class="flags-section active-flags">
          <h3>🚩 Active Flags (${activeFlags.length})</h3>
          ${activeFlags.map(flag => {
            const flagType = FLAG_TYPES[flag.type] || {};
            return `
              <div class="flag-card ${flag.severity}">
                <div class="flag-card-header">
                  <span class="flag-icon">${flagType.icon || '🚩'}</span>
                  <span class="flag-name">${flagType.name || flag.type}</span>
                  <span class="flag-points">${flag.points || 0} pts</span>
                </div>
                <div class="flag-card-body">
                  <div class="flag-meta">
                    <span class="badge ${flag.severity}">${flag.severity}</span>
                    <span class="flag-date">Flagged: ${new Date(flag.timestamp).toLocaleDateString()}</span>
                  </div>
                  ${flag.details ? `
                    <div class="flag-details">
                      ${Object.keys(flag.details).map(key => `
                        <div><strong>${formatKey(key)}:</strong> ${formatValue(flag.details[key])}</div>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
                <div class="flag-card-actions">
                  <button class="btn-sm btn-resolve" onclick="resolveSpecificFlag('${accountId}', '${accountType}', '${flag.flagId}')">✅ Resolve</button>
                  <button class="btn-sm btn-escalate" onclick="escalateSpecificFlag('${accountId}', '${accountType}', '${flag.flagId}')">⚠️ Escalate</button>
                  <button class="btn-sm btn-dismiss" onclick="dismissSpecificFlag('${accountId}', '${accountType}', '${flag.flagId}')">🗑️ Dismiss</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="no-flags-section">
          <div class="no-flags-icon">✅</div>
          <div class="no-flags-title">Clean Record</div>
          <div class="no-flags-text">This account has no active flags</div>
        </div>
      `}
      
      ${resolvedFlags.length > 0 ? `
        <div class="flags-section resolved-flags">
          <h3>✅ Resolved Flags (${resolvedFlags.length})</h3>
          <div class="resolved-flags-list">
            ${resolvedFlags.map(flag => {
              const flagType = FLAG_TYPES[flag.type] || {};
              return `
                <div class="resolved-flag-item">
                  ${flagType.icon || '🚩'} ${flagType.name || flag.type} - 
                  <span class="resolved-date">Resolved on ${new Date(flag.resolvedDate || flag.timestamp).toLocaleDateString()}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
      
      ${dismissedFlags.length > 0 ? `
        <div class="flags-section dismissed-flags">
          <h3>🗑️ Dismissed Flags (${dismissedFlags.length})</h3>
          <div class="dismissed-flags-list">
            ${dismissedFlags.map(flag => {
              const flagType = FLAG_TYPES[flag.type] || {};
              return `
                <div class="dismissed-flag-item">
                  ${flagType.icon || '🚩'} ${flagType.name || flag.type} - 
                  <span class="dismissed-date">Dismissed on ${new Date(flag.dismissedDate || flag.timestamp).toLocaleDateString()}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeAccountModal()">Close</button>
      </div>
      
      <!-- Embedded Confirmation Modal -->
      <div class="modal nested-modal" id="nestedConfirmModal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="nestedConfirmTitle">⚠️ Confirm Action</h2>
          </div>
          <div class="modal-body">
            <p id="nestedConfirmMessage"></p>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="closeNestedConfirm()">Cancel</button>
            <button class="btn-primary" id="nestedConfirmBtn" onclick="handleNestedConfirm()">Confirm</button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('accountModalContent').innerHTML = modalHTML;
    document.getElementById('accountModal').classList.add('active');
    
  } catch (error) {
    console.error('Error viewing account details:', error);
    showMessage('Error loading account details: ' + error.message, 'error');
  }
}

window.closeAccountModal = function() {
  document.getElementById('accountModal').classList.remove('active');
}

// Close flag details
window.closeFlagDetails = function() {
  document.getElementById('flagDetailsModal').classList.remove('active');
  selectedFlag = null;
}

// Resolve specific flag
window.resolveSpecificFlag = async function(accountId, accountType, flagId) {
  const confirmed = await showNestedConfirm(
    'Are you sure you want to resolve this flag?',
    '✅ Resolve Flag',
    'Resolve'
  );
  
  if (!confirmed) return;
  
  try {
    const flagCollectionPath = accountType === 'driver' ? 'driverFlags' : 'userFlags';
    const flagRef = ref(db, `${flagCollectionPath}/${accountId}/${flagId}`);
    
    // Get flag data
    const flagSnap = await get(flagRef);
    if (!flagSnap.exists()) {
      showMessage('Flag not found', 'error');
      return;
    }
    
    // Update flag status to resolved
    await update(flagRef, {
      status: 'resolved',
      resolvedDate: Date.now(),
      resolvedBy: 'Admin'
    });
    
    // Recalculate total flag score from all active flags
    await recalculateFlagScore(accountId, accountType);
    
    showMessage('Flag resolved successfully', 'success');
    closeAccountModal();
    loadFlaggedAccounts();
    
  } catch (error) {
    showMessage('Error resolving flag: ' + error.message, 'error');
  }
}

// Escalate specific flag
window.escalateSpecificFlag = async function(accountId, accountType, flagId) {
  const confirmed = await showNestedConfirm(
    'Are you sure you want to escalate this flag? This will increase the severity and add 25 points.',
    '⚠️ Escalate Flag',
    'Escalate'
  );
  
  if (!confirmed) return;
  
  try {
    const flagCollectionPath = accountType === 'driver' ? 'driverFlags' : 'userFlags';
    const flagRef = ref(db, `${flagCollectionPath}/${accountId}/${flagId}`);
    
    // Get current flag
    const flagSnap = await get(flagRef);
    if (!flagSnap.exists()) {
      showMessage('Flag not found', 'error');
      return;
    }
    
    const flag = flagSnap.val();
    const newSeverity = flag.severity === 'medium' ? 'high' : 
                       flag.severity === 'high' ? 'critical' : 'critical';
    const additionalPoints = 25;
    
    // Update flag with new severity and points
    await update(flagRef, {
      severity: newSeverity,
      points: (flag.points || 0) + additionalPoints
    });
    
    // Recalculate total flag score from all active flags
    await recalculateFlagScore(accountId, accountType);
    
    showMessage('Flag escalated successfully', 'success');
    closeAccountModal();
    loadFlaggedAccounts();
    
  } catch (error) {
    showMessage('Error escalating flag: ' + error.message, 'error');
  }
}

// Dismiss specific flag
window.dismissSpecificFlag = async function(accountId, accountType, flagId) {
  const confirmed = await showNestedConfirm(
    'Are you sure you want to dismiss this flag? This will mark it as a false positive.',
    '🗑️ Dismiss Flag',
    'Dismiss'
  );
  
  if (!confirmed) return;
  
  try {
    const flagCollectionPath = accountType === 'driver' ? 'driverFlags' : 'userFlags';
    const flagRef = ref(db, `${flagCollectionPath}/${accountId}/${flagId}`);
    
    // Update flag status to dismissed
    await update(flagRef, {
      status: 'dismissed',
      dismissedDate: Date.now(),
      dismissedBy: 'Admin'
    });
    
    // Recalculate total flag score from all active flags
    await recalculateFlagScore(accountId, accountType);
    
    showMessage('Flag dismissed successfully', 'success');
    closeAccountModal();
    loadFlaggedAccounts();
    
  } catch (error) {
    showMessage('Error dismissing flag: ' + error.message, 'error');
  }
}

// Resolve flag
window.resolveFlag = async function() {
  if (!selectedFlag) return;
  
  const confirmed = await showConfirm(
    `Are you sure you want to resolve this flag for ${selectedFlag.accountName}?`,
    '✅ Resolve Flag',
    'Resolve'
  );
  
  if (!confirmed) return;
  
  try {
    const flagCollectionPath = selectedFlag.accountType === 'driver' ? 'driverFlags' : 'userFlags';
    const flagRef = ref(db, `${flagCollectionPath}/${selectedFlag.accountId}/${selectedFlag.flagId}`);
    
    // Update flag status to resolved
    await update(flagRef, {
      status: 'resolved',
      resolvedDate: Date.now(),
      resolvedBy: 'Admin'
    });
    
    // Recalculate total flag score from all active flags
    await recalculateFlagScore(selectedFlag.accountId, selectedFlag.accountType);
    
    showMessage('Flag resolved successfully', 'success');
    closeFlagDetails();
    loadFlaggedAccounts();
  } catch (error) {
    showMessage('Error resolving flag: ' + error.message, 'error');
  }
}

// Escalate flag
window.escalateFlag = async function() {
  if (!selectedFlag) return;
  
  const confirmed = await showConfirm(
    `Are you sure you want to escalate this flag for ${selectedFlag.accountName}? This will increase the severity.`,
    '⚠️ Escalate Flag',
    'Escalate'
  );
  
  if (!confirmed) return;
  
  try {
    const flagCollectionPath = selectedFlag.accountType === 'driver' ? 'driverFlags' : 'userFlags';
    const flagRef = ref(db, `${flagCollectionPath}/${selectedFlag.accountId}/${selectedFlag.flagId}`);
    
    const newSeverity = selectedFlag.severity === 'medium' ? 'high' : 
                       selectedFlag.severity === 'high' ? 'critical' : 'critical';
    const additionalPoints = 25;
    
    // Update flag with new severity and points
    await update(flagRef, {
      severity: newSeverity,
      points: (selectedFlag.points || 0) + additionalPoints
    });
    
    // Recalculate total flag score from all active flags
    await recalculateFlagScore(selectedFlag.accountId, selectedFlag.accountType);
    
    showMessage('Flag escalated successfully', 'success');
    closeFlagDetails();
    loadFlaggedAccounts();
  } catch (error) {
    showMessage('Error escalating flag: ' + error.message, 'error');
  }
}

// Dismiss flag
window.dismissFlag = async function() {
  if (!selectedFlag) return;
  
  const confirmed = await showConfirm(
    `Are you sure you want to dismiss this flag for ${selectedFlag.accountName}? This will mark it as a false positive.`,
    '🗑️ Dismiss Flag',
    'Dismiss'
  );
  
  if (!confirmed) return;
  
  try {
    const flagCollectionPath = selectedFlag.accountType === 'driver' ? 'driverFlags' : 'userFlags';
    const flagRef = ref(db, `${flagCollectionPath}/${selectedFlag.accountId}/${selectedFlag.flagId}`);
    
    // Update flag status to dismissed
    await update(flagRef, {
      status: 'dismissed',
      dismissedDate: Date.now(),
      dismissedBy: 'Admin'
    });
    
    // Recalculate total flag score from all active flags
    await recalculateFlagScore(selectedFlag.accountId, selectedFlag.accountType);
    
    showMessage('Flag dismissed successfully', 'success');
    closeFlagDetails();
    loadFlaggedAccounts();
  } catch (error) {
    showMessage('Error dismissing flag: ' + error.message, 'error');
  }
}

// Export report
window.exportReport = function() {
  const data = filteredAccounts;
  
  let csv = 'Account Name,Account Type,Phone,Flag Type,Severity,Points,Status,Flagged Date\n';
  
  data.forEach(account => {
    const flagType = FLAG_TYPES[account.type] || {};
    const name = (account.accountName || 'Unknown').replace(/,/g, ';');
    const phone = account.accountPhone || 'N/A';
    const type = (flagType.name || account.type).replace(/,/g, ';');
    const severity = account.severity || 'unknown';
    const points = account.points || 0;
    const status = account.status || 'unknown';
    const date = new Date(account.timestamp).toLocaleDateString();
    
    csv += `${name},${account.accountType},${phone},${type},${severity},${points},${status},${date}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `flagged_accounts_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showMessage('Report exported successfully', 'success');
}

// Run auto-detection
window.runAutoDetection = async function() {
  document.getElementById('detectionModal').classList.add('active');
  document.getElementById('closeDetectionBtn').disabled = true;
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('progressText').textContent = 'Starting detection...';
  document.getElementById('detectionResults').innerHTML = '';
  
  const results = [];
  
  try {
    // Step 1: Check driver contributions (10%)
    updateProgress(10, 'Analyzing driver contributions...');
    const contributionFlags = await detectLowContributions();
    results.push(...contributionFlags);
    
    // Step 2: Check inactive accounts (20%)
    updateProgress(20, 'Checking for inactive accounts...');
    const inactiveFlags = await detectInactiveAccounts();
    results.push(...inactiveFlags);
    
    // Step 3: Check driver cancellations (30%)
    updateProgress(30, 'Checking driver cancellation rates...');
    const driverCancellationFlags = await detectHighCancellations();
    results.push(...driverCancellationFlags);
    
    // Step 4: Check customer no-shows (40%)
    updateProgress(40, 'Analyzing customer no-show patterns...');
    const noShowFlags = await detectNoShows();
    results.push(...noShowFlags);
    
    // Step 5: Check customer excessive cancellations (50%)
    updateProgress(50, 'Checking customer cancellation rates...');
    const customerCancellationFlags = await detectExcessiveCancellations();
    results.push(...customerCancellationFlags);
    
    // Step 6: Check non-payment (60%)
    updateProgress(60, 'Checking for non-payment issues...');
    const nonPaymentFlags = await detectNonPayment();
    results.push(...nonPaymentFlags);
    
    // Step 7: Check wrong PIN (70%)
    updateProgress(70, 'Analyzing location PIN accuracy...');
    const wrongPinFlags = await detectWrongPin();
    results.push(...wrongPinFlags);
    
    // Step 8: Check abusive behavior (80%)
    updateProgress(80, 'Checking for abusive behavior reports...');
    const abusiveFlags = await detectAbusiveBehavior();
    results.push(...abusiveFlags);
    
    // Step 9: Finalize (100%)
    updateProgress(100, 'Detection complete!');
    
    // Display results
    displayDetectionResults(results);
    
    document.getElementById('closeDetectionBtn').disabled = false;
    showMessage(`Detection complete! Found ${results.length} new flags.`, 'success');
    
    // Reload flagged accounts to show new flags
    if (results.length > 0) {
      setTimeout(() => {
        loadFlaggedAccounts();
      }, 1000);
    }
    
  } catch (error) {
    showMessage('Error during auto-detection: ' + error.message, 'error');
    document.getElementById('closeDetectionBtn').disabled = false;
  }
}

// Update progress
function updateProgress(percent, text) {
  document.getElementById('progressFill').style.width = percent + '%';
  document.getElementById('progressText').textContent = text;
}

// Display detection results
function displayDetectionResults(results) {
  const container = document.getElementById('detectionResults');
  
  if (results.length === 0) {
    container.innerHTML = '<div class="detection-item no-flag">✅ No new flags detected. All accounts are in good standing.</div>';
    return;
  }
  
  container.innerHTML = results.map(result => `
    <div class="detection-item new-flag">
      🚩 ${result.accountName} - ${result.flagType} (${result.severity})
    </div>
  `).join('');
}

// Close detection modal
window.closeDetectionModal = function() {
  document.getElementById('detectionModal').classList.remove('active');
  // Reload to show any new flags
  loadFlaggedAccounts();
}

// Detection Functions

// Detect low contributions
async function detectLowContributions() {
  const flags = [];
  const driversRef = ref(db, 'drivers');
  const contributionsRef = ref(db, 'contributions');
  const driverFlagsRef = ref(db, 'driverFlags');
  
  const driversSnapshot = await get(driversRef);
  const contributionsSnapshot = await get(contributionsRef);
  const driverFlagsSnapshot = await get(driverFlagsRef);
  
  if (!driversSnapshot.exists() || !contributionsSnapshot.exists()) return flags;
  
  const drivers = driversSnapshot.val();
  const contributions = contributionsSnapshot.val();
  const existingFlags = driverFlagsSnapshot.exists() ? driverFlagsSnapshot.val() : {};
  
  // Calculate average weekly contribution
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const weeklyContributions = {};
  let totalWeeklyContribution = 0;
  let activeDriverCount = 0;
  
  Object.keys(contributions).forEach(contribId => {
    const contrib = contributions[contribId];
    const timestamp = parseInt(contrib.timestamp) * 1000;
    
    if (timestamp > oneWeekAgo) {
      const driverId = contrib.driverId;
      if (!weeklyContributions[driverId]) {
        weeklyContributions[driverId] = 0;
        activeDriverCount++;
      }
      weeklyContributions[driverId] += parseFloat(contrib.amount) || 0;
      totalWeeklyContribution += parseFloat(contrib.amount) || 0;
    }
  });
  
  const averageWeeklyContribution = activeDriverCount > 0 ? totalWeeklyContribution / activeDriverCount : 0;
  const threshold = averageWeeklyContribution * 0.5; // 50% of average
  
  // Check each driver
  Object.keys(drivers).forEach(driverId => {
    const driver = drivers[driverId];
    const driverContribution = weeklyContributions[driverId] || 0;
    
    if (driver.isActive && driverContribution < threshold && averageWeeklyContribution > 0) {
      // Check if flag already exists in separate collection
      const driverFlags = existingFlags[driverId] || {};
      const hasLowContributionFlag = Object.values(driverFlags).some(f => f.type === 'LOW_CONTRIBUTIONS' && f.status === 'active');
      
      if (!hasLowContributionFlag) {
        flags.push(createFlag(driverId, driver, 'LOW_CONTRIBUTIONS', {
          averageContribution: averageWeeklyContribution.toFixed(2),
          driverContribution: driverContribution.toFixed(2),
          percentage: ((driverContribution / averageWeeklyContribution) * 100).toFixed(0),
          period: 'weekly'
        }));
      }
    }
  });
  
  return flags;
}

// Detect inactive accounts
async function detectInactiveAccounts() {
  const flags = [];
  const driversRef = ref(db, 'drivers');
  const driverFlagsRef = ref(db, 'driverFlags');
  
  const driversSnapshot = await get(driversRef);
  const driverFlagsSnapshot = await get(driverFlagsRef);
  
  if (!driversSnapshot.exists()) return flags;
  
  const drivers = driversSnapshot.val();
  const existingFlags = driverFlagsSnapshot.exists() ? driverFlagsSnapshot.val() : {};
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  Object.keys(drivers).forEach(driverId => {
    const driver = drivers[driverId];
    const lastActive = driver.lastLoginTimestamp || driver.createdAt || 0;
    
    if (lastActive < sevenDaysAgo && driver.isActive) {
      // Check if flag already exists in separate collection
      const driverFlags = existingFlags[driverId] || {};
      const hasInactiveFlag = Object.values(driverFlags).some(f => f.type === 'INACTIVE_ACCOUNT' && f.status === 'active');
      
      if (!hasInactiveFlag) {
        const daysSinceActive = Math.floor((Date.now() - lastActive) / (24 * 60 * 60 * 1000));
        flags.push(createFlag(driverId, driver, 'INACTIVE_ACCOUNT', {
          lastActiveDate: new Date(lastActive).toLocaleDateString(),
          daysSinceActive: daysSinceActive
        }));
      }
    }
  });
  
  return flags;
}

// Detect no-shows
async function detectNoShows() {
  const flags = [];
  const usersRef = ref(db, 'users');
  const bookingsRef = ref(db, 'bookings');
  const userFlagsRef = ref(db, 'userFlags');
  
  const usersSnapshot = await get(usersRef);
  const bookingsSnapshot = await get(bookingsRef);
  const userFlagsSnapshot = await get(userFlagsRef);
  
  if (!usersSnapshot.exists() || !bookingsSnapshot.exists()) return flags;
  
  const users = usersSnapshot.val();
  const bookings = bookingsSnapshot.val();
  const existingFlags = userFlagsSnapshot.exists() ? userFlagsSnapshot.val() : {};
  
  // Count no-shows per customer
  const customerBookings = {};
  
  Object.keys(bookings).forEach(bookingId => {
    const booking = bookings[bookingId];
    const customerId = booking.customerId;
    
    if (!customerBookings[customerId]) {
      customerBookings[customerId] = { total: 0, noShows: 0 };
    }
    
    customerBookings[customerId].total++;
    
    if (booking.status === 'no-show' || booking.customerNoShow === true) {
      customerBookings[customerId].noShows++;
    }
  });
  
  // Check each customer
  Object.keys(users).forEach(userId => {
    const user = users[userId];
    if (user.userType === 'PASSENGER') {
      const bookingData = customerBookings[userId];
      
      if (bookingData && bookingData.total >= 5) {
        const noShowRate = (bookingData.noShows / bookingData.total) * 100;
        
        if (noShowRate > 20) {
          // Check if flag already exists in separate collection
          const userFlags = existingFlags[userId] || {};
          const hasNoShowFlag = Object.values(userFlags).some(f => f.type === 'NO_SHOW' && f.status === 'active');
          
          if (!hasNoShowFlag) {
            flags.push(createFlag(userId, user, 'NO_SHOW', {
              totalBookings: bookingData.total,
              noShowCount: bookingData.noShows,
              noShowRate: noShowRate.toFixed(1) + '%'
            }));
          }
        }
      }
    }
  });
  
  return flags;
}

// Detect high cancellations
async function detectHighCancellations() {
  const flags = [];
  const driversRef = ref(db, 'drivers');
  const bookingsRef = ref(db, 'bookings');
  const driverFlagsRef = ref(db, 'driverFlags');
  
  const driversSnapshot = await get(driversRef);
  const bookingsSnapshot = await get(bookingsRef);
  const driverFlagsSnapshot = await get(driverFlagsRef);
  
  if (!driversSnapshot.exists() || !bookingsSnapshot.exists()) return flags;
  
  const drivers = driversSnapshot.val();
  const bookings = bookingsSnapshot.val();
  const existingFlags = driverFlagsSnapshot.exists() ? driverFlagsSnapshot.val() : {};
  
  // Count cancellations per driver
  const driverBookings = {};
  
  Object.keys(bookings).forEach(bookingId => {
    const booking = bookings[bookingId];
    const driverId = booking.driverId;
    
    if (driverId) {
      if (!driverBookings[driverId]) {
        driverBookings[driverId] = { total: 0, cancelled: 0 };
      }
      
      driverBookings[driverId].total++;
      
      if (booking.status === 'cancelled' && booking.cancelledBy === 'driver') {
        driverBookings[driverId].cancelled++;
      }
    }
  });
  
  // Check each driver
  Object.keys(drivers).forEach(driverId => {
    const driver = drivers[driverId];
    const bookingData = driverBookings[driverId];
    
    if (bookingData && bookingData.total >= 10) {
      const cancellationRate = (bookingData.cancelled / bookingData.total) * 100;
      
      if (cancellationRate > 15) {
        // Check if flag already exists in separate collection
        const driverFlags = existingFlags[driverId] || {};
        const hasCancellationFlag = Object.values(driverFlags).some(f => f.type === 'HIGH_CANCELLATION_RATE' && f.status === 'active');
        
        if (!hasCancellationFlag) {
          flags.push(createFlag(driverId, driver, 'HIGH_CANCELLATION_RATE', {
            totalBookings: bookingData.total,
            cancelledCount: bookingData.cancelled,
            cancellationRate: cancellationRate.toFixed(1) + '%'
          }));
        }
      }
    }
  });
  
  return flags;
}

// Detect excessive cancellations (customers)
async function detectExcessiveCancellations() {
  const flags = [];
  const usersRef = ref(db, 'users');
  const bookingsRef = ref(db, 'bookings');
  const userFlagsRef = ref(db, 'userFlags');
  
  const usersSnapshot = await get(usersRef);
  const bookingsSnapshot = await get(bookingsRef);
  const userFlagsSnapshot = await get(userFlagsRef);
  
  if (!usersSnapshot.exists() || !bookingsSnapshot.exists()) return flags;
  
  const users = usersSnapshot.val();
  const bookings = bookingsSnapshot.val();
  const existingFlags = userFlagsSnapshot.exists() ? userFlagsSnapshot.val() : {};
  
  // Count cancellations per customer
  const customerBookings = {};
  
  Object.keys(bookings).forEach(bookingId => {
    const booking = bookings[bookingId];
    const customerId = booking.customerId;
    
    if (customerId) {
      if (!customerBookings[customerId]) {
        customerBookings[customerId] = { total: 0, cancelled: 0 };
      }
      
      customerBookings[customerId].total++;
      
      if (booking.status === 'cancelled' && booking.cancelledBy === 'customer') {
        customerBookings[customerId].cancelled++;
      }
    }
  });
  
  // Check each customer
  Object.keys(users).forEach(userId => {
    const user = users[userId];
    if (user.userType === 'PASSENGER') {
      const bookingData = customerBookings[userId];
      
      if (bookingData && bookingData.total >= 10) {
        const cancellationRate = (bookingData.cancelled / bookingData.total) * 100;
        
        if (cancellationRate > 25) {
          // Check if flag already exists
          const userFlags = existingFlags[userId] || {};
          const hasCancellationFlag = Object.values(userFlags).some(f => f.type === 'EXCESSIVE_CANCELLATIONS' && f.status === 'active');
          
          if (!hasCancellationFlag) {
            flags.push(createFlag(userId, user, 'EXCESSIVE_CANCELLATIONS', {
              totalBookings: bookingData.total,
              cancelledCount: bookingData.cancelled,
              cancellationRate: cancellationRate.toFixed(1) + '%'
            }));
          }
        }
      }
    }
  });
  
  return flags;
}

// Detect non-payment
async function detectNonPayment() {
  const flags = [];
  const usersRef = ref(db, 'users');
  const bookingsRef = ref(db, 'bookings');
  const userFlagsRef = ref(db, 'userFlags');
  
  const usersSnapshot = await get(usersRef);
  const bookingsSnapshot = await get(bookingsRef);
  const userFlagsSnapshot = await get(userFlagsRef);
  
  if (!usersSnapshot.exists() || !bookingsSnapshot.exists()) return flags;
  
  const users = usersSnapshot.val();
  const bookings = bookingsSnapshot.val();
  const existingFlags = userFlagsSnapshot.exists() ? userFlagsSnapshot.val() : {};
  
  // Count non-payment instances per customer
  const customerNonPayments = {};
  
  Object.keys(bookings).forEach(bookingId => {
    const booking = bookings[bookingId];
    const customerId = booking.customerId;
    
    if (customerId && (booking.nonPayment === true || booking.paymentStatus === 'unpaid')) {
      if (!customerNonPayments[customerId]) {
        customerNonPayments[customerId] = { count: 0, bookingIds: [] };
      }
      customerNonPayments[customerId].count++;
      customerNonPayments[customerId].bookingIds.push(bookingId);
    }
  });
  
  // Check each customer with non-payment issues
  Object.keys(customerNonPayments).forEach(userId => {
    const user = users[userId];
    if (user && user.userType === 'PASSENGER') {
      const nonPaymentData = customerNonPayments[userId];
      
      if (nonPaymentData.count >= 1) { // Flag if at least 1 non-payment
        // Check if flag already exists
        const userFlags = existingFlags[userId] || {};
        const hasNonPaymentFlag = Object.values(userFlags).some(f => f.type === 'NON_PAYMENT' && f.status === 'active');
        
        if (!hasNonPaymentFlag) {
          flags.push(createFlag(userId, user, 'NON_PAYMENT', {
            nonPaymentCount: nonPaymentData.count,
            affectedBookings: nonPaymentData.bookingIds.length
          }));
        }
      }
    }
  });
  
  return flags;
}

// Detect wrong PIN
async function detectWrongPin() {
  const flags = [];
  const usersRef = ref(db, 'users');
  const bookingsRef = ref(db, 'bookings');
  const userFlagsRef = ref(db, 'userFlags');
  
  const usersSnapshot = await get(usersRef);
  const bookingsSnapshot = await get(bookingsRef);
  const userFlagsSnapshot = await get(userFlagsRef);
  
  if (!usersSnapshot.exists() || !bookingsSnapshot.exists()) return flags;
  
  const users = usersSnapshot.val();
  const bookings = bookingsSnapshot.val();
  const existingFlags = userFlagsSnapshot.exists() ? userFlagsSnapshot.val() : {};
  
  // Count wrong PIN incidents per customer
  const customerWrongPins = {};
  
  Object.keys(bookings).forEach(bookingId => {
    const booking = bookings[bookingId];
    const customerId = booking.customerId;
    
    if (customerId) {
      if (!customerWrongPins[customerId]) {
        customerWrongPins[customerId] = { total: 0, wrongPins: 0 };
      }
      
      customerWrongPins[customerId].total++;
      
      if (booking.wrongPin === true || booking.incorrectLocation === true) {
        customerWrongPins[customerId].wrongPins++;
      }
    }
  });
  
  // Check each customer
  Object.keys(users).forEach(userId => {
    const user = users[userId];
    if (user.userType === 'PASSENGER') {
      const pinData = customerWrongPins[userId];
      
      if (pinData && pinData.total >= 5) {
        const wrongPinRate = (pinData.wrongPins / pinData.total) * 100;
        
        if (wrongPinRate > 30) { // Flag if more than 30% wrong PINs
          // Check if flag already exists
          const userFlags = existingFlags[userId] || {};
          const hasWrongPinFlag = Object.values(userFlags).some(f => f.type === 'WRONG_PIN' && f.status === 'active');
          
          if (!hasWrongPinFlag) {
            flags.push(createFlag(userId, user, 'WRONG_PIN', {
              totalBookings: pinData.total,
              wrongPinCount: pinData.wrongPins,
              wrongPinRate: wrongPinRate.toFixed(1) + '%'
            }));
          }
        }
      }
    }
  });
  
  return flags;
}

// Detect abusive behavior
async function detectAbusiveBehavior() {
  const flags = [];
  const usersRef = ref(db, 'users');
  const bookingsRef = ref(db, 'bookings');
  const userFlagsRef = ref(db, 'userFlags');
  
  const usersSnapshot = await get(usersRef);
  const bookingsSnapshot = await get(bookingsRef);
  const userFlagsSnapshot = await get(userFlagsRef);
  
  if (!usersSnapshot.exists() || !bookingsSnapshot.exists()) return flags;
  
  const users = usersSnapshot.val();
  const bookings = bookingsSnapshot.val();
  const existingFlags = userFlagsSnapshot.exists() ? userFlagsSnapshot.val() : {};
  
  // Count abuse reports per customer
  const customerAbuseReports = {};
  
  Object.keys(bookings).forEach(bookingId => {
    const booking = bookings[bookingId];
    const customerId = booking.customerId;
    
    if (customerId && (booking.abusiveCustomer === true || booking.customerAbuse === true || booking.driverReportedAbuse === true)) {
      if (!customerAbuseReports[customerId]) {
        customerAbuseReports[customerId] = { count: 0, bookingIds: [] };
      }
      customerAbuseReports[customerId].count++;
      customerAbuseReports[customerId].bookingIds.push(bookingId);
    }
  });
  
  // Check each customer with abuse reports
  Object.keys(customerAbuseReports).forEach(userId => {
    const user = users[userId];
    if (user && user.userType === 'PASSENGER') {
      const abuseData = customerAbuseReports[userId];
      
      if (abuseData.count >= 1) { // Flag if at least 1 abuse report
        // Check if flag already exists
        const userFlags = existingFlags[userId] || {};
        const hasAbusiveFlag = Object.values(userFlags).some(f => f.type === 'ABUSIVE_BEHAVIOR' && f.status === 'active');
        
        if (!hasAbusiveFlag) {
          flags.push(createFlag(userId, user, 'ABUSIVE_BEHAVIOR', {
            abuseReportCount: abuseData.count,
            affectedBookings: abuseData.bookingIds.length
          }));
        }
      }
    }
  });
  
  return flags;
}

// Create flag
function createFlag(accountId, accountData, flagType, details) {
  const flagConfig = FLAG_TYPES[flagType];
  const flagId = push(ref(db, 'temp')).key;
  
  const flag = {
    flagId: flagId,
    type: flagType,
    severity: flagConfig.severity,
    points: flagConfig.points,
    timestamp: Date.now(),
    status: 'active',
    details: details,
    actions: [
      {
        action: 'FLAG_CREATED',
        timestamp: Date.now(),
        adminId: 'AUTO_DETECTION'
      }
    ],
    notes: `Automatically detected by system on ${new Date().toLocaleDateString()}`
  };
  
  // Save to separate flag collection
  const accountPath = flagConfig.category === 'driver' ? 'drivers' : 'users';
  const flagCollectionPath = flagConfig.category === 'driver' ? 'driverFlags' : 'userFlags';
  const flagRef = ref(db, `${flagCollectionPath}/${accountId}/${flagId}`);
  set(flagRef, flag);
  
  // Update account flag score
  const currentScore = accountData.flagScore || 0;
  const newScore = currentScore + flagConfig.points;
  const accountRef = ref(db, `${accountPath}/${accountId}`);
  
  update(accountRef, {
    flagScore: newScore,
    flagStatus: newScore > 300 ? 'suspended' : newScore > 150 ? 'restricted' : newScore > 50 ? 'monitored' : 'good'
  });
  
  return {
    accountName: accountData.fullName || accountData.driverName || accountData.name || 'Unknown',
    flagType: flagConfig.name,
    severity: flagConfig.severity
  };
}

// Helper functions
function getSeverityByScore(score) {
  if (score >= 100) return 'critical';
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function formatKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

function formatValue(value) {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return value;
}

// Initialize
loadFlaggedAccounts();
