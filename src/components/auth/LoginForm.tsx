'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { Spinner } from '@/components/ui/spinner';
import { useTranslations } from 'next-intl';

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: '500',
  display: 'swap',
});

export function LoginForm() {
  const router = useRouter();
  const t = useTranslations('Login');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState('');
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isSubmitting = useRef(false);

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'session_expired') {
      setSessionExpiredMsg(t('sessionExpired'));
    }
  }, [t]);

  const handlePinChange = (value: string) => {
    setPin(value.replace(/\D/g, '').slice(0, 4));
  };

  const handlePinDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '');
    if (!digit && value === '') {
      const newPin = pin.slice(0, index) + pin.slice(index + 1);
      handlePinChange(newPin);
      if (index > 0) pinRefs.current[index - 1]?.focus();
      return;
    }
    if (!digit) return;

    const char = digit[0];
    const before = pin.slice(0, index);
    const after = pin.slice(index + 1);
    const newPin = before + char + after;
    handlePinChange(newPin);

    if (index < 3) {
      pinRefs.current[index + 1]?.focus();
    }

    if (newPin.length === 4) {
      if (!name.trim()) {
        setError(t('errorNameRequired'));
      } else {
        executeLogin(name, newPin);
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      e.preventDefault();
      const newPin = pin.slice(0, index - 1) + pin.slice(index);
      handlePinChange(newPin);
      pinRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      pinRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 3) {
      e.preventDefault();
      pinRefs.current[index + 1]?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    handlePinChange(pasted);
    const focusIndex = Math.min(pasted.length, 3);
    pinRefs.current[focusIndex]?.focus();

    if (pasted.length === 4) {
      if (!name.trim()) {
        setError(t('errorNameRequired'));
      } else {
        executeLogin(name, pasted);
      }
    }
  };

  const executeLogin = async (currentName: string, currentPin: string) => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setLoading(true);
    setError('');

    if (!currentName.trim()) {
      setError(t('errorEnterName'));
      setLoading(false);
      isSubmitting.current = false;
      return;
    }
    if (currentPin.length !== 4) {
      setError(t('errorPinRequired'));
      setLoading(false);
      isSubmitting.current = false;
      return;
    }

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: currentName.trim(), pin: currentPin }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? t('errorGeneric'));
        setPin('');
        pinRefs.current[0]?.focus();
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError(t('errorNetwork'));
      setPin('');
      pinRefs.current[0]?.focus();
    } finally {
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    executeLogin(name, pin);
  };

  return (
    <>
      <style>{loginStyles}</style>
      <div className={`login-page-split ${mounted ? 'visible' : ''}`}>
        
        {/* LEFT PANEL: Decorative Dark Futuristic Panel */}
        <div className="left-panel">
          <div className="left-panel-grid" aria-hidden="true" />
          <div className="left-panel-glow" aria-hidden="true" />
          
          {/* Subtle Decorative Corner Brackets */}
          <div className="left-panel-decor-x" aria-hidden="true" />
          <div className="left-panel-decor-y" aria-hidden="true" />

          <div className="left-panel-content">
            {/* Glowing Logo Rings */}
            <div className="logo-halo-ring">
              <div className="logo-dashed-ring animate-spin-slow" />
              <div className="logo-viewport">
                <img
                  src="/brand/al-maraghi-icon-black.png"
                  alt={t('logoAlt')}
                  width="56"
                  height="56"
                  className="logo-img"
                />
              </div>
            </div>

            {/* Brand Title */}
            <div className="left-brand-group">
              <h1 className="left-brand-title">{t('brandName')}</h1>
              <span className="left-brand-sub">AL MARAGHI</span>
            </div>

            {/* Accent Divider */}
            <div className="left-divider" />

            {/* Tagline */}
            <div className="left-tagline">
              <span className="tagline-en">You matter</span>
              <span className="tagline-dot" />
              <span className={`tagline-ar ${ibmPlexArabic.className}`} dir="rtl" lang="ar">
                مُهِمَّك
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Form Input Panel */}
        <div className="right-panel">
          <div className="right-panel-content">
            
            {/* Session Expired Banner */}
            {sessionExpiredMsg && (
              <div className="banner-alert banner-alert-warning" role="status">
                <svg className="banner-icon" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>{sessionExpiredMsg}</span>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="banner-alert banner-alert-error" role="alert">
                <svg className="banner-icon" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Form Card */}
            <div className="form-card">
              <div className="form-header">
                <h2 className="form-title">{t('staffSignIn')}</h2>
              </div>

              <form onSubmit={handleLogin} className="form-element" autoComplete="off">
                
                {/* Name Input */}
                <div className="form-group">
                  <label htmlFor="login-name" className="form-label">
                    {t('labelYourName')}
                  </label>
                  <div className="form-input-wrapper">
                    <input
                      id="login-name"
                      type="text"
                      autoComplete="off"
                      placeholder={t('placeholderEnterName')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="form-input"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* PIN Input */}
                <div className="form-group">
                  <label className="form-label" id="pin-label">
                    {t('labelPin')}
                  </label>
                  
                  <div
                    className="pin-dots-container"
                    role="group"
                    aria-labelledby="pin-label"
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`pin-dot-wrapper ${pin[i] ? 'filled' : ''}`}
                      >
                        <input
                          ref={(el) => { pinRefs.current[i] = el; }}
                          id={`login-pin-${i}`}
                          type="password"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={1}
                          aria-label={t('ariaPinDigit', { digit: i + 1 })}
                          value={pin[i] ?? ''}
                          onChange={(e) => handlePinDigit(i, e.target.value)}
                          onKeyDown={(e) => handlePinKeyDown(i, e)}
                          onPaste={i === 0 ? handlePinPaste : undefined}
                          className="pin-hidden-input"
                          required={i === 0}
                          disabled={loading}
                        />
                        <div className="pin-dot-visual" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="form-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <Spinner size="md" />
                  ) : (
                    <span className="submit-btn-text">{t('btnSignIn')}</span>
                  )}
                </button>

              </form>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

const loginStyles = /* css */ `
  .login-page-split {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    width: 100%;
    background-color: #0b0f19;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    opacity: 0;
    transition: opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .login-page-split.visible {
    opacity: 1;
  }

  @media (min-width: 768px) {
    .login-page-split {
      flex-direction: row;
    }
  }

  /* ═══ LEFT PANEL (LIGHT SCHEME) ═══ */
  .left-panel {
    width: 100%;
    min-height: 360px;
    background: radial-gradient(circle at 30% 30%, #ffffff 0%, #f8fafc 100%);
    position: relative;
    overflow: visible;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    color: #0f172a;
  }

  @media (min-width: 768px) {
    .left-panel {
      width: 42%;
      min-height: 100vh;
    }
  }

  .left-panel-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(79, 70, 229, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(79, 70, 229, 0.05) 1px, transparent 1px);
    background-size: 30px 30px;
    background-position: center;
    mask-image: radial-gradient(circle at 50% 50%, black 50%, transparent 95%);
    pointer-events: none;
  }

  .left-panel-glow {
    position: absolute;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(79, 70, 229, 0.08) 0%, transparent 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  /* Decorative futuristic corner ticks */
  .left-panel-decor-x {
    position: absolute;
    top: 20px;
    left: 20px;
    width: 15px;
    height: 15px;
    border-top: 1px solid rgba(79, 70, 229, 0.2);
    border-left: 1px solid rgba(79, 70, 229, 0.2);
  }
  .left-panel-decor-y {
    position: absolute;
    bottom: 20px;
    right: 20px;
    width: 15px;
    height: 15px;
    border-bottom: 1px solid rgba(79, 70, 229, 0.2);
    border-right: 1px solid rgba(79, 70, 229, 0.2);
  }

  .left-panel-content {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  /* Logo Halo Treatment */
  .logo-halo-ring {
    position: relative;
    width: 130px;
    height: 130px;
    border-radius: 50%;
    background: rgba(79, 70, 229, 0.04);
    border: 1px solid rgba(79, 70, 229, 0.18);
    box-shadow: 
      0 0 30px rgba(79, 70, 229, 0.1),
      inset 0 0 20px rgba(79, 70, 229, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.4s ease;
  }

  .logo-halo-ring:hover {
    transform: scale(1.03);
    border-color: rgba(79, 70, 229, 0.35);
  }

  .logo-dashed-ring {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 1px dashed rgba(79, 70, 229, 0.25);
  }

  .logo-viewport {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: rgba(79, 70, 229, 0.04);
    border: 1px solid rgba(79, 70, 229, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
  }

  .logo-img {
    width: 56px;
    height: 56px;
    object-fit: contain;
    display: block;
  }

  /* Brand names */
  .left-brand-group {
    margin-top: 1.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .left-brand-title {
    font-size: 2.25rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #0f172a;
    line-height: 1.1;
    margin: 0;
  }

  .left-brand-sub {
    font-size: 0.7rem;
    font-weight: 600;
    color: #64748b;
    letter-spacing: 0.3em;
    margin-top: 0.35rem;
  }

  /* Divider */
  .left-divider {
    width: 40px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(79, 70, 229, 0.3), transparent);
    margin: 1.5rem 0;
  }

  /* Tagline */
  .left-tagline {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.85rem;
    color: #64748b;
  }

  .tagline-en {
    font-weight: 400;
  }

  .tagline-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background-color: rgba(79, 70, 229, 0.6);
  }

  .tagline-ar {
    font-size: 0.9rem;
    font-weight: 500;
  }

  /* ═══ RIGHT PANEL (DARK SCHEME) ═══ */
  .right-panel {
    width: 100%;
    background-color: #0b0f19;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3.5rem 1.5rem;
    min-height: 100vh;
    min-height: 100dvh;
    flex: 1;
  }

  @media (min-width: 768px) {
    .right-panel {
      width: 58%;
      min-height: 100vh;
      min-height: 100dvh;
      background-color: #0b0f19;
      flex: none;
    }
  }

  .right-panel-content {
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Form Card (Dark Mode) */
  .form-card {
    background-color: #111827;
    border: 1px solid #1f2937;
    border-radius: 16px;
    padding: 2.25rem 2rem;
    box-shadow: 
      0 10px 25px -5px rgba(0, 0, 0, 0.5), 
      0 8px 10px -6px rgba(0, 0, 0, 0.5);
  }

  .form-header {
    margin-bottom: 2rem;
    text-align: center;
  }

  .form-title {
    font-size: 1.35rem;
    font-weight: 700;
    color: #f8fafc;
    letter-spacing: -0.01em;
    margin: 0;
  }

  .form-subtitle {
    font-size: 0.85rem;
    color: #9ca3af;
    margin-top: 0.4rem;
  }

  .form-element {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #9ca3af;
    letter-spacing: 0.02em;
  }

  /* Input fields */
  .form-input-wrapper {
    position: relative;
    width: 100%;
  }

  .form-input {
    width: 100%;
    height: 44px;
    padding: 0 1rem;
    border-radius: 8px;
    border: 1px solid #1f2937;
    background-color: #1f2937;
    color: #f8fafc;
    font-size: 0.95rem;
    outline: none;
    transition: all 0.2s ease;
  }

  .form-input:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .form-input:disabled {
    background-color: #111827;
    color: #4b5563;
    cursor: not-allowed;
  }

  /* PIN Dots Container */
  .pin-dots-container {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    width: 100%;
    margin: 0.25rem 0;
  }

  .pin-dot-wrapper {
    position: relative;
    aspect-ratio: 1;
    border-radius: 50%;
    border: 2px solid #1f2937;
    background-color: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .pin-dot-wrapper.filled {
    background-color: #6366f1;
    border-color: #6366f1;
    box-shadow: 0 0 12px rgba(99, 102, 241, 0.35);
    transform: scale(1.05);
  }

  .pin-dot-wrapper:focus-within {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .pin-hidden-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    caret-color: transparent;
    text-align: center;
    z-index: 10;
  }

  .pin-dot-visual {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #9ca3af;
    transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .pin-dot-wrapper.filled .pin-dot-visual {
    background-color: #ffffff;
    transform: scale(1.1);
  }

  .form-help-text {
    font-size: 0.75rem;
    color: #9ca3af;
    margin-top: 0.25rem;
  }

  /* Submit Button */
  .form-submit-btn {
    width: 100%;
    height: 46px;
    border-radius: 8px;
    background-color: #6366f1;
    color: white;
    border: none;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    margin-top: 0.5rem;
  }

  .form-submit-btn:hover:not(:disabled) {
    background-color: #4f46e5;
  }

  .form-submit-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .form-submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Banners */
  .banner-alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 500;
    line-height: 1.4;
  }

  .banner-icon {
    flex-shrink: 0;
    margin-top: 0.1rem;
  }

  .banner-alert-warning {
    background-color: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    color: #fbbf24;
  }

  .banner-alert-error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #f87171;
  }

  /* Footer Info */
  .right-panel-footer {
    text-align: center;
    font-size: 0.75rem;
    color: #9ca3af;
    margin-top: 0.5rem;
  }

  @keyframes spin-slow {
    to { transform: rotate(360deg); }
  }
`;
