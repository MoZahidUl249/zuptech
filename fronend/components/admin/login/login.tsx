"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/lib/admin";
import { adminForgotPassword, adminResetPassword } from "@/lib/admin-api";

/*
 * Staff sign-in and password reset, extracted from admin-app.tsx so the shell
 * is only ever about the signed-in experience.
 */

export function AdminLogin() {
  const { login } = useAdmin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (recovering) return <ForgotPassword onBack={() => setRecovering(false)} />;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-rail-screen px-5 py-10">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          const ok = await login(username, password);
          setBusy(false);
          if (!ok) {
            // Was "Try the demo accounts below." — there were no demo
            // accounts below, or anywhere. Point at something that exists.
            setError(
              "That username or password isn't right. Check Caps Lock, or use “Forgot password?” below.",
            );
          }
        }}
        className="zup-pop w-full max-w-[340px] rounded-2xl bg-white px-7 py-8 shadow-[0_24px_60px_rgba(0,0,0,.45)]"
      >
        <div className="mb-6 flex items-center gap-2.5">
          <Image
            src="/images/zup-mark.png"
            alt=""
            width={34}
            height={34}
            className="h-8.5 w-8.5"
          />
          <div>
            <p className="text-ui-base font-extrabold leading-tight tracking-[-0.01em] text-zup-body">
              ZUP TECH
            </p>
            <p className="text-ui-micro font-bold uppercase tracking-[0.22em] text-zup-blue">
              Admin access
            </p>
          </div>
        </div>

        <label className="mb-1.5 block text-ui-sm font-bold text-zup-body" htmlFor="adm-user">
          Username
        </label>
        <input
          id="adm-user"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError("");
          }}
          placeholder="username"
          autoComplete="username"
          autoCapitalize="none"
          className="mb-4 min-h-11 w-full rounded-xl border border-zup-body/10 bg-zup-bg px-3.5 text-base outline-none transition-colors placeholder:text-zup-faint focus:border-zup-blue"
        />

        <label className="mb-1.5 block text-ui-sm font-bold text-zup-body" htmlFor="adm-pass">
          Password
        </label>
        <div className="relative mb-5">
          <input
            id="adm-pass"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="••••••"
            autoComplete="current-password"
            className="min-h-11 w-full rounded-xl border border-zup-body/10 bg-zup-bg pr-11 pl-3.5 text-base outline-none transition-colors placeholder:text-zup-faint focus:border-zup-blue"
          />
          {/* Half of "wrong password" is a typo you can't see. */}
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-zup-soft transition-colors hover:bg-zup-body/6 hover:text-zup-body"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>

        {error ? (
          <p className="mb-4 text-ui-sm font-medium text-destructive" role="alert" aria-live="assertive">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="min-h-12 w-full rounded-full bg-zup-blue text-ui-base font-bold text-white transition-colors hover:bg-zup-blue-dark disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => setRecovering(true)}
          className="mt-4 block w-full cursor-pointer text-center text-ui-sm font-semibold text-zup-blue transition-colors hover:text-zup-blue-dark"
        >
          Forgot password?
        </button>
      </form>
    </main>
  );
}

/**
 * Staff self-service reset: email → 6-digit code → new password. Staff sign in
 * with a username, so the email here is only a delivery address (Staff.email);
 * a member without one still gets their password reset by another admin.
 */
function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const fieldCls =
    "mb-4 min-h-11 w-full rounded-xl border border-zup-body/10 bg-zup-bg px-3.5 text-base outline-none transition-colors placeholder:text-zup-faint focus:border-zup-blue";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (step === "request") {
        await adminForgotPassword(email.trim());
        // Deliberately unconditional — the server won't say whether the
        // address belongs to an account, so neither does this screen.
        setNote(`If ${email.trim()} belongs to a staff account, a code is on its way.`);
        setStep("reset");
      } else {
        await adminResetPassword(email.trim(), otp.trim(), password);
        setNote("");
        onBack();
        toast("Password updated — sign in with your new password");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-rail-screen px-5 py-10">
      <form
        onSubmit={submit}
        className="zup-pop w-full max-w-[340px] rounded-2xl bg-white px-7 py-8 shadow-[0_24px_60px_rgba(0,0,0,.45)]"
      >
        <div className="mb-6">
          <p className="text-ui-base font-extrabold leading-tight tracking-[-0.01em] text-zup-body">
            Reset your password
          </p>
          <p className="mt-1 text-ui-sm leading-relaxed text-zup-soft">
            {step === "request"
              ? "Enter the email address on your staff account and we'll send you a 6-digit code."
              : "Enter the code we emailed you, along with a new password."}
          </p>
        </div>

        <label className="mb-1.5 block text-ui-sm font-bold text-zup-body" htmlFor="adm-fp-email">
          Email
        </label>
        <input
          id="adm-fp-email"
          type="email"
          value={email}
          disabled={step === "reset"}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          placeholder="you@example.com"
          autoComplete="email"
          autoCapitalize="none"
          className={`${fieldCls} disabled:bg-zup-body/4 disabled:text-zup-gray`}
        />

        {step === "reset" ? (
          <>
            <label className="mb-1.5 block text-ui-sm font-bold text-zup-body" htmlFor="adm-fp-otp">
              6-digit code
            </label>
            <input
              id="adm-fp-otp"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className={`${fieldCls} font-mono tracking-[0.3em]`}
            />

            <label className="mb-1.5 block text-ui-sm font-bold text-zup-body" htmlFor="adm-fp-pass">
              New password
            </label>
            <input
              id="adm-fp-pass"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              className={fieldCls}
            />
          </>
        ) : null}

        {note ? <p className="mb-4 text-ui-sm leading-relaxed text-zup-gray">{note}</p> : null}
        {error ? (
          <p className="mb-4 text-ui-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || (step === "reset" && (otp.length < 6 || password.length < 6))}
          className="min-h-12 w-full rounded-full bg-zup-blue text-ui-base font-bold text-white transition-colors hover:bg-zup-blue-dark disabled:opacity-60"
        >
          {busy ? "Working…" : step === "request" ? "Send code" : "Set new password"}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="mt-4 block w-full cursor-pointer text-center text-ui-sm font-semibold text-zup-blue transition-colors hover:text-zup-blue-dark"
        >
          Back to sign in
        </button>
      </form>
    </main>
  );
}

