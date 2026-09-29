(() => {
const C = window.CONFIG;
const DB = window.MsgDB;
const RAW_API = `https://raw.githubusercontent.com/${C.owner}/${C.repo}/${C.branch}/messages.json`;
const RAW_ALLOWED = `https://raw.githubusercontent.com/${C.owner}/${C.repo}/${C.branch}/allowed.json`;
const RAW_CATS = `https://raw.githubusercontent.com/${C.owner}/${C.repo}/${C.branch}/categories.json`;

// ═══════════════════════════════════════════════════════
// 👑 ادمین
// ═══════════════════════════════════════════════════════
try {
  const hash = location.hash;
  if (hash === '#admin' || hash === '#admin-panel') {
    localStorage.setItem('isAdmin', 'true');
    setTimeout(() => { try { history.replaceState(null, '', location.pathname); } catch(e){} }, 100);
  }
  if (hash === '#logout-admin') {
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('adminUnlocked');
    setTimeout(() => { try { history.replaceState(null, '', location.pathname); } catch(e){} }, 100);
  }
} catch(e) {}

const isAdmin = localStorage.getItem('isAdmin') === 'true';

// ═══════════════════════════════════════════════════════
// 🔐 چک ثبت‌نام
// ═══════════════════════════════════════════════════════
if (!isAdmin) {
  const isRegistered = localStorage.getItem('registered') === 'true';
  const hasName = !!localStorage.getItem('myName');
  const hasPhone = !!localStorage.getItem('myPhone');

  if (!isRegistered || !hasName || !hasPhone) {
    try {
      localStorage.removeItem('registered');
      localStorage.removeItem('myName');
      localStorage.removeItem('myGroups');
      localStorage.removeItem('myGroup');
      localStorage.removeItem('myPhone');
      localStorage.removeItem('myPersonalTopic');
      localStorage.removeItem('myProvince');
    } catch(e) {}
    location.href = './register.html';
    return;
  }
}

// ═══════════════════════════════════════════════════════
// 🔐 رمز ادمین
// ═══════════════════════════════════════════════════════
if (isAdmin && localStorage.getItem('adminUnlocked') !== 'true') {
  location.href = './admin-lock.html';
  return;
}

// ═══════════════════════════════════════════════════════
// 📦 state
// ═══════════════════════════════════════════════════════
const state = {
  messages: [], reactions: [], replies: [], seen: [],
  myName: localStorage.getItem('myName') || '',
  myGroups: [],
  myGroup: '',
  myPersonalTopic: localStorage.getItem('myPersonalTopic') || '',
  customCategories: [],
  filter: 'all'
};

try {
  state.myGroups = JSON.parse(localStorage.getItem('myGroups') || '[]');
  if (!state.myGroups.length) {
    const g = localStorage.getItem('myGroup');
    if (g) state.myGroups = [g];
  }
} catch(e) {
  const g = localStorage.getItem('myGroup');
  if (g) state.myGroups = [g];
}
state.myGroup = state.myGroups[0] || localStorage.getItem('myGroup') || '';

const INITIAL_COUNT = 3;
const LOAD_STEP = 7;

// ═══════════════════════════════════════════════════════
// 📦 ابزارها
// ═══════════════════════════════════════════════════════
function fmtTime(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60)    return 'الان';
  if (diff < 3600)  return Math.floor(diff / 60) + ' دقیقه پیش';
  if (diff < 86400) return Math.floor(diff / 3600) + ' ساعت پیش';
  return d.toLocaleDateString('fa-IR');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function setStatus(txt, err) {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = txt || '';
  el.className = 'status' + (err ? ' err' : '');
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID()
                           : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

// ═══════════════════════════════════════════════════════
// 💾 ذخیره محلی
// ═══════════════════════════════════════════════════════
async function saveLocal() {
  try { await DB.set('messages',  state.messages);  } catch(e) {}
  try { await DB.set('reactions', state.reactions); } catch(e) {}
  try { await DB.set('replies',   state.replies);   } catch(e) {}
  try { await DB.set('seen',      state.seen);      } catch(e) {}
}

async function loadLocal() {
  try {
    state.messages  = (await DB.get('messages'))  || [];
    state.reactions = (await DB.get('reactions')) || [];
    state.replies   = (await DB.get('replies'))   || [];
    state.seen      = (await DB.get('seen'))      || [];
    if (state.messages.length) render();
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════
// 📶 آنلاین/آفلاین
// ═══════════════════════════════════════════════════════
function updateOnlineBadge() {
  const el = document.getElementById('offline');
  if (el) el.hidden = navigator.onLine;
}
window.addEventListener('online',  () => { updateOnlineBadge(); loadMessages(true); });
window.addEventListener('offline', updateOnlineBadge);

// ═══════════════════════════════════════════════════════
// 📥 بارگیری دسته‌های سفارشی
// ═══════════════════════════════════════════════════════
async function loadCustomCategories() {
  try {
    const res = await fetch(RAW_CATS + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    state.customCategories = data.categories || [];
  } catch(e) { console.warn(e); }
}

// ═══════════════════════════════════════════════════════
// 📥 دریافت پیام‌ها
// ═══════════════════════════════════════════════════════
async function loadMessages(force) {
  if (!navigator.onLine) { setStatus('📴 آفلاین'); showEmptyIfNeeded(); return; }

  try {
    const url = RAW_API + '?t=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const db = await res.json();
    const newMessages = db.messages || [];

    if (newMessages.length === 0) {
      const localMessages = await DB.get('messages');
      if (localMessages && localMessages.length > 0) {
        await DB.set('messages',  []);
        await DB.set('reactions', []);
        await DB.set('replies',   []);
        await DB.set('seen',      []);
        try {
          localStorage.removeItem('seenSent');
          localStorage.removeItem('feedLimit');
        } catch(e) {}
      }
    }

    state.messages  = newMessages;
    state.reactions = db.reactions || [];
    state.replies   = db.replies   || [];
    state.seen      = db.seen      || [];

    await saveLocal();
    render();
    setStatus('');
    showEmptyIfNeeded();

  } catch(e) {
    console.error('loadMessages error:', e);
    render();
    showEmptyIfNeeded();
    setStatus('⚠️ ' + e.message, true);
  }
}

// ═══════════════════════════════════════════════════════
// 🎯 توابع کمکی
// ═══════════════════════════════════════════════════════
function isUserInGroup(groupKey) {
  if (isAdmin) return true;
  return state.myGroups.includes(groupKey);
}

function isUserInCustomCat(catId) {
  if (isAdmin) return true;
  return state.myGroups.includes('__cat__' + catId) || state.myGroups.includes(catId);
}

function isUserInCustomSub(subId) {
  if (isAdmin) return true;
  return state.myGroups.includes(subId);
}

// ═══════════════════════════════════════════════════════
// 🔎 آیا این پیام مربوط به این کلید (key) است؟
//    تطابق هوشمند با name، topic، id و key
// ═══════════════════════════════════════════════════════
function normalizeStr(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[👤🏢🏡🕌🗺👥📁📢🔑💬\s_\-]/g, '') // حذف ایموجی، فاصله، _ و -
    .trim();
}

function messageMatchesFilter(m, key) {
  if (!key) return false;

  const keyNorm = normalizeStr(key);
  if (!keyNorm) return false;

  // چک گروه‌های عادی
  const groups = m.groups || (m.group ? [m.group] : []);
  if (groups.some(g => normalizeStr(g) === keyNorm)) return true;

  // چک customRecipients — با هر فیلد ممکن
  const customs = m.customRecipients || [];
  if (customs.some(c => {
    if (!c) return false;
    return [c.topic, c.id, c.key, c.name]
      .filter(Boolean)
      .some(f => {
        const fNorm = normalizeStr(f);
        return fNorm === keyNorm || fNorm.includes(keyNorm) || keyNorm.includes(fNorm);
      });
  })) return true;

  // چک personalRecipients
  const personal = m.personalRecipients || [];
  if (personal.some(p => {
    if (!p) return false;
    return [p.topic, p.id, p.key, p.name]
      .filter(Boolean)
      .some(f => {
        const fNorm = normalizeStr(f);
        return fNorm === keyNorm || fNorm.includes(keyNorm) || keyNorm.includes(fNorm);
      });
  })) return true;

  return false;
}

// ═══════════════════════════════════════════════════════
// 🎨 تب‌ها
// ═══════════════════════════════════════════════════════
function renderTabs() {
  const tabs = document.getElementById('tabs');
  if (!tabs) return;

  const cats = {
    'خانواده': { emoji: '🏡', items: [] },
    'ویژه':    { emoji: '🕌', items: [] },
    'استان':   { emoji: '🗺', items: [] },
    'سایر':    { emoji: '👥', items: [] }
  };

  Object.entries(C.groups).forEach(([k, g]) => {
    if (!isUserInGroup(k)) return;
    const cat = g.category || 'سایر';
    if (cats[cat]) cats[cat].items.push({ key: k, ...g });
  });

  let html = '';
  html += `<button data-filter="all" class="${state.filter === 'all' ? 'active' : ''}">🌐 همه</button>`;

  if (isAdmin) {
    const adminMsgCount = state.messages.filter(m => m.isAdminMessage).length;
    html += `<button data-filter="toAdmin" class="${state.filter === 'toAdmin' ? 'active' : ''}" style="background:linear-gradient(135deg,#7c3aed,#8b5cf6); color:#fff; border-color:transparent;">
      📬 پیام‌های مدیر ${adminMsgCount ? ' (' + adminMsgCount + ')' : ''}
    </button>`;
  }

  Object.entries(cats).forEach(([catName, cat]) => {
    cat.items.forEach(g => {
      html += `<button data-filter="group:${g.key}" class="${state.filter === 'group:' + g.key ? 'active' : ''}">${g.emoji} ${g.name}</button>`;
    });
  });

  state.customCategories.forEach(cat => {
    const inCat = isUserInCustomCat(cat.id);
    const inAnySub = (cat.subcategories || []).some(sub => isUserInCustomSub(sub.id));
    if (!inCat && !inAnySub) return;

    if (inCat) {
      html += `<button data-filter="cat:${cat.id}" class="${state.filter === 'cat:' + cat.id ? 'active' : ''}">${cat.emoji || '📁'} ${cat.name}</button>`;
    }

    (cat.subcategories || []).forEach(sub => {
      if (!isUserInCustomSub(sub.id)) return;
      html += `<button data-filter="group:${sub.id}" class="${state.filter === 'group:' + sub.id ? 'active' : ''}">${sub.emoji || '👤'} ${sub.name}</button>`;
    });
  });

  tabs.innerHTML = html;

  tabs.querySelectorAll('button[data-filter]').forEach(b => {
    b.onclick = () => {
      state.filter = b.dataset.filter;
      renderTabs();
      render();
    };
  });
}

// ═══════════════════════════════════════════════════════
// 🎨 رندر
// ═══════════════════════════════════════════════════════
function render() {
  const isAdminNow = localStorage.getItem('isAdmin') === 'true';
  const adminEntry = document.getElementById('adminEntry');
  if (adminEntry) adminEntry.hidden = !isAdminNow;

  const logoutBtn = document.getElementById('logoutAdminBtn');
  if (logoutBtn) {
    logoutBtn.hidden = !isAdminNow;
    logoutBtn.onclick = () => {
      if (confirm('از پنل ادمین خارج بشی؟')) {
        localStorage.removeItem('adminUnlocked');
        location.reload();
      }
    };
  }

  renderTabs();

  const feed = document.getElementById('feed');
  if (!feed) return;

  let list = state.messages.slice();

  // ───── فیلتر ─────
if (state.filter === 'all') {
  if (!isAdmin) {
    const myTopic = state.myPersonalTopic || localStorage.getItem('myPersonalTopic') || '';
    const myName = state.myName || localStorage.getItem('myName') || '';

    list = list.filter(m => {
      // ۱. چک گروه‌های عادی
      const groups = m.groups || (m.group ? [m.group] : []);
      if (groups.some(g => state.myGroups.includes(g))) return true;

      // ۲. چک افراد اختصاصی — با topic یا با نام
      const personal = m.personalRecipients || [];
      if (personal.some(p => {
        if (myTopic && p.topic === myTopic) return true;
        if (myName && p.name && p.name.trim() === myName.trim()) return true;
        // چک تطابق جزئی نام (مثلاً «مهدی آشتیانی» با «مهدی سلیمانی آشتیانی»)
        if (myName && p.name) {
          const n1 = String(p.name).replace(/[👤🏢\s]/g, '').trim();
          const n2 = String(myName).replace(/[👤🏢\s]/g, '').trim();
          if (n1 && n2 && (n1.includes(n2) || n2.includes(n1))) return true;
        }
        return false;
      })) return true;

      // ۳. چک دسته‌های سفارشی — با topic یا با نام
      const customs = m.customRecipients || [];
      if (customs.some(c => {
        if (myTopic && c.topic === myTopic) return true;
        if (state.myGroups.includes(c.topic)) return true;
        if (myName && c.name) {
          const n1 = String(c.name).replace(/[👤🏢\s]/g, '').trim();
          const n2 = String(myName).replace(/[👤🏢\s]/g, '').trim();
          if (n1 && n2 && (n1.includes(n2) || n2.includes(n1))) return true;
        }
        return false;
      })) return true;

      // ۴. اگه پیام برای همه بود، نشون نده
      if (m.groups && m.groups.length === 0
          && (!m.personalRecipients || m.personalRecipients.length === 0)
          && (!m.customRecipients || m.customRecipients.length === 0)) return false;

      return false;
    });
  }
} else if (state.filter === 'toAdmin') {
    list = list.filter(m => m.isAdminMessage === true);

  } else if (state.filter.startsWith('cat:')) {
    // ─── فیلتر دسته سفارشی (اداره، دوستانی، ...) ───
    const catId = state.filter.substring(4);
    const cat = state.customCategories.find(c => String(c.id) === String(catId));
    const catName = cat ? cat.name : '';
    const subs = cat ? (cat.subcategories || []) : [];

    list = list.filter(m => {
      // با خود دسته چک کن (id و name)
      if (messageMatchesFilter(m, catId)) return true;
      if (catName && messageMatchesFilter(m, catName)) return true;
      // با همه زیرشاخه‌ها چک کن (id و name)
      for (const sub of subs) {
        if (messageMatchesFilter(m, sub.id)) return true;
        if (sub.name && messageMatchesFilter(m, sub.name)) return true;
      }
      return false;
    });

} else if (state.filter.startsWith('group:')) {
  const g = state.filter.substring(6);
  const myName = state.myName || localStorage.getItem('myName') || '';

  list = list.filter(m => {
    // چک با key مستقیم
    if (messageMatchesFilter(m, g)) return true;
    // چک با نام کاربر فعلی
    if (myName && messageMatchesFilter(m, myName)) return true;
    return false;
  });
}    // ─── فیلتر گروه عادی یا زیرشاخه ───
    const g = state.filter.substring(6);

    // ببین آیا این g مربوط به یک زیرشاخه سفارشی است
    let subName = '';
    state.customCategories.forEach(cat => {
      (cat.subcategories || []).forEach(sub => {
        if (String(sub.id) === String(g)) subName = sub.name || '';
      });
    });

    list = list.filter(m => {
      if (messageMatchesFilter(m, g)) return true;
      if (subName && messageMatchesFilter(m, subName)) return true;
      return false;
    });
  }

  list.sort((a, b) => new Date(b.time) - new Date(a.time));

  if (!list.length) {
    feed.innerHTML = '<div class="empty">هنوز پیامی نیست 🌱</div>';
    return;
  }

  const currentLimit = parseInt(localStorage.getItem('feedLimit') || INITIAL_COUNT, 10);
  const visible = list.slice(0, currentLimit);
  const hasMore = list.length > currentLimit;

  feed.innerHTML = visible.map(m => renderMessageCard(m)).join('');

  if (hasMore) {
    const btn = document.createElement('div');
    btn.style.cssText = 'text-align:center; margin: 20px 0 12px;';
    btn.innerHTML = '<button id="loadMoreBtn" style="padding:14px 32px; background:linear-gradient(135deg,#1e40af,#3b82f6); color:#fff; border:none; border-radius:14px; cursor:pointer; font-family:inherit; font-size:16px; font-weight:700; box-shadow:0 6px 20px rgba(30,64,175,.35);">نمایش پیام‌های بیشتر 👇</button>';
    feed.appendChild(btn);
    document.getElementById('loadMoreBtn').onclick = () => {
      localStorage.setItem('feedLimit', currentLimit + LOAD_STEP);
      render();
    };
  } else if (list.length > INITIAL_COUNT) {
    const btn = document.createElement('div');
    btn.style.cssText = 'text-align:center; margin: 20px 0 12px;';
    btn.innerHTML = '<button id="showLessBtn" style="padding:10px 24px; background:transparent; color:#5b7ba6; border:1.5px solid #bfdbfe; border-radius:12px; cursor:pointer; font-family:inherit; font-size:14px; font-weight:600;">نمایش کمتر ☝️</button>';
    feed.appendChild(btn);
    document.getElementById('showLessBtn').onclick = () => {
      localStorage.setItem('feedLimit', INITIAL_COUNT);
      render();
    };
  }

  feed.querySelectorAll('.reactions button[data-emoji]').forEach(b => {
    b.onclick = () => sendReaction(b.dataset.mid, b.dataset.emoji);
  });
  feed.querySelectorAll('.reply-btn').forEach(b => {
    b.onclick = () => openReply(b.dataset.mid);
  });
  feed.querySelectorAll('img.img').forEach(im => {
    im.onclick = () => window.open(im.dataset.full, '_blank');
  });

  observeSeen();
}

// ═══════════════════════════════════════════════════════
// 🎴 کارت پیام
// ═══════════════════════════════════════════════════════
function renderMessageCard(m) {
  const rx = state.reactions.filter(r => r.messageId === m.id);
  const grouped = {};
  rx.forEach(r => { grouped[r.emoji] = (grouped[r.emoji] || 0) + 1; });

  const chips = Object.entries(grouped).map(([e, n]) =>
    '<button data-mid="' + m.id + '" data-emoji="' + e + '">' + e + ' <span class="badge">' + n + '</span></button>'
  ).join('');

  const EMOJIS = ['❤️', '👍', '😂', '😮', '😢'];
  const palette = EMOJIS.map(e =>
    grouped[e] ? '' : '<button data-mid="' + m.id + '" data-emoji="' + e + '">' + e + '</button>'
  ).join('');

  const replies = state.replies
    .filter(r => r.messageId === m.id)
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  const repliesHtml = replies.length ? (
    '<div class="replies">' +
    replies.map(r =>
      '<div class="reply"><b>' + esc(r.from) + '</b> <time>' + fmtTime(r.time) + '</time><div>' + esc(r.text) + '</div></div>'
    ).join('') +
    '</div>'
  ) : '';

  const seenBy = state.seen.filter(s => s.messageId === m.id);
  const seenHtml = seenBy.length ? '<span class="seen-badge">👁 ' + seenBy.length + '</span>' : '';

  const labels = [];

  if (m.isAdminMessage) {
    labels.push('💬 از ' + (m.from || 'ناشناس'));
    if (m.userGroup) labels.push('📁 ' + m.userGroup);
  }

  const msgGroups = m.groups || (m.group ? [m.group] : []);
  msgGroups.forEach(g => {
    if (C.groups[g]) {
      labels.push(C.groups[g].emoji + ' ' + C.groups[g].name);
    }
  });

  (m.personalRecipients || []).forEach(p => {
    if (p.name) labels.push('👤 ' + p.name);
  });

  (m.customRecipients || []).forEach(c => {
    if (c.name) labels.push('📢 ' + c.name);
  });

  const groupLabels = labels.join('، ');

  const imgHtml = m.image
    ? '<img class="img" src="' + esc(m.image) + '" loading="lazy" alt="" data-full="' + esc(m.image) + '">'
    : '';

  return (
    '<article class="card" data-mid="' + m.id + '">' +
      (m.text ? '<div class="text">' + esc(m.text) + '</div>' : '') +
      imgHtml +
      '<div class="meta"><span>' + (groupLabels || '—') + '</span><span>' + fmtTime(m.time) + '</span></div>' +
      '<div class="reactions">' + chips + palette + seenHtml +
        '<button class="reply-btn" data-mid="' + m.id + '">💬 پاسخ</button>' +
      '</div>' +
      repliesHtml +
    '</article>'
  );
}

// ═══════════════════════════════════════════════════════
// ❤️ ری‌اکشن
// ═══════════════════════════════════════════════════════
async function sendReaction(messageId, emoji) {
  if (!state.myName) return setStatus('اول وارد شو', true);
  try {
    await fetch(C.ntfyBase + '/' + C.interactionsTopic, {
      method: 'POST',
      body: JSON.stringify({ type: 'reaction', messageId, emoji, from: state.myName })
    });
    state.reactions.push({
      id: 'local-' + uid(), messageId, emoji, from: state.myName,
      time: new Date().toISOString()
    });
    render();
  } catch(e) { setStatus('خطا: ' + e.message, true); }
}

// ═══════════════════════════════════════════════════════
// 💬 پاسخ
// ═══════════════════════════════════════════════════════
let replyTargetId = null;

function openReply(mid) {
  if (!state.myName) return setStatus('اول وارد شو', true);
  replyTargetId = mid;
  const m = state.messages.find(x => x.id === mid);
  const q = document.getElementById('replyQuote');
  const t = document.getElementById('replyText');
  const dlg = document.getElementById('replyDlg');
  if (!q || !t || !dlg) return;
  q.textContent = m && m.text ? m.text : '[عکس]';
  t.value = '';
  dlg.showModal();
  setTimeout(() => t.focus(), 50);
}

async function submitReply() {
  try {
    const t = document.getElementById('replyText');
    const dlg = document.getElementById('replyDlg');
    const sendBtn = document.getElementById('replySendBtn');

    if (!t) { alert('❌ کادر متن پیدا نشد'); return; }
    const text = t.value.trim();
    if (!text) { alert('❌ متن پاسخ خالیه'); return; }
    if (!replyTargetId) { alert('❌ پیام انتخاب نشده'); return; }
    if (!state.myName) { alert('❌ نام شما ثبت نشده'); return; }

    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '⏳ ارسال...'; }

    const res = await fetch(C.ntfyBase + '/' + C.interactionsTopic, {
      method: 'POST',
      body: JSON.stringify({
        type: 'reply',
        messageId: replyTargetId,
        text: text,
        from: state.myName
      })
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);

    state.replies.push({
      id: 'local-' + uid(),
      messageId: replyTargetId,
      text: text,
      from: state.myName,
      time: new Date().toISOString()
    });

    if (dlg) dlg.close();
    replyTargetId = null;
    render();

  } catch(e) {
    console.error('submitReply error:', e);
    alert('❌ خطا: ' + e.message);
  } finally {
    const sendBtn = document.getElementById('replySendBtn');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'ارسال'; }
  }
}

// ═══════════════════════════════════════════════════════
// 👁 seen
// ═══════════════════════════════════════════════════════
let seenSent = new Set();
try { seenSent = new Set(JSON.parse(localStorage.getItem('seenSent') || '[]')); } catch(e) {}

let seenObserver = null;

function observeSeen() {
  if (seenObserver) seenObserver.disconnect();
  if (!state.myName) return;
  seenObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const mid = e.target.dataset.mid;
      if (mid) sendSeen(mid);
      seenObserver.unobserve(e.target);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('.card[data-mid]').forEach(c => seenObserver.observe(c));
}

function sendSeen(messageId) {
  if (!state.myName || seenSent.has(messageId)) return;
  seenSent.add(messageId);
  try { localStorage.setItem('seenSent', JSON.stringify(Array.from(seenSent).slice(-1000))); } catch(e) {}
  fetch(C.ntfyBase + '/' + C.interactionsTopic, {
    method: 'POST',
    body: JSON.stringify({ type: 'seen', messageId, from: state.myName })
  }).catch(() => {});
}

// ═══════════════════════════════════════════════════════
// 🔄 SSE
// ═══════════════════════════════════════════════════════
function subscribeSSE() {
  try {
    const subscribed = new Set();

    state.myGroups.forEach(groupKey => {
      const group = C.groups[groupKey];
      if (group && group.topic && !subscribed.has(group.topic)) {
        subscribed.add(group.topic);
        const es = new EventSource(C.ntfyBase + '/' + group.topic + '/sse');
        es.onmessage = ev => {
          try {
            const d = JSON.parse(ev.data);
            if (d.event === 'message' && d.message) setTimeout(() => loadMessages(true), 500);
          } catch(e) {}
        };
        es.onerror = () => {};
      }
    });

    const personalTopic = localStorage.getItem('myPersonalTopic');
    if (personalTopic && !subscribed.has(personalTopic)) {
      subscribed.add(personalTopic);
      const esP = new EventSource(C.ntfyBase + '/' + personalTopic + '/sse');
      esP.onmessage = ev => {
        try {
          const d = JSON.parse(ev.data);
          if (d.event === 'message' && d.message) setTimeout(() => loadMessages(true), 500);
        } catch(e) {}
      };
      esP.onerror = () => {};
    }

    state.customCategories.forEach(cat => {
      if (state.myGroups.includes('__cat__' + cat.id) || isAdmin) {
        if (cat.topic && !subscribed.has(cat.topic)) {
          subscribed.add(cat.topic);
          const esC = new EventSource(C.ntfyBase + '/' + cat.topic + '/sse');
          esC.onmessage = ev => {
            try {
              const d = JSON.parse(ev.data);
              if (d.event === 'message' && d.message) setTimeout(() => loadMessages(true), 500);
            } catch(e) {}
          };
          esC.onerror = () => {};
        }
      }
      (cat.subcategories || []).forEach(sub => {
        if (state.myGroups.includes(sub.id) || isAdmin) {
          if (sub.topic && !subscribed.has(sub.topic)) {
            subscribed.add(sub.topic);
            const esS = new EventSource(C.ntfyBase + '/' + sub.topic + '/sse');
            esS.onmessage = ev => {
              try {
                const d = JSON.parse(ev.data);
                if (d.event === 'message' && d.message) setTimeout(() => loadMessages(true), 500);
              } catch(e) {}
            };
            esS.onerror = () => {};
          }
        }
      });
    });

    const esIx = new EventSource(C.ntfyBase + '/' + C.interactionsTopic + '/sse');
    esIx.onmessage = ev => {
      try {
        const d = JSON.parse(ev.data);
        if (d.event !== 'message') return;
        const data = JSON.parse(d.message);
        const iso = new Date((d.time || Date.now() / 1000) * 1000).toISOString();

        if (data.type === 'reaction') {
          if (state.reactions.some(r => r.id === d.id)) return;
          state.reactions.push({ id: d.id, messageId: data.messageId, emoji: data.emoji, from: data.from, time: iso });
        } else if (data.type === 'reply') {
          if (state.replies.some(r => r.id === d.id)) return;
          state.replies.push({ id: d.id, messageId: data.messageId, text: data.text, from: data.from, time: iso });
        } else if (data.type === 'seen') {
          if (state.seen.some(s => s.messageId === data.messageId && s.from === data.from)) return;
          state.seen.push({ messageId: data.messageId, from: data.from, time: iso });
        } else return;

        saveLocal(); render();
      } catch(e) {}
    };
    esIx.onerror = () => {};
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════
// 💬 دکمه «پیام به مدیر»
// ═══════════════════════════════════════════════════════
function addAdminMsgButton() {
  if (isAdmin) return;
  if (document.getElementById('adminMsgBtn')) return;

  const headerActions = document.querySelector('.header-actions');
  if (!headerActions) return;

  const btn = document.createElement('button');
  btn.id = 'adminMsgBtn';
  btn.title = 'پیام به مدیر';
  btn.textContent = '💬';
  btn.style.cssText = 'background:rgba(139,92,246,.15); color:#7c3aed; font-size:18px;';
  btn.onclick = openAdminMsgDialog;

  headerActions.insertBefore(btn, headerActions.firstChild);
}

function openAdminMsgDialog() {
  if (!state.myName) {
    alert('اول از ⚙️ نامت رو وارد کن');
    return;
  }

  let dlg = document.getElementById('adminMsgDlg');

  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'adminMsgDlg';
    dlg.innerHTML = `
      <form method="dialog">
        <h3>💬 پیام به مدیر</h3>
        <p style="color:#64748b; font-size:14px; margin:0 0 14px; font-weight:600; line-height:1.7">
          پیام شما فقط برای مدیر سامانه ارسال می‌شه
        </p>
        <textarea id="adminMsgText" placeholder="متن پیام..." rows="4"
          style="width:100%; padding:12px; border:2px solid #dbeafe; border-radius:12px; font-family:inherit; font-size:15px; resize:vertical; box-sizing:border-box; background:#f8fbff; color:#0c1e3e;"></textarea>
        <div id="adminMsgStatus" style="margin-top:12px; font-size:14px; font-weight:700; min-height:20px; text-align:center"></div>
        <menu style="display:flex; gap:10px; justify-content:flex-end; margin:18px 0 0; padding:0;">
          <button value="cancel" class="ghost" style="background:transparent; color:#64748b; border:2px solid #93c5fd; padding:10px 20px; border-radius:12px; font-family:inherit; font-size:14px; font-weight:800; cursor:pointer;">لغو</button>
          <button id="adminMsgSendBtn" type="button" style="background:linear-gradient(135deg,#7c3aed,#8b5cf6); color:#fff; border:none; padding:10px 24px; border-radius:12px; font-family:inherit; font-size:14px; font-weight:800; cursor:pointer; box-shadow:0 6px 18px rgba(124,58,237,.35);">ارسال به مدیر 📨</button>
        </menu>
      </form>
    `;
    document.body.appendChild(dlg);

    dlg.querySelector('#adminMsgSendBtn').onclick = async () => {
      const text = dlg.querySelector('#adminMsgText').value.trim();
      const statusEl = dlg.querySelector('#adminMsgStatus');
      const sendBtn = dlg.querySelector('#adminMsgSendBtn');

      if (!text) {
        statusEl.textContent = '❌ متن لازمه';
        statusEl.style.color = '#dc2626';
        return;
      }

      statusEl.textContent = '⏳ در حال ارسال...';
      statusEl.style.color = '#64748b';
      sendBtn.disabled = true;

      try {
        await fetch(C.ntfyBase + '/' + C.adminTopic, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            type: 'admin-message',
            text: text,
            from: state.myName || 'ناشناس',
            phone: localStorage.getItem('myPhone') || '',
            group: state.myGroups[0] || '',
            time: new Date().toISOString()
          })
        });

        statusEl.textContent = '✅ پیام ارسال شد!';
        statusEl.style.color = '#16a34a';

        setTimeout(() => {
          dlg.close();
          dlg.querySelector('#adminMsgText').value = '';
          statusEl.textContent = '';
          sendBtn.disabled = false;
        }, 1500);

      } catch(e) {
        statusEl.textContent = '❌ ' + e.message;
        statusEl.style.color = '#dc2626';
        sendBtn.disabled = false;
      }
    };

    dlg.addEventListener('close', () => {
      dlg.querySelector('#adminMsgText').value = '';
      dlg.querySelector('#adminMsgStatus').textContent = '';
      dlg.querySelector('#adminMsgSendBtn').disabled = false;
    });
  }

  dlg.showModal();
}

// ═══════════════════════════════════════════════════════
// ⚙️ تنظیمات
// ═══════════════════════════════════════════════════════
function setupSettings() {
  const dlg = document.getElementById('settingsDlg');
  const sel = document.getElementById('myGroup');
  const nameInput = document.getElementById('myName');
  if (!dlg || !sel || !nameInput) return;

  sel.innerHTML = Object.entries(C.groups)
    .map(([k,g]) => `<option value="${k}">${g.emoji} ${g.name}</option>`).join('');
  nameInput.value = state.myName;
  sel.value = state.myGroup || (state.myGroups[0] || 'friends');

  const btn = document.getElementById('settingsBtn');
  if (btn) btn.onclick = () => dlg.showModal();

  dlg.addEventListener('close', () => {
    const n = nameInput.value.trim();
    if (n) state.myName = n;
    state.myGroup = sel.value;
    localStorage.setItem('myName', state.myName);
    localStorage.setItem('myGroup', state.myGroup);
    observeSeen();
  });

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.onclick = () => loadMessages(true);

  const replyBtn = document.getElementById('replySendBtn');
  if (replyBtn) replyBtn.onclick = submitReply;

  if (isAdmin) {
    const logoutAdminBtn = document.getElementById('logoutAdminBtn');
    if (logoutAdminBtn) {
      logoutAdminBtn.hidden = false;
      logoutAdminBtn.onclick = () => {
        if (confirm('از پنل ادمین خارج بشی؟ (توکن ذخیره می‌مونه)')) {
          localStorage.removeItem('adminUnlocked');
          location.reload();
        }
      };
    }
  }
}

function showEmptyIfNeeded() {
  const tabs = document.getElementById('tabs');
  const feed = document.getElementById('feed');
  if (!tabs || !feed) return;
  if (!feed.innerHTML.trim()) {
    renderTabs();
    feed.innerHTML = '<div class="empty">هنوز پیامی نیست 🌱</div>';
  }
}

// ═══════════════════════════════════════════════════════
// 🚀 شروع
// ═══════════════════════════════════════════════════════
async function init() {
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    updateOnlineBadge();
    setupSettings();
    addAdminMsgButton();

    await loadCustomCategories();
    await loadLocal();
    await loadMessages(true);
    subscribeSSE();
    setInterval(() => loadMessages(true), 5 * 60 * 1000);
  } catch(e) {
    console.error('init error:', e);
  }
}

init();
})();
