/**
 * TempMal — Mail API Layer
 * Connect to a real backend by setting API_BASE_URL.
 * When empty, demo mode uses localStorage + simulated data.
 */

const API_BASE_URL = '';
const MAIL_DOMAIN = 'tempmal.com';
const STORAGE_KEY = 'tempmal_data';
const DEMO_MODE = !API_BASE_URL;

const MAILBOX_NAME_REGEX = /^[a-z0-9]([a-z0-9._-]{1,16}[a-z0-9])?$/i;

function generateRandomString(length, charset) {
  const chars = charset || 'abcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (b) => chars[b % chars.length]).join('');
}

function generatePassword() {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  let pwd = '';
  const rand = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? () => crypto.getRandomValues(new Uint8Array(1))[0] / 255
    : () => Math.random();
  pwd += upper[Math.floor(rand() * upper.length)];
  pwd += lower[Math.floor(rand() * lower.length)];
  pwd += digits[Math.floor(rand() * digits.length)];
  pwd += special[Math.floor(rand() * special.length)];
  for (let i = 4; i < 12; i++) {
    pwd += all[Math.floor(rand() * all.length)];
  }
  return pwd.split('').sort(() => rand() - 0.5).join('');
}

function generateMailboxName() {
  const adjectives = ['swift', 'quiet', 'bright', 'calm', 'fresh', 'quick', 'cool', 'neat', 'safe', 'clear'];
  const nouns = ['mail', 'box', 'inbox', 'letter', 'note', 'post', 'drop', 'hub', 'spot', 'zone'];
  const rand = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? () => crypto.getRandomValues(new Uint8Array(1))[0] / 255
    : () => Math.random();
  const adj = adjectives[Math.floor(rand() * adjectives.length)];
  const noun = nouns[Math.floor(rand() * nouns.length)];
  const num = generateRandomString(3, '0123456789');
  return `${adj}${noun}${num}`;
}

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage full or unavailable */
  }
}

function createDefaultMailbox(name) {
  const now = Date.now();
  const defaultMinutes = 1440;
  return {
    id: generateRandomString(16, 'abcdefghijklmnopqrstuvwxyz0123456789'),
    address: `${name || generateMailboxName()}@${MAIL_DOMAIN}`,
    name: name || generateMailboxName(),
    password: generatePassword(),
    createdAt: now,
    expiresAt: now + defaultMinutes * 60 * 1000,
    lifetimeMinutes: defaultMinutes,
    messages: []
  };
}

function isExpired(mailbox) {
  return Date.now() >= mailbox.expiresAt;
}

function clearOldDemoData() {
  localStorage.removeItem(STORAGE_KEY);
}

function getDemoMailbox() {
  let data = loadStorage();
  if (!data || !data.mailbox || isExpired(data.mailbox)) {
    data = { mailbox: createDefaultMailbox() };
    saveStorage(data);
  } else if (data.mailbox.address.endsWith('@tempmal.local')) {
    data.mailbox.address = data.mailbox.address.replace('@tempmal.local', `@${MAIL_DOMAIN}`);
    data.mailbox.name = data.mailbox.address.split('@')[0];
    saveStorage(data);
  }
  return data.mailbox;
}

function saveDemoMailbox(mailbox) {
  saveStorage({ mailbox });
}

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `API error: ${response.status}`);
  }
  return response.json();
}

const MailAPI = {
  isDemoMode() {
    return DEMO_MODE;
  },

  getDomain() {
    return MAIL_DOMAIN;
  },

  validateMailboxName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Mailbox name is required.' };
    }
    const trimmed = name.trim().toLowerCase();
    if (trimmed.length < 3) {
      return { valid: false, error: 'Name must be at least 3 characters.' };
    }
    if (trimmed.length > 18) {
      return { valid: false, error: 'Name must be no more than 18 characters.' };
    }
    if (!MAILBOX_NAME_REGEX.test(trimmed)) {
      return { valid: false, error: 'Only letters, numbers, dots, hyphens, and underscores allowed. Cannot start/end with dot or hyphen.' };
    }
    return { valid: true, name: trimmed };
  },

  async createMailbox() {
    if (DEMO_MODE) {
      const mailbox = createDefaultMailbox();
      saveDemoMailbox(mailbox);
      return this.formatMailbox(mailbox);
    }
    return apiRequest('/api/mailbox', { method: 'POST' });
  },

  async getMailbox() {
    if (DEMO_MODE) {
      const mailbox = getDemoMailbox();
      if (isExpired(mailbox)) {
        return this.createMailbox();
      }
      return this.formatMailbox(mailbox);
    }
    return apiRequest('/api/mailbox');
  },

  formatMailbox(mailbox) {
    return {
      id: mailbox.id,
      address: mailbox.address,
      password: mailbox.password,
      createdAt: mailbox.createdAt,
      expiresAt: mailbox.expiresAt,
      lifetimeMinutes: mailbox.lifetimeMinutes,
      expired: isExpired(mailbox)
    };
  },

  async getMessages() {
    if (DEMO_MODE) {
      const mailbox = getDemoMailbox();
      if (isExpired(mailbox)) return [];
      return mailbox.messages.map((m) => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        preview: m.preview,
        date: m.date,
        read: m.read
      })).sort((a, b) => b.date - a.date);
    }
    const data = await apiRequest('/api/messages');
    return data.messages || data;
  },

  async getMessage(messageId) {
    if (DEMO_MODE) {
      const mailbox = getDemoMailbox();
      const msg = mailbox.messages.find((m) => m.id === messageId);
      if (!msg) throw new Error('Message not found');
      msg.read = true;
      saveDemoMailbox(mailbox);
      return {
        id: msg.id,
        from: msg.from,
        to: msg.to || mailbox.address,
        subject: msg.subject,
        body: msg.body,
        bodyText: msg.bodyText,
        date: msg.date,
        read: true,
        attachments: msg.attachments || []
      };
    }
    return apiRequest(`/api/messages/${encodeURIComponent(messageId)}`);
  },

  async deleteMessage(messageId) {
    if (DEMO_MODE) {
      const mailbox = getDemoMailbox();
      mailbox.messages = mailbox.messages.filter((m) => m.id !== messageId);
      saveDemoMailbox(mailbox);
      return { success: true };
    }
    return apiRequest(`/api/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' });
  },

  async deleteMailbox() {
    if (DEMO_MODE) {
      localStorage.removeItem(STORAGE_KEY);
      return this.createMailbox();
    }
    await apiRequest('/api/mailbox', { method: 'DELETE' });
    return this.createMailbox();
  },

  async extendMailbox(minutes) {
    if (DEMO_MODE) {
      const mailbox = getDemoMailbox();
      const now = Date.now();
      mailbox.expiresAt = now + minutes * 60 * 1000;
      mailbox.lifetimeMinutes = minutes;
      saveDemoMailbox(mailbox);
      return this.formatMailbox(mailbox);
    }
    return apiRequest('/api/mailbox/extend', {
      method: 'POST',
      body: JSON.stringify({ minutes })
    });
  },

  async changeMailbox(name) {
    const validation = this.validateMailboxName(name);
    if (!validation.valid) throw new Error(validation.error);

    if (DEMO_MODE) {
      const mailbox = getDemoMailbox();
      mailbox.name = validation.name;
      mailbox.address = `${validation.name}@${MAIL_DOMAIN}`;
      saveDemoMailbox(mailbox);
      return this.formatMailbox(mailbox);
    }
    return apiRequest('/api/mailbox/change', {
      method: 'POST',
      body: JSON.stringify({ name: validation.name })
    });
  },

  async changePassword() {
    if (DEMO_MODE) {
      const mailbox = getDemoMailbox();
      mailbox.password = generatePassword();
      saveDemoMailbox(mailbox);
      return { password: mailbox.password };
    }
    return apiRequest('/api/mailbox/password', { method: 'POST' });
  },

  checkExpiration(mailbox) {
    if (mailbox && isExpired(mailbox)) {
      if (DEMO_MODE) {
        localStorage.removeItem(STORAGE_KEY);
      }
      return true;
    }
    return false;
  }
};

window.MailAPI = MailAPI;
