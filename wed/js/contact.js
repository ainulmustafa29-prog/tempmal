/**
 * TempMal — Contact Form Module
 */

const ContactForm = {
  init() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit(form);
    });

    form.querySelectorAll('input, textarea').forEach((field) => {
      field.addEventListener('input', () => {
        field.classList.remove('is-invalid');
      });
    });
  },

  validate(form) {
    let valid = true;
    const name = form.querySelector('#contact-name');
    const email = form.querySelector('#contact-email');
    const message = form.querySelector('#contact-message');

    if (!name.value.trim() || name.value.trim().length < 2) {
      this.showFieldError(name, 'name-error', 'Please enter your name (at least 2 characters).');
      valid = false;
    }

    const emailVal = email.value.trim();
    if (!emailVal || !this.isValidEmail(emailVal)) {
      this.showFieldError(email, 'email-error', 'Please enter a valid email address.');
      valid = false;
    }

    if (!message.value.trim() || message.value.trim().length < 10) {
      this.showFieldError(message, 'message-error', 'Please enter a message (at least 10 characters).');
      valid = false;
    }

    return valid;
  },

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  showFieldError(field, errorId, msg) {
    field.classList.add('is-invalid');
    const errorEl = document.getElementById(errorId);
    if (errorEl) errorEl.textContent = msg;
  },

  async handleSubmit(form) {
    const feedback = document.getElementById('contact-feedback');
    const submitBtn = document.getElementById('contact-submit');

    form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
    feedback.hidden = true;

    if (!this.validate(form)) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    await new Promise((resolve) => setTimeout(resolve, 1000));

    feedback.textContent = 'Thank you! Your message has been sent. We will get back to you soon.';
    feedback.className = 'contact-feedback success';
    feedback.hidden = false;

    form.reset();
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Message';
  }
};

document.addEventListener('DOMContentLoaded', () => ContactForm.init());
