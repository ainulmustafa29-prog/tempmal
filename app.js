/**
 * TempMal — Main Application
 */

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const App = {
  mailbox: null,
  lifetimeTimer: null,
  refreshCountdownTimer: null,
  refreshCountdown: 10,
  editModal: null,
  deleteModal: null,

  async init() {
    await this.loadComponents();
    this.setActiveNav();
    this.setFooterYear();

    if (document.getElementById('mail-tool')) {
      await this.initMailTool();
      Inbox.init();
    }
  },

  async loadComponents() {
    const headerEl = document.getElementById('header-placeholder');
    const footerEl = document.getElementById('footer-placeholder');

    const loads = [];
    if (headerEl) {
      loads.push(
        fetch('components/header.html')
          .then((r) => r.text())
          .then((html) => { headerEl.innerHTML = html; })
          .catch(() => { headerEl.innerHTML = '<header><nav><a href="index.html">TempMal</a></nav></header>'; })
      );
    }
    if (footerEl) {
      loads.push(
        fetch('components/footer.html')
          .then((r) => r.text())
          .then((html) => { footerEl.innerHTML = html; })
          .catch(() => {})
      );
    }
    await Promise.all(loads);
    this.setActiveNav();
    this.setFooterYear();
  },

  setActiveNav() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link[data-nav]').forEach((link) => {
      const href = link.getAttribute('href');
      if (href === page || (page === '' && href === 'index.html')) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
  },

  setFooterYear() {
    const el = document.getElementById('footer-year');
    if (el) el.textContent = new Date().getFullYear();
  },

  async initMailTool() {
    try {
      MailAPI.clearOldDemoData();
    } catch (e) {
      console.warn('Could not clear old demo data:', e);
    }

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      this.editModal = new bootstrap.Modal(document.getElementById('editEmailModal'));
      this.deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    }

    document.getElementById('btn-copy-email')?.addEventListener('click', () => this.copyEmail());
    document.getElementById('btn-copy-password')?.addEventListener('click', () => this.copyPassword());
    document.getElementById('btn-change-password')?.addEventListener('click', () => this.changePassword());
    document.getElementById('btn-edit-email')?.addEventListener('click', () => this.openEditModal());
    document.getElementById('btn-confirm-edit')?.addEventListener('click', () => this.confirmEdit());
    document.getElementById('btn-delete-mailbox')?.addEventListener('click', () => { if (this.deleteModal) this.deleteModal.show(); });
    document.getElementById('btn-confirm-delete')?.addEventListener('click', () => this.confirmDelete());
    document.getElementById('btn-refresh-mailbox')?.addEventListener('click', () => this.refreshMailbox());

    document.querySelectorAll('.btn-lifetime').forEach((btn) => {
      btn.addEventListener('click', () => {
        const minutes = parseInt(btn.dataset.minutes, 10);
        this.extendLifetime(minutes);
      });
    });

    const domainSuffix = document.getElementById('edit-domain-suffix');
    if (domainSuffix) domainSuffix.textContent = `@${MailAPI.getDomain()}`;

    try {
      this.mailbox = await MailAPI.getMailbox();
    } catch (err) {
      console.error('getMailbox failed:', err);
      this.showToast(err.message || 'Failed to load mailbox', 'error');
    }

    if (!this.mailbox) {
      try {
        this.mailbox = await MailAPI.createMailbox();
      } catch (err) {
        console.error('createMailbox failed:', err);
        this.showToast('Unable to create mailbox. Please refresh.', 'error');
      }
    }

    if (this.mailbox) {
      this.updateUI();
      this.startLifetimeTimer();
      this.startRefreshCountdown();
      Inbox.refresh(true);
    }
  },

  updateUI() {
    if (!this.mailbox) return;

    const emailInput = document.getElementById('email-address');
    const passwordInput = document.getElementById('mailbox-password');

    if (emailInput && this.mailbox.address) {
      emailInput.value = this.mailbox.address;
    }
    if (passwordInput && this.mailbox.password) {
      passwordInput.value = this.mailbox.password;
    }

    this.updateLifetimeDisplay();
    this.updateLifetimeButtons();
  },

  startRefreshCountdown() {
    if (this.refreshCountdownTimer) clearInterval(this.refreshCountdownTimer);
    this.refreshCountdown = 10;
    this.updateRefreshCountdownDisplay();

    this.refreshCountdownTimer = setInterval(async () => {
      this.refreshCountdown -= 1;
      if (this.refreshCountdown <= 0) {
        this.refreshCountdown = 10;
        await this.autoRefreshMailbox();
      }
      this.updateRefreshCountdownDisplay();
    }, 1000);
  },

  updateRefreshCountdownDisplay() {
    const mailboxEl = document.getElementById('mailbox-refresh-countdown');
    const inboxEl = document.getElementById('inbox-refresh-countdown');
    if (mailboxEl) mailboxEl.textContent = String(this.refreshCountdown);
    if (inboxEl) inboxEl.textContent = String(this.refreshCountdown);
  },

  resetRefreshCountdown() {
    this.refreshCountdown = 10;
    this.updateRefreshCountdownDisplay();
  },

  async autoRefreshMailbox() {
    try {
      this.mailbox = await MailAPI.getMailbox();
      this.updateUI();
      if (document.getElementById('message-reader')?.hidden !== false) {
        await Inbox.refresh(true);
      }
    } catch {
      /* silent auto-refresh failure */
    }
  },

  formatCountdown(remainingMs) {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  },

  updateLifetimeDisplay() {
    const el = document.getElementById('lifetime-display');
    if (!el || !this.mailbox) return;

    const remaining = this.mailbox.expiresAt - Date.now();
    if (remaining <= 0) {
      el.textContent = 'Expired';
      el.classList.add('expiring-soon');
      return;
    }

    el.textContent = this.formatCountdown(remaining);
    const minutes = Math.floor(remaining / 60000);
    el.classList.toggle('expiring-soon', minutes <= 30);
  },

  updateLifetimeButtons() {
    if (!this.mailbox) return;
    document.querySelectorAll('.btn-lifetime').forEach((btn) => {
      const mins = parseInt(btn.dataset.minutes, 10);
      btn.classList.toggle('active', mins === this.mailbox.lifetimeMinutes);
    });
  },

  startLifetimeTimer() {
    if (this.lifetimeTimer) clearInterval(this.lifetimeTimer);
    this.lifetimeTimer = setInterval(async () => {
      if (MailAPI.checkExpiration(this.mailbox)) {
        this.showToast('Mailbox expired. Creating a new one...', 'error');
        this.mailbox = await MailAPI.createMailbox();
        this.updateUI();
        Inbox.showList();
        Inbox.refresh();
        return;
      }
      this.updateLifetimeDisplay();
    }, 1000);
    this.updateLifetimeDisplay();
  },

  async copyEmail() {
    if (!this.mailbox) return;
    await this.copyToClipboard(this.mailbox.address, 'btn-copy-email');
  },

  async copyPassword() {
    if (!this.mailbox) return;
    await this.copyToClipboard(this.mailbox.password, 'btn-copy-password');
  },

  async copyToClipboard(text, btnId) {
    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById(btnId);
      if (btn) {
        const original = btn.querySelector('span')?.textContent || btn.textContent;
        if (btn.querySelector('span')) {
          btn.querySelector('span').textContent = 'Copied!';
        } else {
          btn.textContent = 'Copied!';
        }
        setTimeout(() => {
          if (btn.querySelector('span')) {
            btn.querySelector('span').textContent = original;
          } else {
            btn.textContent = original;
          }
        }, 2000);
      }
      this.showToast('Copied!', 'success');
    } catch {
      this.showToast('Failed to copy. Please select and copy manually.', 'error');
    }
  },

  async changePassword() {
    try {
      const result = await MailAPI.changePassword();
      if (this.mailbox) this.mailbox.password = result.password;
      document.getElementById('mailbox-password').value = result.password;
      this.showToast('Password changed', 'success');
    } catch (err) {
      this.showToast(err.message || 'Failed to change password', 'error');
    }
  },

  openEditModal() {
    const input = document.getElementById('edit-mailbox-name');
    const error = document.getElementById('edit-name-error');
    if (this.mailbox) {
      const name = this.mailbox.address.split('@')[0];
      input.value = name;
    }
    input.classList.remove('is-invalid');
    error.textContent = '';
    if (this.editModal) this.editModal.show();
    setTimeout(() => input.focus(), 300);
  },

  async confirmEdit() {
    const input = document.getElementById('edit-mailbox-name');
    const error = document.getElementById('edit-name-error');
    const name = input.value.trim();

    const validation = MailAPI.validateMailboxName(name);
    if (!validation.valid) {
      input.classList.add('is-invalid');
      error.textContent = validation.error;
      return;
    }

    try {
      this.mailbox = await MailAPI.changeMailbox(name);
      this.updateUI();
      if (this.editModal) this.editModal.hide();
      Inbox.showList();
      Inbox.refresh();
      this.showToast('Email address updated', 'success');
    } catch (err) {
      input.classList.add('is-invalid');
      error.textContent = err.message || 'Failed to change address';
    }
  },

  async confirmDelete() {
    try {
      this.mailbox = await MailAPI.deleteMailbox();
      this.updateUI();
      if (this.deleteModal) this.deleteModal.hide();
      Inbox.showList();
      Inbox.refresh();
      this.showToast('New mailbox created', 'success');
    } catch (err) {
      this.showToast(err.message || 'Failed to delete mailbox', 'error');
    }
  },

  async extendLifetime(minutes) {
    try {
      this.mailbox = await MailAPI.extendMailbox(minutes);
      this.updateUI();
      this.updateLifetimeDisplay();
      this.showToast(`Lifetime set to ${this.formatLifetimeLabel(minutes)}`, 'success');
    } catch (err) {
      this.showToast(err.message || 'Failed to update lifetime', 'error');
    }
  },

  formatLifetimeLabel(minutes) {
    if (minutes < 60) return `${minutes} minutes`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hours`;
    if (minutes < 10080) return `${Math.floor(minutes / 1440)} days`;
    return `${Math.floor(minutes / 10080)} weeks`;
  },

  async refreshMailbox() {
    try {
      this.mailbox = await MailAPI.getMailbox();
      this.updateUI();
      this.resetRefreshCountdown();
      await Inbox.refresh();
      this.showToast('Mailbox refreshed', 'success');
    } catch (err) {
      this.showToast(err.message || 'Failed to refresh', 'error');
    }
  },

  sanitizeHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const allowedTags = new Set(['P', 'BR', 'STRONG', 'EM', 'B', 'I', 'U', 'A', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'PRE', 'CODE', 'SPAN', 'DIV', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
    const allowedAttrs = { A: ['href', 'title'], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan'] };

    function clean(node) {
      const children = [...node.childNodes];
      children.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (!allowedTags.has(child.tagName)) {
            while (child.firstChild) child.parentNode.insertBefore(child.firstChild, child);
            child.remove();
            return;
          }
          [...child.attributes].forEach((attr) => {
            const allowed = allowedAttrs[child.tagName];
            if (!allowed || !allowed.includes(attr.name.toLowerCase())) {
              child.removeAttribute(attr.name);
            }
          });
          if (child.tagName === 'A') {
            const href = child.getAttribute('href') || '';
            if (/^javascript:/i.test(href) || /^data:/i.test(href)) {
              child.removeAttribute('href');
            }
            child.setAttribute('rel', 'noopener noreferrer');
            child.setAttribute('target', '_blank');
          }
          clean(child);
        }
      });
    }

    clean(template.content);
    const wrapper = document.createElement('div');
    wrapper.appendChild(template.content);
    return wrapper.innerHTML;
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.setAttribute('role', 'alert');
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
