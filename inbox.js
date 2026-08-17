/**
 * TempMal — Inbox Module
 */

const Inbox = {
  currentMessageId: null,

  init() {
    if (!document.getElementById('inbox-container')) return;

    document.getElementById('btn-refresh-inbox')?.addEventListener('click', () => {
      this.refresh();
      App.resetRefreshCountdown();
    });
    document.getElementById('btn-back-inbox')?.addEventListener('click', () => this.showList());
    document.getElementById('btn-delete-message')?.addEventListener('click', () => this.deleteCurrentMessage());
  },

  async refresh(silent = false) {
    const loading = document.getElementById('inbox-loading');
    const empty = document.getElementById('inbox-empty');
    const table = document.getElementById('inbox-table');
    const errorEl = document.getElementById('inbox-error');
    const tbody = document.getElementById('inbox-tbody');
    const refreshBtn = document.getElementById('btn-refresh-inbox');

    if (!silent) {
      loading.hidden = false;
      errorEl.hidden = true;
      refreshBtn?.classList.add('refreshing');
    }

    try {
      const messages = await MailAPI.getMessages();
      loading.hidden = true;
      refreshBtn?.classList.remove('refreshing');

      if (messages.length === 0) {
        empty.hidden = false;
        table.hidden = true;
      } else {
        empty.hidden = true;
        table.hidden = false;
        this.renderMessages(messages, tbody);
      }
    } catch (err) {
      loading.hidden = true;
      refreshBtn?.classList.remove('refreshing');
      if (!silent) {
        errorEl.textContent = err.message || 'Failed to load messages. Please try again.';
        errorEl.hidden = false;
      }
    }
  },

  renderMessages(messages, tbody) {
    tbody.textContent = '';
    messages.forEach((msg) => {
      const tr = document.createElement('tr');
      tr.setAttribute('role', 'button');
      tr.setAttribute('tabindex', '0');
      tr.setAttribute('aria-label', `Email from ${msg.from}: ${msg.subject}`);
      if (!msg.read) tr.classList.add('unread');

      const tdFrom = document.createElement('td');
      tdFrom.className = 'msg-from';
      tdFrom.textContent = msg.from;

      const tdSubject = document.createElement('td');
      tdSubject.className = 'msg-subject';
      const subjectSpan = document.createElement('span');
      subjectSpan.textContent = msg.subject;
      tdSubject.appendChild(subjectSpan);
      if (msg.preview) {
        const preview = document.createElement('span');
        preview.className = 'msg-preview';
        preview.textContent = msg.preview;
        tdSubject.appendChild(preview);
      }

      const tdTime = document.createElement('td');
      tdTime.className = 'col-time';
      tdTime.textContent = this.formatTime(msg.date);

      tr.appendChild(tdFrom);
      tr.appendChild(tdSubject);
      tr.appendChild(tdTime);

      tr.addEventListener('click', () => this.openMessage(msg.id));
      tr.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openMessage(msg.id);
        }
      });

      tbody.appendChild(tr);
    });
  },

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins} min. ago`;
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hr. ago`;
    }

    return date.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  },

  async openMessage(messageId) {
    try {
      const msg = await MailAPI.getMessage(messageId);
      this.currentMessageId = messageId;
      this.showReader(msg);
      this.refresh(true);
    } catch (err) {
      App.showToast(err.message || 'Failed to load message', 'error');
    }
  },

  showReader(msg) {
    document.getElementById('inbox-list-view').hidden = true;
    const reader = document.getElementById('message-reader');
    reader.hidden = false;

    document.getElementById('reader-subject').textContent = msg.subject;
    document.getElementById('reader-from').textContent = msg.from;
    document.getElementById('reader-to').textContent = msg.to;
    document.getElementById('reader-date').textContent = new Date(msg.date).toLocaleString();

    const bodyEl = document.getElementById('reader-body');
    bodyEl.textContent = '';
    if (msg.body) {
      bodyEl.innerHTML = App.sanitizeHTML(msg.body);
    } else if (msg.bodyText) {
      const p = document.createElement('p');
      p.textContent = msg.bodyText;
      bodyEl.appendChild(p);
    }

    const attachEl = document.getElementById('reader-attachments');
    const attachList = document.getElementById('attachments-list');
    attachList.textContent = '';

    if (msg.attachments && msg.attachments.length > 0) {
      attachEl.hidden = false;
      msg.attachments.forEach((att) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = att.url || '#';
        a.textContent = att.name || 'Attachment';
        a.setAttribute('download', att.name || '');
        if (att.url) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        }
        li.appendChild(a);
        attachList.appendChild(li);
      });
    } else {
      attachEl.hidden = true;
    }
  },

  showList() {
    document.getElementById('message-reader').hidden = true;
    document.getElementById('inbox-list-view').hidden = false;
    this.currentMessageId = null;
  },

  async deleteCurrentMessage() {
    if (!this.currentMessageId) return;
    try {
      await MailAPI.deleteMessage(this.currentMessageId);
      this.showList();
      this.refresh();
      App.showToast('Message deleted', 'success');
    } catch (err) {
      App.showToast(err.message || 'Failed to delete message', 'error');
    }
  }
};

window.Inbox = Inbox;
