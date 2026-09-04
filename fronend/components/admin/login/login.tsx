"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { useAdmin } from "@/lib/admin";

/*
 * Staff sign-in, extracted from admin-app.tsx so the shell is only ever about
 * the signed-in experience.
 *
 * There is no reset screen here any more: staff do not reset their own
 * passwords, a manager sets one (Settings → Team). See routes/admin/auth.ts
 * for why.
 */

export function AdminLogin() {
  const { login } = useAdmin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


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
              "That username or password isn't right. Check Caps Lock, or ask a manager to set a new password.",
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

        {/* No self-service reset. A staff password is a session away from
            everything that role can do, and a mailed code was only ever as
            strong as the mailbox behind it — a manager sets it instead, with a
            person in the loop who can verify who is asking. */}
        <p className="mt-4 text-center text-ui-sm text-zup-gray">
          Forgotten your password? Ask a manager to set a new one for you.
        </p>
      </form>
    </main>
  );
}
