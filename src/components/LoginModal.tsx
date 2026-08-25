/**
 * LoginModal — PulseCare demo auth gate
 *
 * Step 1: role selector + credential input  →  Send OTP
 * Step 2: 6-box OTP entry (demo OTP: 123456)  →  Verify & Sign In
 *
 * Bug fixes vs previous version:
 *  - OTP digit array is now built as a fixed-length Array(6) so padEnd
 *    with an empty string can never silently truncate the array.
 *  - handleVerifyOtp compares the raw joined digits, not a stripped copy,
 *    removing any risk of whitespace contamination.
 *  - "Fill Demo OTP" button auto-fills and immediately calls login so
 *    testers never have to touch the digit boxes.
 *  - "Skip / Instant Demo Login" at the bottom bypasses both steps in
 *    one click for rapid testing.
 */

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react';
import type { UserRole, AuthUser } from '../types';
import { useAuth } from '../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEMO_OTP = '123456';
const OTP_LENGTH = 6;

const ROLES: { value: UserRole; label: string; icon: string; activeClass: string }[] = [
  { value: 'Doctor', label: 'Doctor', icon: '🩺', activeClass: 'border-teal-500 bg-teal-50 text-teal-800' },
  { value: 'Nurse', label: 'Nurse', icon: '💊', activeClass: 'border-blue-500 bg-blue-50 text-blue-800' },
  { value: 'Hospital Admin', label: 'Hospital Admin', icon: '🏥', activeClass: 'border-purple-500 bg-purple-50 text-purple-800' },
];

const ROLE_TITLES: Record<UserRole, string> = {
  Doctor: 'Dr.',
  Nurse: 'Nurse',
  'Hospital Admin': 'Admin',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert an arbitrary string into a fixed-length array of single chars.
 *  Positions beyond the string length are filled with ''. */
function toDigitArray(value: string): string[] {
  const arr = Array<string>(OTP_LENGTH).fill('');
  for (let i = 0; i < Math.min(value.length, OTP_LENGTH); i++) {
    arr[i] = value[i];
  }
  return arr;
}

// ─── OtpInput component ───────────────────────────────────────────────────────

interface OtpInputProps {
  value: string;       // always a raw string of digits, no padding
  onChange: (v: string) => void;
  hasError: boolean;
}

function OtpInput({ value, onChange, hasError }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // Build a stable fixed-length array from value
  const digits = toDigitArray(value);

  const focus = (i: number) => refs.current[i]?.focus();

  function handleChange(i: number, raw: string) {
    // Keep only the last digit typed (handles autofill / rapid input)
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = digit;
    onChange(next.join(''));
    if (digit && i < OTP_LENGTH - 1) focus(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) {
        // Clear current box
        const next = [...digits];
        next[i] = '';
        onChange(next.join(''));
      } else if (i > 0) {
        // Move back and clear previous box
        const next = [...digits];
        next[i - 1] = '';
        onChange(next.join(''));
        focus(i - 1);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focus(i - 1);
    } else if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) {
      focus(i + 1);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(pasted); // raw string — toDigitArray handles rendering
    focus(Math.min(pasted.length, OTP_LENGTH - 1));
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          aria-label={`OTP digit ${i + 1}`}
          className={[
            'w-11 h-12 text-center text-xl font-bold rounded-lg border-2 outline-none transition-all select-none',
            hasError
              ? 'border-red-400 bg-red-50 text-red-600'
              : d
                ? 'border-teal-500 bg-teal-50 text-teal-700'
                : 'border-gray-200 bg-gray-50 text-gray-900 focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

// ─── Main LoginModal ──────────────────────────────────────────────────────────

export function LoginModal() {
  const { login } = useAuth();

  // ── Step 1 state ────────────────────────────────────────────────────────
  const [role, setRole] = useState<UserRole | null>(null);
  const [credential, setCredential] = useState('');
  const [credError, setCredError] = useState('');

  // ── Step 2 state ────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ── Core login action — single source of truth ───────────────────────────
  const doLogin = useCallback((overrideRole?: UserRole, overrideName?: string) => {
    const resolvedRole = overrideRole ?? role ?? 'Doctor';
    const resolvedId = (overrideName ?? credential.trim()) || 'demo-user';
    const title = ROLE_TITLES[resolvedRole];

    const user: AuthUser = {
      id: resolvedId,
      name: `${title} ${resolvedId}`,
      role: resolvedRole,
      loginAt: new Date().toISOString(),
    };

    login(user); // writes to localStorage + sets React state → App re-renders immediately
  }, [role, credential, login]);

  // ── Step 1: validate + advance to OTP step ───────────────────────────────
  function handleSendOtp() {
    if (!role) { setCredError('Please select a role.'); return; }
    if (!credential.trim()) { setCredError('Please enter your Mobile Number or Staff ID.'); return; }
    if (credential.trim().length < 4) { setCredError('Must be at least 4 characters.'); return; }

    setCredError('');
    setOtp('');
    setOtpError(false);
    setResendCooldown(30);
    setStep(2);
  }

  // ── Step 2: verify OTP ───────────────────────────────────────────────────
  function handleVerifyOtp() {
    const entered = otp.trim();
    if (entered !== DEMO_OTP) {
      setOtpError(true);
      setOtp('');   // clear boxes so user can retype immediately
      setTimeout(() => setOtpError(false), 800);
      return;
    }
    doLogin();
  }

  // ── Fill demo OTP + verify in one action ─────────────────────────────────
  function handleFillAndVerify() {
    setOtp(DEMO_OTP);
    // Call doLogin directly — no need to wait for setState to settle
    doLogin();
  }

  // ── Instant demo bypass ──────────────────────────────────────────────────
  function handleInstantDemo() {
    doLogin('Doctor', 'demo-user');
  }

  // ── Resend ───────────────────────────────────────────────────────────────
  function handleResend() {
    if (resendCooldown > 0) return;
    setOtp('');
    setOtpError(false);
    setResendCooldown(30);
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const otpComplete = otp.trim().length === OTP_LENGTH;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* ── Header ── */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 pt-8 pb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-teal-400 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">PulseCare</h1>
                <p className="text-slate-400 text-xs">Clinical Resource Network</p>
              </div>
            </div>
            <p className="text-white font-semibold text-lg">
              {step === 1 ? 'Sign in to your account' : 'Enter verification code'}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {step === 1
                ? 'Select your role and enter your credentials'
                : `OTP sent to ${credential.trim()}`}
            </p>
          </div>

          {/* ── Step indicator ── */}
          <div className="flex items-center px-8 py-3 bg-slate-50 border-b border-gray-100">
            {([1, 2] as const).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={[
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  step === s ? 'bg-teal-500 text-white'
                    : step > s ? 'bg-teal-200 text-teal-700'
                      : 'bg-gray-200 text-gray-500',
                ].join(' ')}>
                  {step > s ? '✓' : s}
                </div>
                <span className={`text-xs font-medium ${step >= s ? 'text-gray-700' : 'text-gray-400'}`}>
                  {s === 1 ? 'Credentials' : 'Verify OTP'}
                </span>
                {s < 2 && <div className="w-8 h-px bg-gray-300 mx-3" />}
              </div>
            ))}
          </div>

          <div className="p-8">
            {step === 1 ? (
              /* ════════════════ STEP 1 ════════════════ */
              <div className="space-y-5">

                {/* Role selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => { setRole(r.value); setCredError(''); }}
                        className={[
                          'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all duration-150',
                          role === r.value
                            ? `${r.activeClass} shadow-sm scale-[1.02]`
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100',
                        ].join(' ')}
                      >
                        <span className="text-xl">{r.icon}</span>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Credential input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mobile Number or Staff ID
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210 or DR-0042"
                      value={credential}
                      onChange={(e) => { setCredential(e.target.value); setCredError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                      className={[
                        'w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm transition-all outline-none',
                        credError
                          ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200'
                          : 'border-gray-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100',
                      ].join(' ')}
                    />
                  </div>
                  {credError && (
                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd" />
                      </svg>
                      {credError}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="w-full py-3 bg-teal-500 hover:bg-teal-600 active:scale-[0.98] text-white font-semibold rounded-xl transition-all shadow-sm"
                >
                  Send OTP →
                </button>
              </div>
            ) : (
              /* ════════════════ STEP 2 ════════════════ */
              <div className="space-y-5">

                {/* Always-visible demo OTP banner */}
                <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-amber-800">Demo Mode — your OTP is</p>
                    <p className="text-2xl font-mono font-bold text-amber-700 tracking-[0.25em] mt-0.5">
                      {DEMO_OTP}
                    </p>
                  </div>
                </div>

                {/* Digit boxes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                    Enter 6-digit OTP
                  </label>
                  <OtpInput value={otp} onChange={setOtp} hasError={otpError} />
                  {otpError && (
                    <p className="mt-2 text-xs text-red-500 text-center font-medium">
                      Incorrect OTP — please try again.
                    </p>
                  )}
                </div>

                {/* Primary verify button */}
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={!otpComplete}
                  className="w-full py-3 bg-teal-500 hover:bg-teal-600 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-sm"
                >
                  Verify & Sign In
                </button>

                {/* Fill demo OTP shortcut */}
                <button
                  type="button"
                  onClick={handleFillAndVerify}
                  className="w-full py-2.5 border-2 border-teal-500 text-teal-600 hover:bg-teal-50 font-semibold rounded-xl transition-all text-sm"
                >
                  ✦ Fill Demo OTP &amp; Verify
                </button>

                {/* Back + Resend row */}
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setOtp(''); setOtpError(false); }}
                    className="text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Change credentials
                  </button>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className="text-teal-600 hover:text-teal-700 disabled:text-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Instant demo bypass — always visible ── */}
        <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-xs mb-3">
            Just testing? Skip authentication entirely.
          </p>
          <button
            type="button"
            onClick={handleInstantDemo}
            className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 active:scale-[0.98] text-white text-sm font-semibold rounded-lg transition-all border border-slate-600"
          >
            ⚡ Skip — Instant Demo Login (Doctor)
          </button>
        </div>

        <p className="text-center text-slate-500 text-xs mt-3">
          Demo environment · No real SMS sent · OTP is always{' '}
          <span className="font-mono font-semibold text-slate-300">{DEMO_OTP}</span>
        </p>
      </div>
    </div>
  );
}
