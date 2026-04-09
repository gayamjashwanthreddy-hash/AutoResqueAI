'use strict';

/* ─────────────────────────────────────────────────────────
   APP STATE
   Single source of truth — all screens read from here.
───────────────────────────────────────────────────────── */
var userData = {
  name:              '',    // full name from step 1
  phone:             '',    // phone from step 1
  contacts:          [],    // array of strings from step 2
  bloodGroup:        '',    // select value from step 3
  medicalConditions: [],    // array of condition strings, e.g. ['asthma','diabetes']
  medications:       '',    // textarea from step 3
  allergies:         ''     // text input from step 3
};

var selectedEmergencyType = null;   // 'accident' | 'medical' | 'fire' | 'safety'
var countdownTimer        = null;
var countdownVal          = 10;
var CIRCUMFERENCE         = 213.6;  // 2 * PI * 34 (SVG circle r=34)
var alertCancelled        = false;
var DEMO_OTP              = '1234'; // fixed demo OTP

/* ─────────────────────────────────────────────────────────
   SCREEN IDs
───────────────────────────────────────────────────────── */
var ALL_SCREENS = [
  'launchScreen',
  'loginScreen',
  'selectionScreen',
  'detectionScreen',
  'placeholderScreen',
  'dashboardScreen'
];

/* ─────────────────────────────────────────────────────────
   showScreen(id)
   Hides every screen then shows only the one with the given id.
───────────────────────────────────────────────────────── */
function showScreen(id) {
  ALL_SCREENS.forEach(function (screenId) {
    var el = document.getElementById(screenId);
    if (el) el.style.display = 'none';
  });

  var target = document.getElementById(id);
  if (!target) {
    console.warn('showScreen: unknown screen id "' + id + '"');
    return;
  }

  // All screens use flex layout
  target.style.display = 'flex';

  // Scroll to top on every transition
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─────────────────────────────────────────────────────────
   LAUNCH SCREEN — auto-transition after 2.5 seconds
───────────────────────────────────────────────────────── */
function initApp() {
  setTimeout(function () {
    showScreen('loginScreen');
  }, 2500);
}

/* ─────────────────────────────────────────────────────────
   LOGIN — STEP NAVIGATION
───────────────────────────────────────────────────────── */
function goToStep(stepNumber) {
  // Hide all three login step panels
  document.getElementById('loginStep1').style.display = 'none';
  document.getElementById('loginStep2').style.display = 'none';
  document.getElementById('loginStep3').style.display = 'none';

  // Show the requested step
  document.getElementById('loginStep' + stepNumber).style.display = 'block';

  // Update progress dots: done = green, active = red pill, future = gray
  for (var i = 1; i <= 3; i++) {
    var dot = document.getElementById('lstep' + i);
    dot.className = 'lstep';
    if (i < stepNumber)   dot.classList.add('done');
    if (i === stepNumber) dot.classList.add('active');
  }
}

/* ─────────────────────────────────────────────────────────
   STEP 1 — OTP FLOW
───────────────────────────────────────────────────────── */
function sendOTP() {
  var nameEl  = document.getElementById('inputName');
  var phoneEl = document.getElementById('inputPhone');
  var name    = nameEl.value.trim();
  var phone   = phoneEl.value.trim();

  // Validate name
  if (!name) {
    nameEl.classList.add('input-error');
    nameEl.focus();
    return;
  }
  nameEl.classList.remove('input-error');

  // Validate phone
  if (!phone) {
    phoneEl.classList.add('input-error');
    phoneEl.focus();
    return;
  }
  phoneEl.classList.remove('input-error');

  // Show OTP entry section
  document.getElementById('otpSection').style.display = 'block';

  var msgEl = document.getElementById('otpSentMsg');
  msgEl.style.display    = 'block';
  msgEl.style.background = '#EAF3DE';
  msgEl.style.color      = '#3B6D11';
  msgEl.textContent      = '✅ OTP sent to ' + phone + '  (Demo: use 1234)';

  // Disable send button so it can't be clicked twice
  var sendBtn = document.getElementById('sendOtpBtn');
  sendBtn.disabled    = true;
  sendBtn.textContent = 'Sent ✓';

  // Auto-focus first OTP box
  document.getElementById('otp1').focus();
}

/** Auto-advance cursor to next OTP box */
function otpMove(current, nextId) {
  if (current.value.length >= 1 && nextId) {
    document.getElementById(nextId).focus();
  }
}

/** Allow backspace to move to previous OTP box */
function otpBack(e, current, prevId) {
  if (e.key === 'Backspace' && current.value === '' && prevId) {
    document.getElementById(prevId).focus();
  }
}

function verifyOTP() {
  var name = document.getElementById('inputName').value.trim();

  // If OTP section isn't shown yet, trigger sendOTP first
  if (document.getElementById('otpSection').style.display === 'none' || !name) {
    sendOTP();
    return;
  }

  var entered = document.getElementById('otp1').value
              + document.getElementById('otp2').value
              + document.getElementById('otp3').value
              + document.getElementById('otp4').value;

  if (entered !== DEMO_OTP) {
    var msgEl = document.getElementById('otpSentMsg');
    msgEl.style.display    = 'block';
    msgEl.style.background = 'var(--red-light)';
    msgEl.style.color      = 'var(--red-dark)';
    msgEl.textContent      = '❌ Incorrect OTP. Demo OTP is 1234.';
    // Clear boxes and re-focus
    ['otp1', 'otp2', 'otp3', 'otp4'].forEach(function (id) {
      document.getElementById(id).value = '';
    });
    document.getElementById('otp1').focus();
    return;
  }

  // OTP correct — save identity data and advance
  userData.name  = name;
  userData.phone = document.getElementById('inputPhone').value.trim();
  goToStep(2);
}

/* ─────────────────────────────────────────────────────────
   STEP 2 — EMERGENCY CONTACTS
───────────────────────────────────────────────────────── */
function addContact() {
  var list = document.getElementById('contactsList');
  var row  = document.createElement('div');
  row.className = 'contact-row';
  row.innerHTML =
    '<input type="text" placeholder="Name &amp; Number" />' +
    '<button class="remove-btn" onclick="removeContact(this)" title="Remove">&#x2715;</button>';
  list.appendChild(row);
}

function removeContact(btn) {
  var list = document.getElementById('contactsList');
  // Always keep at least one row
  if (list.children.length <= 1) return;
  btn.parentElement.remove();
}

function goToMedical() {
  // Collect all non-empty contact inputs
  var inputs = document.querySelectorAll('#contactsList .contact-row input[type="text"]');
  userData.contacts = [];
  inputs.forEach(function (inp) {
    var val = inp.value.trim();
    if (val) userData.contacts.push(val);
  });
  goToStep(3);
}

/* ─────────────────────────────────────────────────────────
   STEP 3 — MEDICAL CONDITIONS
   Uses .selected CSS class on chips — no hidden checkboxes.
───────────────────────────────────────────────────────── */

/** Wire up chip click listeners after DOM is ready */
document.addEventListener('DOMContentLoaded', function () {
  var chips = document.querySelectorAll('#conditionChips .cond-chip');

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var condition = chip.getAttribute('data-condition');

      if (condition === 'none') {
        // "None" deselects all others
        chips.forEach(function (c) { c.classList.remove('selected'); });
        chip.classList.add('selected');
      } else {
        // Deselect "None" if another condition is picked
        var noneChip = document.querySelector('#conditionChips .cond-chip[data-condition="none"]');
        if (noneChip) noneChip.classList.remove('selected');
        chip.classList.toggle('selected');
      }

      updateConditionFeedback();
    });
  });
});

/** Show selected conditions as live feedback below the chips */
function updateConditionFeedback() {
  var selected   = getSelectedConditions();
  var feedbackEl = document.getElementById('conditionsFeedback');

  if (selected.length === 0) {
    feedbackEl.style.display = 'none';
    return;
  }

  var labels = {
    diabetes:     'Diabetes',
    asthma:       'Asthma',
    heart:        'Heart Condition',
    epilepsy:     'Epilepsy',
    hypertension: 'Hypertension',
    none:         'None'
  };

  var names = selected.map(function (c) { return labels[c] || c; });
  feedbackEl.style.display = 'block';
  feedbackEl.textContent   = '✓ Selected: ' + names.join(', ');
}

/** Read selected conditions from DOM (.selected class) */
function getSelectedConditions() {
  var result = [];
  document.querySelectorAll('#conditionChips .cond-chip.selected').forEach(function (chip) {
    result.push(chip.getAttribute('data-condition'));
  });
  return result;
}

function completeLogin() {
  // Read all medical fields
  userData.bloodGroup        = document.getElementById('inputBloodGroup').value;
  userData.medicalConditions = getSelectedConditions();
  userData.medications       = document.getElementById('inputMeds').value.trim();
  userData.allergies         = document.getElementById('inputAllergies').value.trim();

  // Persist to localStorage
  try {
    localStorage.setItem('autorescue_userData', JSON.stringify(userData));
  } catch (e) { /* localStorage unavailable — silently skip */ }

  // Update header user chip
  var chip   = document.getElementById('headerUserChip');
  var avatar = document.getElementById('headerAvatar');
  var hname  = document.getElementById('headerName');
  chip.style.display = 'flex';
  avatar.textContent = userData.name.charAt(0).toUpperCase();
  hname.textContent  = userData.name.split(' ')[0];
  document.getElementById('headerBadge').style.display = 'none';

  // Navigate to emergency selection
  showScreen('selectionScreen');
  populateSelectionGreeting();
}

/* ─────────────────────────────────────────────────────────
   SELECTION SCREEN — personalized greeting
───────────────────────────────────────────────────────── */
function populateSelectionGreeting() {
  var el = document.getElementById('selGreeting');
  if (!el || !userData.name) return;

  var condMsg = '';
  if (userData.medicalConditions.length > 0 && userData.medicalConditions[0] !== 'none') {
    var condLabels = {
      diabetes: 'Diabetes', asthma: 'Asthma', heart: 'Heart Condition',
      epilepsy: 'Epilepsy', hypertension: 'Hypertension'
    };
    var names = userData.medicalConditions
      .filter(function (c) { return c !== 'none'; })
      .map(function (c) { return condLabels[c] || c; });
    if (names.length) {
      condMsg = ' Your medical profile (' + names.join(', ') + ') is saved and will personalize AI guidance.';
    }
  }

  el.textContent = 'Welcome, ' + userData.name + '. Your profile is ready.' + condMsg
    + ' Select the type of emergency below to activate the appropriate AI response.';
}

/* ─────────────────────────────────────────────────────────
   EMERGENCY TYPE SELECTION
───────────────────────────────────────────────────────── */
function selectEmergencyType(btn, type) {
  selectedEmergencyType = type;

  if (type === 'accident') {
    showScreen('detectionScreen');
    playAlertSound();
    speakText('Severe accident detected. Analyzing situation. Please remain calm.');

    setTimeout(function () {
      buildDashboard();
      showScreen('dashboardScreen');
      document.getElementById('voiceBar').style.display = 'flex';
      setTimeout(animateBars, 600);
      startCountdown();
      speakGuidance();
    }, 2200);

  } else {
    // Non-accident: show placeholder screen with relevant content
    var meta = {
      medical: {
        icon:  '🛑',
        title: 'Medical Emergency Response',
        body:  'Emergency medical services are being notified. AI is preparing a medical response protocol based on your health profile. Stay on the line — paramedics are being dispatched.'
      },
      fire: {
        icon:  '🔥',
        title: 'Fire Emergency Response',
        body:  'Fire brigade and emergency services are being alerted. Evacuate the area immediately. Do not use lifts. Gather at the nearest assembly point.'
      },
      safety: {
        icon:  '🛡️',
        title: 'Personal Safety Alert Activated',
        body:  'Your location is being shared with trusted contacts and local law enforcement. Stay in a public area if possible. Help is on the way.'
      }
    };

    var m = meta[type] || meta['medical'];
    document.getElementById('phIcon').textContent  = m.icon;
    document.getElementById('phTitle').textContent = m.title;
    document.getElementById('phBody').textContent  = m.body;

    showScreen('placeholderScreen');
    playAlertSound();
    speakText(m.title + '. ' + m.body);
  }
}

/* ─────────────────────────────────────────────────────────
   DASHBOARD — BUILD ALL DYNAMIC CONTENT
───────────────────────────────────────────────────────── */
function buildDashboard() {
  document.getElementById('dashUserName').textContent = userData.name || 'User';

  buildContactsList();
  buildGuidanceSteps();
  buildPersonalizedTips();
  buildMedProfileChips();

  // Reset countdown UI state
  document.getElementById('cancelBtn').style.display    = 'block';
  document.getElementById('cancelledMsg').style.display = 'none';
  document.getElementById('countdownNum').textContent   = '10';
  var ring = document.getElementById('ringFg');
  ring.style.stroke           = 'var(--red)';
  ring.style.strokeDashoffset = '0';
}

/** Populate contacts list from userData.contacts */
function buildContactsList() {
  var el       = document.getElementById('dashContactsList');
  var contacts = userData.contacts.length ? userData.contacts : ['Father — +91 99999 00000'];
  el.innerHTML = '';
  contacts.forEach(function (c) {
    el.innerHTML +=
      '<div class="status-row">' +
        '<div class="dot green"></div>' +
        '<div class="label">' + escHtml(c) + '</div>' +
        '<span class="tag sent">Alert Sent</span>' +
      '</div>';
  });
}

/**
 * buildGuidanceSteps()
 * Base steps are always shown. Condition-specific steps are inserted
 * right after step 1 with a purple badge to mark them as personalized.
 */
function buildGuidanceSteps() {
  var conditions = userData.medicalConditions.filter(function (c) { return c !== 'none'; });

  var baseSteps = [
    'Check if the person is breathing. Do not move them if spinal injury is suspected.',
    'Do not move the injured person unless there is immediate danger of fire or flooding.',
    'Call emergency services — they have already been automatically notified.',
    'Keep the person warm and conscious. Talk to them calmly.',
    'Ambulance is 4 minutes away. Hazard lights have been activated automatically.'
  ];

  var personalSteps = [];
  if (conditions.indexOf('asthma')       >= 0) personalSteps.push('💨 Patient has asthma — ensure access to inhaler. Keep airways clear and away from smoke.');
  if (conditions.indexOf('diabetes')     >= 0) personalSteps.push('🩸 Patient has diabetes — check blood sugar levels. Watch for trembling, confusion or sweating.');
  if (conditions.indexOf('heart')        >= 0) personalSteps.push('❤️ Patient has a heart condition — monitor pulse. Do not administer aspirin without paramedic confirmation.');
  if (conditions.indexOf('epilepsy')     >= 0) personalSteps.push('⚡ Patient has epilepsy — if seizure occurs, protect the head. Do not restrain. Time the seizure.');
  if (conditions.indexOf('hypertension') >= 0) personalSteps.push('📈 Patient has hypertension — keep them calm and still. Avoid any strenuous movement.');

  var el = document.getElementById('guidanceSteps');
  el.innerHTML = '';
  var stepNum = 1;

  // Step 1 always first
  el.innerHTML += makeStep(stepNum++, baseSteps[0], false);

  // Personalized steps inserted right after step 1
  personalSteps.forEach(function (text) {
    el.innerHTML += makeStep(stepNum++, text, true);
  });

  // Remaining base steps
  for (var i = 1; i < baseSteps.length; i++) {
    el.innerHTML += makeStep(stepNum++, baseSteps[i], false);
  }
}

/** Build a single <li> step row */
function makeStep(num, text, isPersonal) {
  var numClass = isPersonal ? 'step-num personal' : 'step-num';
  return '<li class="step-item">'
    + '<div class="' + numClass + '">' + num + '</div>'
    + '<span>' + text + '</span>'
    + '</li>';
}

/** Build personalized medical tips in the dedicated card */
function buildPersonalizedTips() {
  var el         = document.getElementById('personalizedTips');
  var conditions = userData.medicalConditions.filter(function (c) { return c !== 'none'; });

  var tipMap = {
    asthma:       { icon: '💨', text: 'Patient has asthma — ensure immediate access to inhaler. Keep airways clear. Avoid smoke, dust and strong odours.' },
    diabetes:     { icon: '🩸', text: 'Patient has diabetes — check blood sugar levels. Watch for hypoglycemia signs: trembling, confusion, sweating, pale skin.' },
    heart:        { icon: '❤️', text: 'Patient has a heart condition — do NOT administer aspirin without confirmation. Monitor pulse rate continuously.' },
    epilepsy:     { icon: '⚡', text: 'Patient has epilepsy — if seizure occurs: protect head, do not restrain, time the seizure, and notify paramedics immediately.' },
    hypertension: { icon: '📈', text: 'Patient has hypertension — keep them calm and still. Avoid strenuous movement. Monitor breathing and consciousness.' }
  };

  el.innerHTML = '';
  var hasConditions = false;

  conditions.forEach(function (c) {
    if (tipMap[c]) {
      hasConditions = true;
      el.innerHTML +=
        '<div class="ai-tip">' +
          '<span class="ai-tip-icon">' + tipMap[c].icon + '</span>' +
          '<span>' + tipMap[c].text + '</span>' +
        '</div>';
    }
  });

  if (!hasConditions) {
    el.innerHTML =
      '<div class="ai-tip">' +
        '<span class="ai-tip-icon">🩺</span>' +
        '<span>No specific medical conditions on file. Standard emergency protocol is being followed.</span>' +
      '</div>';
  }
}

/** Build medical profile pills at bottom of personalized card */
function buildMedProfileChips() {
  var el         = document.getElementById('dashMedProfile');
  var conditions = userData.medicalConditions.filter(function (c) { return c !== 'none'; });
  el.innerHTML   = '';

  if (userData.bloodGroup) {
    el.innerHTML +=
      '<span style="background:#E6F1FB;color:#185FA5;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;">' +
        '🩸 ' + escHtml(userData.bloodGroup) +
      '</span>';
  }

  conditions.forEach(function (c) {
    el.innerHTML +=
      '<span style="background:var(--red-light);color:var(--red-dark);border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;">' +
        capFirst(c) +
      '</span>';
  });

  if (userData.allergies) {
    el.innerHTML +=
      '<span style="background:#FAEEDA;color:#854F0B;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;">' +
        '⚠️ Allergy: ' + escHtml(userData.allergies) +
      '</span>';
  }

  if (!userData.bloodGroup && !conditions.length && !userData.allergies) {
    el.innerHTML = '<span style="font-size:13px;color:var(--gray-text);">No medical profile on file.</span>';
  }
}

/* ─────────────────────────────────────────────────────────
   ALERT SOUND  (Web Audio API — no external files needed)
───────────────────────────────────────────────────────── */
function playAlertSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();

    function beep(freq, start, dur) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type            = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    }

    beep(880,  0.0, 0.25);
    beep(660,  0.3, 0.25);
    beep(880,  0.6, 0.25);
    beep(660,  0.9, 0.25);
    beep(1100, 1.2, 0.40);
  } catch (e) { /* AudioContext not available — silently skip */ }
}

/* ─────────────────────────────────────────────────────────
   VOICE GUIDANCE  (speechSynthesis API)
───────────────────────────────────────────────────────── */
function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  var utt   = new SpeechSynthesisUtterance(text);
  utt.rate  = 0.92;
  utt.pitch = 1.05;
  utt.volume = 1;
  window.speechSynthesis.speak(utt);
}

/** Auto-plays on dashboard load — includes personalized medical notes */
function speakGuidance() {
  var conditions = userData.medicalConditions.filter(function (c) { return c !== 'none'; });
  var medNote = '';
  if (conditions.indexOf('asthma')       >= 0) medNote += ' Ensure access to inhaler.';
  if (conditions.indexOf('diabetes')     >= 0) medNote += ' Check blood sugar levels.';
  if (conditions.indexOf('heart')        >= 0) medNote += ' Monitor heart rate closely.';
  if (conditions.indexOf('epilepsy')     >= 0) medNote += ' Be prepared for possible seizure.';
  if (conditions.indexOf('hypertension') >= 0) medNote += ' Keep patient calm and still.';

  speakText(
    'Accident detected. Stay calm.' +
    ' Check breathing. Do not move the injured person.' +
    ' Emergency services have been notified.' +
    medNote +
    ' Ambulance is on its way. Your family has been contacted.'
  );
}

/** Triggered by "Play Voice Instructions" button — reads all steps aloud */
function playVoiceInstructions(btn) {
  var steps = document.querySelectorAll('#guidanceSteps .step-item span');
  var text  = 'Emergency voice instructions. ';
  steps.forEach(function (s, i) {
    text += 'Step ' + (i + 1) + '. ' + s.textContent.trim() + ' ';
  });
  speakText(text);

  // Visual feedback
  btn.style.background = 'var(--red-mid)';
  setTimeout(function () { btn.style.background = ''; }, 1000);
}

/* ─────────────────────────────────────────────────────────
   XAI BAR ANIMATIONS
───────────────────────────────────────────────────────── */
function animateBars() {
  var c = document.getElementById('confBar');
  var i = document.getElementById('impactBar');
  var p = document.getElementById('priorityBar');
  if (c) c.style.width = '94%';
  if (i) i.style.width = '87%';
  if (p) p.style.width = '100%';
}

/* ─────────────────────────────────────────────────────────
   COUNTDOWN — 10-second safety cancel window
───────────────────────────────────────────────────────── */
function startCountdown() {
  clearInterval(countdownTimer);
  countdownVal   = 10;
  alertCancelled = false;

  var ring = document.getElementById('ringFg');
  var num  = document.getElementById('countdownNum');

  countdownTimer = setInterval(function () {
    if (alertCancelled) {
      clearInterval(countdownTimer);
      return;
    }

    countdownVal--;
    if (num) num.textContent = Math.max(0, countdownVal);

    // Shrink SVG ring proportionally
    var pct = countdownVal / 10;
    if (ring) ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);

    if (countdownVal <= 0) {
      clearInterval(countdownTimer);
      if (num) num.textContent = '0';
      speakText('Emergency services have been dispatched. Help is on the way.');
    }
  }, 1000);
}

function cancelAlert() {
  alertCancelled = true;
  clearInterval(countdownTimer);

  document.getElementById('cancelBtn').style.display    = 'none';
  document.getElementById('cancelledMsg').style.display = 'block';
  document.getElementById('countdownNum').textContent   = '✓';

  var ring = document.getElementById('ringFg');
  if (ring) {
    ring.style.stroke           = '#639922';
    ring.style.strokeDashoffset = CIRCUMFERENCE * 0.1;
  }

  document.getElementById('voiceBar').style.display = 'none';
  speakText('Alert cancelled. Emergency services have been stood down. Stay safe.');
}

/* ─────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────── */
/** Escape HTML to safely inject user data into innerHTML */
function escHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

/** Capitalize first letter of a string */
function capFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ─────────────────────────────────────────────────────────
   INIT — entry point
───────────────────────────────────────────────────────── */
initApp();
