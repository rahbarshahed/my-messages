(() => {
const C = window.CONFIG;
const DB = window.MsgDB;
const RAW_API = `https://raw.githubusercontent.com/${C.owner}/${C.repo}/${C.branch}/messages.json`;
const RAW_ALLOWED = `https://raw.githubusercontent.com/${C.owner}/${C.repo}/${C.branch}/allowed.json`;
const RAW_CATS = `https://raw.githubusercontent.com/${C.owner}/${C.repo}/${C.branch}/categories.json`;
// ═══════════════════════════════════════════════════════
// 💬 دکمه پیام به مدیر — فقط برای کاربرای عادی
// ═══════════════════════════════════════════════════════
function addAdminMsgButton() {
  if (isAdmin) return;  // ادمین نیازی نداره

  // چک کن دکمه هست؟
  if (document.getElementById('adminMsgBtn')) return;

  // دکمه رو به header اضافه کن
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
  // ═══════════════════════════════════════════════════════
// 💬 پیام به مدیر — فقط برای کاربرای عادی
// ═══════════════════════════════════════════════════════
async function sendToAdmin(text, imageUrl) {
  if (!text && !imageUrl) return;

  const payload = {
    type: 'admin-message',
    text: text || '',
    image: imageUrl || '',
    from: state.myName || 'ناشناس',
    phone: localStorage.getItem('myPhone') || '',
    group: state.myGroups[0] || '',
    time: new Date().toISOString()
  };

  try {
    await fetch(C.ntfyBase + '/' + C.adminTopic, {
      method: 'POST',
      headers: {
        'Title': '💬 پیام از ' + payload.from,
        'Priority': 'high',
        'Tags': 'envelope,speech_balloon'
      },
      body: JSON.stringify(payload)
    });
    return true;
  } catch(e) {
    console.error('sendToAdmin error:', e);
    return false;
  }
}

function openAdminMsgDialog() {
  if (!state.myName) return setStatus('اول وارد شو', true);

  const dlg = document.getElementById('adminMsgDlg');
  if (!dlg) {
    // اگه دیالوگ نبود، بساز
    const newDlg = document.createElement('dialog');
    newDlg.id = 'adminMsgDlg';
    newDlg.innerHTML = `
      <form method="dialog">
        <h3>💬 پیام به مدیر</h3>
        <p style="color:#64748b; font-size:14px; margin:0 0 12px; font-weight:600">
          پیام شما فقط برای مدیر سامانه ارسال میشه
        </p>
        <textarea id="adminMsgText" placeholder="متن پیام..." rows="4"></textarea>
        <label style="display:block; margin:12px 0 6px; font-size:14px; color:#64748b; font-weight:700">
          🖼 عکس (اختیاری)
        </label>
        <input type="file" id="adminMsgImg" accept="image/*">
        <img id="adminMsgPreview" style="max-width:200px; border-radius:12px; margin-top:10px; display:none">
        <div id="adminMsgStatus" style="margin-top:10px; font-size:14px; font-weight:700; min-height:20px"></div>
        <menu>
          <button value="cancel" class="ghost">لغو</button>
          <button id="adminMsgSendBtn" type="button">ارسال به مدیر 📨</button>
        </menu>
      </form>
    `;
    document.body.appendChild(newDlg);

    // اتصال رویدادها
    const imgInput = newDlg.querySelector('#adminMsgImg');
    const preview = newDlg.querySelector('#adminMsgPreview');
    imgInput.onchange = () => {
      const f = imgInput.files[0];
      if (!f) { preview.style.display = 'none'; return; }
      preview.src = URL.createObjectURL(f);
      preview.style.display = 'block';
    };

    newDlg.querySelector('#adminMsgSendBtn').onclick = async () => {
      const text = newDlg.querySelector('#adminMsgText').value.trim();
      const file = imgInput.files[0];
      const statusEl = newDlg.querySelector('#adminMsgStatus');

      if (!text && !file) {
        statusEl.textContent = '❌ متن یا عکس لازمه';
        statusEl.style.color = '#dc2626';
        return;
      }

      statusEl.textContent = '⏳ در حال ارسال...';
      statusEl.style.color = '#64748b';

      let imageDataUrl = '';
      if (file) {
        // عکس رو به base64 تبدیل کن (چون توکن نداریم نمیتونیم آپلود کنیم به گیتهاب)
        // پس عکس رو به صورت data URL توی ntfy می‌فرستیم
        // ولی ntfy محدودیت 4KB داره — پس عکس رو نمی‌فرستیم
        statusEl.textContent = '⚠️ عکس فعلاً پشتیبانی نمیشه (فقط متن)';
        statusEl.style.color = '#d97706';
        await new Promise(r => setTimeout(r, 1500));
      }

      const ok = await sendToAdmin(text, '');

      if (ok) {
        statusEl.textContent = '✅ پیام ارسال شد!';
        statusEl.style.color = '#16a34a';
        setTimeout(() => {
          newDlg.close();
          newDlg.querySelector('#adminMsgText').value = '';
          imgInput.value = '';
          preview.style.display = 'none';
          statusEl.textContent = '';
        }, 1200);
      } else {
        statusEl.textContent = '❌ خطا در ارسال';
        statusEl.style.color = '#dc2626';
      }
    };

    newDlg.addEventListener('close', () => {
      newDlg.querySelector('#adminMsgText').value = '';
      newDlg.querySelector('#adminMsgImg').value = '';
      newDlg.querySelector('#adminMsgPreview').style.display = 'none';
      newDlg.querySelector('#adminMsgStatus').textContent = '';
    });
  }

  dlg.showModal();
}

const state = {
  messages: [], reactions: [], replies: [], seen: [],
  myName: localStorage.getItem('myName') || '',
  myGroups: [],
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
  return state.myGroups.includes('__cat__' + catId);
}

function isUserInCustomSub(subId) {
  if (isAdmin) return true;
  return state.myGroups.includes(subId);
}

// آیا پیام به این topic رفته؟
function messageHasTopic(m, topic) {
  // چک groups
  const groups = m.groups || (m.group ? [m.group] : []);
  if (groups.includes(topic)) return true;

  // چک customRecipients
  if ((m.customRecipients || []).some(c => c.topic === topic)) return true;

  // چک personalRecipients
  if ((m.personalRecipients || []).some(p => p.topic === topic)) return true;

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

  // 👑 تب پیام‌های مدیر (فقط برای ادمین)
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

  // دسته‌های سفارشی
  state.customCategories.forEach(cat => {
    if (!isUserInCustomCat(cat.id) && !isUserInCustomSub('__cat__' + cat.id)) return;
    html += `<button data-filter="cat:${cat.id}" class="${state.filter === 'cat:' + cat.id ? 'active' : ''}">${cat.emoji || '📁'} ${cat.name}</button>`;

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
      list = list.filter(m => {
        // چک گروه‌های عادی
        const groups = m.groups || (m.group ? [m.group] : []);
        if (groups.some(g => state.myGroups.includes(g))) return true;

        // ✅ چک personalTopic کاربر
        const myTopic = state.myPersonalTopic || localStorage.getItem('myPersonalTopic') || '';
        if (myTopic && (m.personalRecipients || []).some(p => p.topic === myTopic)) return true;

        // ✅ چک customRecipients (مقایسه topic)
        if ((m.customRecipients || []).some(c => 
          state.myGroups.includes(c.topic) || c.topic === myTopic
        )) return true;

        // ✅ چک اگه پیام برای همه بود
        if (m.groups && m.groups.length === 0 && (!m.personalRecipients || m.personalRecipients.length === 0)) return false;

        return false;
      });
    }
  }
  } else if (state.filter.startsWith('group:')) {
    const g = state.filter.substring(6);
    list = list.filter(m => {
      // چک گروه‌های عادی
      const groups = m.groups || (m.group ? [m.group] : []);
      if (groups.includes(g)) return true;

      // چک دسته‌های سفارشی
      const customs = m.customRecipients || [];
      if (customs.some(c => c.topic === g)) return true;

      // چک افراد اختصاصی
      const personal = m.personalRecipients || [];
      if (personal.some(p => p.topic === g)) return true;

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

  // ───── ساخت برچسب گروه‌ها ─────
  const labels = [];

  // اگه پیام خصوصی به ادمین بود
  if (m.isAdminMessage) {
    labels.push('💬 از ' + (m.from || 'ناشناس'));
    if (m.userGroup) {
      labels.push('📁 ' + m.userGroup);
    }
  }
  
  // 1. گروه‌های عادی
  const msgGroups = m.groups || (m.group ? [m.group] : []);
  msgGroups.forEach(g => {
    if (C.groups[g]) {
      labels.push(C.groups[g].emoji + ' ' + C.groups[g].name);
    }
  });

  // 2. افراد اختصاصی
  (m.personalRecipients || []).forEach(p => {
    if (p.name) labels.push('👤 ' + p.name);
  });

  // 3. دسته‌های سفارشی
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
  console.log('=== submitReply called ===');

  try {
    const t = document.getElementById('replyText');
    const dlg = document.getElementById('replyDlg');
    const sendBtn = document.getElementById('replySendBtn');

    console.log('Elements:', { t: !!t, dlg: !!dlg, sendBtn: !!sendBtn });
    console.log('replyTargetId:', replyTargetId);
    console.log('myName:', state.myName);

    if (!t) {
      alert('❌ کادر متن پیدا نشد');
      return;
    }

    const text = t.value.trim();
    console.log('text:', text);

    if (!text) {
      alert('❌ متن پاسخ خالیه');
      return;
    }

    if (!replyTargetId) {
      alert('❌ پیام انتخاب نشده — دوباره روی 💬 پاسخ بزن');
      return;
    }

    if (!state.myName) {
      alert('❌ نام شما ثبت نشده — از ⚙️ نامت رو وارد کن');
      return;
    }

    console.log('✓ همه چک‌ها پاس شد → در حال ارسال به ntfy');

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = '⏳ ارسال...';
    }

    const url = C.ntfyBase + '/' + C.interactionsTopic;
    console.log('URL:', url);

    const body = JSON.stringify({
      type: 'reply',
      messageId: replyTargetId,
      text: text,
      from: state.myName
    });
    console.log('Body:', body);

    const res = await fetch(url, {
      method: 'POST',
      body: body
    });

    console.log('Response status:', res.status);
    console.log('Response ok:', res.ok);

    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    console.log('✓ ntfy ارسال شد');

    state.replies.push({
      id: 'local-' + uid(),
      messageId: replyTargetId,
      text: text,
      from: state.myName,
      time: new Date().toISOString()
    });

    if (dlg) {
      dlg.close();
      console.log('✓ پنجره بسته شد');
    }

    replyTargetId = null;
    render();
    console.log('✓ render شد');

  } catch(e) {
    console.error('❌ submitReply error:', e);
    alert('❌ خطا: ' + e.message);
  } finally {
    const sendBtn = document.getElementById('replySendBtn');
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'ارسال';
    }
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

    // Subscribe به گروه‌ها
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

    // Subscribe به topic اختصاصی
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

    // Subscribe به topic دسته‌های سفارشی که کاربر عضوشونه
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

    // کانال تعاملات
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
// ⚙️ تنظیمات
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// 💬 دکمه «پیام به مدیر» — فقط برای کاربرای عادی
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
        <label style="display:block; margin:14px 0 6px; font-size:14px; color:#64748b; font-weight:700">
          🖼 عکس (اختیاری)
        </label>
        <input type="file" id="adminMsgImg" accept="image/*"
          style="width:100%; padding:10px; border:2px solid #dbeafe; border-radius:12px; font-family:inherit; background:#f8fbff; box-sizing:border-box;">
        <img id="adminMsgPreview" style="max-width:200px; border-radius:12px; margin-top:10px; display:none; box-shadow:0 4px 14px rgba(30,64,175,.2);">
        <div id="adminMsgStatus" style="margin-top:12px; font-size:14px; font-weight:700; min-height:20px; text-align:center"></div>
        <menu style="display:flex; gap:10px; justify-content:flex-end; margin:18px 0 0; padding:0;">
          <button value="cancel" class="ghost" style="background:transparent; color:#64748b; border:2px solid #93c5fd; padding:10px 20px; border-radius:12px; font-family:inherit; font-size:14px; font-weight:800; cursor:pointer;">لغو</button>
          <button id="adminMsgSendBtn" type="button" style="background:linear-gradient(135deg,#7c3aed,#8b5cf6); color:#fff; border:none; padding:10px 24px; border-radius:12px; font-family:inherit; font-size:14px; font-weight:800; cursor:pointer; box-shadow:0 6px 18px rgba(124,58,237,.35);">ارسال به مدیر 📨</button>
        </menu>
      </form>
    `;
    document.body.appendChild(dlg);

    const imgInput = dlg.querySelector('#adminMsgImg');
    const preview = dlg.querySelector('#adminMsgPreview');

    imgInput.onchange = () => {
      const f = imgInput.files[0];
      if (!f) { preview.style.display = 'none'; return; }
      preview.src = URL.createObjectURL(f);
      preview.style.display = 'block';
    };

    dlg.querySelector('#adminMsgSendBtn').onclick = async () => {
      const text = dlg.querySelector('#adminMsgText').value.trim();
      const file = imgInput.files[0];
      const statusEl = dlg.querySelector('#adminMsgStatus');
      const sendBtn = dlg.querySelector('#adminMsgSendBtn');

      if (!text && !file) {
        statusEl.textContent = '❌ متن یا عکس لازمه';
        statusEl.style.color = '#dc2626';
        return;
      }

      statusEl.textContent = '⏳ در حال ارسال...';
      statusEl.style.color = '#64748b';
      sendBtn.disabled = true;

      try {
        const payload = {
          type: 'admin-message',
          text: text || '',
          image: '',
          from: state.myName || 'ناشناس',
          phone: localStorage.getItem('myPhone') || '',
          group: state.myGroups[0] || '',
          time: new Date().toISOString()
        };

        console.log('ارسال به مدیر:', payload);

        const res = await fetch(C.ntfyBase + '/' + C.adminTopic, {
          method: 'POST',
          headers: {
            'Title': '💬 پیام از ' + payload.from,
            'Priority': 'high',
            'Tags': 'envelope,speech_balloon'
          },
          body: JSON.stringify(payload)
        });

        console.log('وضعیت:', res.status);

        if (!res.ok) throw new Error('HTTP ' + res.status);

        statusEl.textContent = '✅ پیام ارسال شد!';
        statusEl.style.color = '#16a34a';

        setTimeout(() => {
          dlg.close();
          dlg.querySelector('#adminMsgText').value = '';
          imgInput.value = '';
          preview.style.display = 'none';
          statusEl.textContent = '';
          sendBtn.disabled = false;
        }, 1500);

      } catch(e) {
        console.error('خطا:', e);
        statusEl.textContent = '❌ خطا: ' + e.message;
        statusEl.style.color = '#dc2626';
        sendBtn.disabled = false;
      }
    };

    dlg.addEventListener('close', () => {
      dlg.querySelector('#adminMsgText').value = '';
      imgInput.value = '';
      preview.style.display = 'none';
      dlg.querySelector('#adminMsgStatus').textContent = '';
      dlg.querySelector('#adminMsgSendBtn').disabled = false;
    });
  }

  dlg.showModal();
}

  // ═══════════════════════════════════════════════════════
// 💬 دکمه «پیام به مدیر» — برای کاربرای عادی
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
