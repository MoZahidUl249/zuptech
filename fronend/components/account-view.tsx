"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Mail,
  Package,
  Phone,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import {
  subscribeAccount,
  getPhoneSnapshot,
  getPhoneServerSnapshot,
  setAuthPhone,
} from "@/lib/orders";
import { composeAddress, stripComposedAddress } from "@/lib/address";
import { useDeliveryZone } from "@/lib/zone";
import { DeliveryFields } from "@/components/checkout/delivery-fields";
import { useCustomer, setCustomer } from "@/lib/customer";
import {
  ApiError,
  customerLogout,
  getMe,
  getMyOrders,
  loginCustomer,
  registerCustomer,
  requestPasswordReset,
  resetPassword,
  updateProfile,
  type Customer,
  type MyOrder,
} from "@/lib/api";
import { formatBDT } from "@/lib/site";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  Delivered: "bg-zup-green/10 text-zup-green-dark",
  "On the way": "bg-zup-blue/10 text-zup-blue",
  Confirmed: "bg-zup-blue/10 text-zup-blue",
  Cancelled: "bg-zup-red/10 text-zup-red",
};
const statusFallback = "bg-[rgba(230,145,0,.12)] text-[#B26A00]";

function orderStage(status: MyOrder["status"]): number {
  if (status === "Delivered") return 3;
  if (status === "On the way") return 2;
  return 1;
}

type Mode = "signin" | "register" | "forgot-request" | "forgot-reset";

/** Client-side shape check only — the backend validates properly. Just enough
 *  to catch a typo before a reset code is sent somewhere unreachable. */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const copy: Record<Mode, { title: string; subtitle: string }> = {
  signin: {
    title: "Welcome back",
    subtitle: "Sign in with your phone number and password to track your orders.",
  },
  register: {
    title: "Create your account",
    subtitle: "Set a password so you can sign back in and track your orders anytime.",
  },
  "forgot-request": {
    title: "Reset your password",
    subtitle: "Enter your email address and we'll send you a 6-digit code.",
  },
  "forgot-reset": {
    title: "Choose a new password",
    subtitle: "Enter the code we emailed you, along with your new password.",
  },
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
  error: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-zup-mid">
        {label}
      </label>
      <div className="relative">
        <Lock
          className={cn(
            "pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 transition-colors",
            error ? "text-zup-red" : "text-zup-soft",
          )}
          strokeWidth={1.8}
          aria-hidden
        />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder ?? "••••••"}
          aria-invalid={error ? true : undefined}
          className={cn(
            "w-full rounded-2xl border bg-zup-bg py-3.5 pr-11.5 pl-11.5 text-base outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-zup-faint",
            error
              ? "border-zup-red focus:ring-4 focus:ring-zup-red/10"
              : "border-zup-body/12 focus:border-zup-blue focus:ring-4 focus:ring-zup-blue/12",
          )}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3.5 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-zup-soft transition-colors hover:bg-secondary hover:text-zup-mid"
        >
          {show ? (
            <EyeOff className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          ) : (
            <Eye className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}

/** Six individual digit boxes — auto-advances on type, steps back on
 *  backspace, and accepts a full pasted code in one go. `value`/`onChange`
 *  are still just a plain (up to 6-char) numeric string, same shape a
 *  single text input would use. */
function OtpInput({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const setDigitAt = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, "").slice(-1);
    const next = digits.slice();
    next[i] = d;
    onChange(next.join(""));
    if (d && i < 5) boxRefs.current[i + 1]?.focus();
  };

  return (
    <div
      className="flex gap-2"
      onPaste={(e) => {
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (!pasted) return;
        e.preventDefault();
        onChange(pasted);
        boxRefs.current[Math.min(pasted.length, 5)]?.focus();
      }}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          id={i === 0 ? id : undefined}
          ref={(el) => {
            boxRefs.current[i] = el;
          }}
          value={d}
          onChange={(e) => setDigitAt(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d && i > 0) boxRefs.current[i - 1]?.focus();
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1} of 6`}
          aria-invalid={error ? true : undefined}
          className={cn(
            "h-13 w-full min-w-0 rounded-2xl border bg-zup-bg text-center text-xl font-bold outline-none transition-[border-color,box-shadow] duration-200",
            error
              ? "border-zup-red focus:ring-4 focus:ring-zup-red/10"
              : "border-zup-body/12 focus:border-zup-blue focus:ring-4 focus:ring-zup-blue/12",
          )}
        />
      ))}
    </div>
  );
}

function ProfileSection({
  customer,
  zone,
  onSelectZone,
  name,
  onNameChange,
  address,
  onAddressChange,
  landmark,
  onLandmarkChange,
  dirty,
  busy,
  error,
  onSave,
  pwOpen,
  pwCodeSent,
  pwCode,
  onPwCodeChange,
  pwNewPassword,
  onPwNewPasswordChange,
  pwConfirmPassword,
  onPwConfirmPasswordChange,
  pwBusy,
  pwError,
  onOpenPasswordChange,
  onClosePasswordChange,
  onSendPasswordCode,
  onSavePassword,
}: {
  customer: Customer;
  zone: boolean;
  onSelectZone: (insideDhaka: boolean) => void;
  name: string;
  onNameChange: (v: string) => void;
  address: string;
  onAddressChange: (v: string) => void;
  landmark: string;
  onLandmarkChange: (v: string) => void;
  dirty: boolean;
  busy: boolean;
  error: string;
  onSave: () => void;
  pwOpen: boolean;
  pwCodeSent: boolean;
  pwCode: string;
  onPwCodeChange: (v: string) => void;
  pwNewPassword: string;
  onPwNewPasswordChange: (v: string) => void;
  pwConfirmPassword: string;
  onPwConfirmPasswordChange: (v: string) => void;
  pwBusy: boolean;
  pwError: string;
  onOpenPasswordChange: () => void;
  onClosePasswordChange: () => void;
  onSendPasswordCode: () => void;
  onSavePassword: () => void;
}) {
  // Division is derived from the chosen district (never tracked separately,
  // so it can't drift out of sync); picking a new division or district
  return (
    <div className="zup-fade-up flex flex-col gap-4">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onSave();
        }}
        className="flex flex-col gap-4 rounded-3xl border border-zup-body/7 bg-white p-5 sm:p-6"
      >
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-zup-soft">
          Your details
        </p>

        <div className="flex flex-col gap-2">
          <label htmlFor="profile-name" className="text-[13px] font-semibold text-zup-mid">
            Full name
          </label>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zup-soft"
              strokeWidth={1.8}
              aria-hidden
            />
            <input
              id="profile-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              type="text"
              autoComplete="name"
              className="w-full rounded-2xl border border-zup-body/12 bg-zup-bg py-3.5 pr-4 pl-11.5 text-base outline-none transition-[border-color,box-shadow] duration-200 focus:border-zup-blue focus:ring-4 focus:ring-zup-blue/12"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-zup-mid">Phone number</span>
          <div className="relative">
            <Phone
              className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zup-faint"
              strokeWidth={1.8}
              aria-hidden
            />
            <input
              value={customer.phone}
              readOnly
              disabled
              aria-label="Phone number (can't be changed)"
              className="w-full cursor-not-allowed rounded-2xl border border-zup-body/8 bg-zup-body/4 py-3.5 pr-4 pl-11.5 text-base text-zup-soft outline-none"
            />
          </div>
          <p className="text-[12px] text-zup-faint">
            This is your sign-in number and can&apos;t be changed here.
          </p>
        </div>

        {/* Same component checkout renders, so the address a customer saves
            here and the one they confirm at checkout can never diverge. */}
        <DeliveryFields
          insideDhaka={zone}
          address={address}
          landmark={landmark}
          onZoneChange={onSelectZone}
          onAddressChange={onAddressChange}
          onLandmarkChange={onLandmarkChange}
          errors={{}}
          idPrefix="profile"
        />

        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-[12.5px] font-medium text-zup-red">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !dirty}
          className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-zup-blue text-[15px] font-bold text-white transition-colors duration-200 hover:bg-zup-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zup-blue active:bg-zup-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
          {!busy && dirty ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} aria-hidden /> : null}
        </button>
      </form>

      <div className="rounded-3xl border border-zup-body/7 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zup-blue/8 text-zup-blue">
              <Lock className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <p className="text-[14.5px] font-bold">Password</p>
              <p className="text-[12.5px] text-zup-soft">Keep your account secure</p>
            </div>
          </div>
          {/* The code goes to the address on file, so there's nothing to offer
              an account that has none (guest checkout, or a signup from before
              email was collected). */}
          {!pwOpen && customer.email ? (
            <button
              type="button"
              onClick={onOpenPasswordChange}
              className="flex-none cursor-pointer rounded-full border border-zup-body/12 bg-white px-4 py-2 text-[13px] font-semibold text-zup-mid transition-colors hover:border-zup-body/20 hover:bg-secondary"
            >
              Change
            </button>
          ) : null}
        </div>

        {!customer.email ? (
          <p className="mt-3 rounded-xl bg-zup-blue/6 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-zup-mid">
            There&apos;s no email address on this account, so we can&apos;t send you a
            verification code. Contact support to add one and change your password.
          </p>
        ) : null}

        {pwOpen ? (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (pwBusy) return;
              if (pwCodeSent) onSavePassword();
              else onSendPasswordCode();
            }}
            className="mt-4 flex flex-col gap-3.5 border-t border-zup-body/7 pt-4"
          >
            {!pwCodeSent ? (
              <p className="text-[13px] leading-relaxed text-zup-gray">
                We&apos;ll email a 6-digit code to <strong>{customer.email}</strong> to confirm
                it&apos;s you before changing your password.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <label htmlFor="pw-otp" className="text-[13px] font-semibold text-zup-mid">
                    Enter the 6-digit code sent to {customer.email}
                  </label>
                  <OtpInput
                    id="pw-otp"
                    value={pwCode}
                    onChange={onPwCodeChange}
                    error={Boolean(pwError)}
                  />
                </div>
                <PasswordField
                  id="pw-new-password"
                  label="New password"
                  value={pwNewPassword}
                  onChange={onPwNewPasswordChange}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  error={Boolean(pwError)}
                />
                <PasswordField
                  id="pw-confirm-password"
                  label="Confirm new password"
                  value={pwConfirmPassword}
                  onChange={onPwConfirmPasswordChange}
                  autoComplete="new-password"
                  error={Boolean(pwError)}
                />
              </>
            )}

            {pwError && (
              <p role="alert" className="flex items-center gap-1.5 text-[12.5px] font-medium text-zup-red">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {pwError}
              </p>
            )}

            <div className="flex gap-2.5">
              <button
                type="submit"
                disabled={pwBusy}
                className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-zup-blue text-[14px] font-bold text-white transition-colors duration-200 hover:bg-zup-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pwBusy
                  ? "Please wait…"
                  : pwCodeSent
                    ? "Update password"
                    : "Email me a code"}
              </button>
              <button
                type="button"
                onClick={onClosePasswordChange}
                className="min-h-11 flex-none cursor-pointer rounded-full border border-zup-body/12 bg-white px-4 text-[14px] font-semibold text-zup-mid transition-colors hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-[12px] text-zup-soft">
        <ShieldCheck className="h-3.5 w-3.5 text-zup-green" aria-hidden />
        Your details are only used to fulfil and deliver your orders.
      </p>
    </div>
  );
}

type AccountTab = "orders" | "profile";

export function AccountView({ productNames }: { productNames: Record<string, string> }) {
  const savedPhone = useSyncExternalStore(
    subscribeAccount,
    getPhoneSnapshot,
    getPhoneServerSnapshot,
  );
  // null = signed out, undefined = still checking the session cookie. Shared
  // with the nav (site-header.tsx) via lib/customer.ts so both agree.
  const customer = useCustomer();
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [mode, setMode] = useState<Mode>("signin");
  const [tab, setTab] = useState<AccountTab>("orders");

  // null = untouched → prefill from the last checkout / sign-in
  const [phoneInput, setPhoneInput] = useState<string | null>(null);
  const phone = phoneInput ?? savedPhone ?? "";
  const [name, setName] = useState("");
  // Collected at registration and used as the reset identifier — not a login
  // identity; sign-in is still phone + password.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Profile (name/address/landmark) — prefilled from the signed-in customer.
  // Only landmark is folded into `address`, stripped back out via
  // stripComposedAddress so edits don't accumulate duplicate suffixes.
  const [profileName, setProfileName] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileLandmark, setProfileLandmark] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  // Delivery zone — the backend's two-tier inside/outside-Dhaka boolean.
  const [zone, setZone] = useDeliveryZone();
  // Tracked separately from `zone` so a customer whose saved value matches the
  // store's default isn't flagged dirty on load.
  const [zoneTouched, setZoneTouched] = useState(false);
  const onSelectZone = (insideDhaka: boolean) => {
    setZoneTouched(true);
    setZone(insideDhaka);
  };
  const baselineParsed = customer
    ? stripComposedAddress(customer.address)
    : { address: "", landmark: "" };
  const profileDirty =
    Boolean(customer) &&
    (profileName !== customer?.name ||
      profileAddress !== baselineParsed.address ||
      profileLandmark !== baselineParsed.landmark ||
      zoneTouched);

  // Change password — same request-code/reset-code endpoints as "forgot
  // password", just launched from inside the signed-in profile instead.
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCodeSent, setPwCodeSent] = useState(false);
  const [pwCode, setPwCode] = useState("");
  const [pwNewPassword, setPwNewPassword] = useState("");
  const [pwConfirmPassword, setPwConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");

  const loadOrders = useCallback(() => {
    getMyOrders()
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);

  useEffect(() => {
    if (customer) loadOrders();
  }, [customer, loadOrders]);

  // Re-sync the editable copy whenever a *different* customer becomes
  // signed in (sign-in, session restore) — adjusting state during render
  // rather than in an effect, per React's guidance for props→state resets.
  const [syncedCustomerId, setSyncedCustomerId] = useState<string | null>(null);
  if (customer && customer.id !== syncedCustomerId) {
    setSyncedCustomerId(customer.id);
    setProfileName(customer.name);
    setProfileAddress(baselineParsed.address);
    setProfileLandmark(baselineParsed.landmark);
    setZone(customer.insideDhaka);
    setZoneTouched(false);
  }

  const cleanPhone = phone.replace(/[\s-]/g, "");
  const cleanEmail = email.trim().toLowerCase();

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setPassword("");
    setConfirmPassword("");
  };

  const signIn = async () => {
    if (!/^01\d{9}$/.test(cleanPhone)) {
      setError("Enter a valid 11-digit phone number (01XXXXXXXXX).");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await loginCustomer(cleanPhone, password);
      setAuthPhone(cleanPhone);
      const me = await getMe();
      setCustomer(me);
      setPassword("");
      toast.success("Signed in");
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "Wrong phone number or password."
          : "Couldn't sign in — please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!/^01\d{9}$/.test(cleanPhone)) {
      setError("Enter a valid 11-digit phone number (01XXXXXXXXX).");
      return;
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      setError("Enter a valid email address — it's how you'd reset your password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await registerCustomer(name.trim(), cleanPhone, cleanEmail, password);
      setAuthPhone(cleanPhone);
      const me = await getMe();
      setCustomer(me);
      setPassword("");
      setConfirmPassword("");
      toast.success("Account created");
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
          ? "An account with this phone number already exists — sign in instead."
          : err instanceof ApiError && (err.status === 400 || err.status === 409)
            ? err.message
            : "Couldn't create your account — please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const requestReset = async () => {
    if (!EMAIL_RE.test(cleanEmail)) {
      setError("Enter the email address on your account.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await requestPasswordReset(cleanEmail);
      setResetToken("");
      setMode("forgot-reset");
      // Deliberately unconditional — the server won't say whether the address
      // has an account, so this message can't either.
      toast.success("If that email has an account, a code is on its way");
    } catch {
      setError("Couldn't send a code — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = async () => {
    if (resetToken.length !== 6) {
      setError("Enter the 6-digit code we emailed you.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await resetPassword(cleanEmail, resetToken, password);
      toast.success("Password reset — sign in with your new password");
      setResetToken("");
      setPassword("");
      setConfirmPassword("");
      setMode("signin");
    } catch {
      setError("That code didn't work — it may have expired. Request a new one.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    try {
      await customerLogout();
    } catch {
      // session cookie may already be gone — sign out locally regardless
    }
    setCustomer(null);
    setOrders(null);
    toast("Signed out");
  };

  const saveProfile = async () => {
    if (!profileName.trim()) {
      setProfileError("Enter your name.");
      return;
    }
    setProfileBusy(true);
    setProfileError("");
    try {
      const updated = await updateProfile({
        name: profileName.trim(),
        address: composeAddress(profileAddress, profileLandmark),
        insideDhaka: zone,
      });
      setCustomer(updated);
      // customer.id is unchanged, so the render-time resync above won't
      // fire — sync the (now-trimmed) editable copy directly instead. Strip
      // the composed suffix back off so the fields show clean values, not
      // the raw "..., X Upazila, Y Union (Landmark: ...)" blob.
      const parsed = stripComposedAddress(updated.address);
      setProfileName(updated.name);
      setProfileAddress(parsed.address);
      setProfileLandmark(parsed.landmark);
      setZone(updated.insideDhaka);
      setZoneTouched(false);
      toast.success("Profile updated");
    } catch {
      setProfileError("Couldn't save your changes — please try again.");
    } finally {
      setProfileBusy(false);
    }
  };

  const openPasswordChange = () => {
    setPwOpen(true);
    setPwCodeSent(false);
    setPwCode("");
    setPwNewPassword("");
    setPwConfirmPassword("");
    setPwError("");
  };

  const sendPasswordCode = async () => {
    if (!customer?.email) return;
    setPwBusy(true);
    setPwError("");
    try {
      await requestPasswordReset(customer.email);
      setPwCode("");
      setPwCodeSent(true);
      toast.success(`Code sent to ${customer.email}`);
    } catch {
      setPwError("Couldn't send a code — please try again.");
    } finally {
      setPwBusy(false);
    }
  };

  const savePassword = async () => {
    if (!customer?.email) return;
    if (pwCode.length !== 6) {
      setPwError("Enter the 6-digit code we emailed you.");
      return;
    }
    if (pwNewPassword.length < 6) {
      setPwError("Password must be at least 6 characters.");
      return;
    }
    if (pwNewPassword !== pwConfirmPassword) {
      setPwError("Passwords don't match.");
      return;
    }
    setPwBusy(true);
    setPwError("");
    try {
      await resetPassword(customer.email, pwCode, pwNewPassword);
      toast.success("Password updated");
      setPwOpen(false);
      setPwCodeSent(false);
      setPwCode("");
      setPwNewPassword("");
      setPwConfirmPassword("");
    } catch {
      setPwError("That code didn't work — it may have expired. Send a new one.");
    } finally {
      setPwBusy(false);
    }
  };

  if (!customer) {
    const { title, subtitle } = copy[mode];
    return (
      <main className="relative mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-115 flex-col justify-center px-5 py-14">
        {/* Soft brand glow behind the card */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 mx-auto h-72 w-72 -translate-y-1/2 rounded-full bg-zup-blue/8 blur-3xl"
        />

        <div className="zup-fade-up">
          <div className="mb-8 text-center">
            <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-b from-zup-blue to-zup-blue-dark text-white shadow-lg shadow-zup-blue/25">
              <User className="h-6.5 w-6.5" strokeWidth={1.8} aria-hidden />
            </span>
            <h1 className="mb-2.5 text-[27px] font-bold tracking-[-0.02em]">{title}</h1>
            <p className="mx-auto max-w-[320px] text-[14.5px] leading-relaxed text-zup-gray">
              {subtitle}
            </p>
          </div>

          <form
            noValidate
            className="flex flex-col gap-5 rounded-3xl border border-zup-body/7 bg-white p-6 shadow-xl shadow-zup-body/4 sm:p-7"
            onSubmit={(e) => {
              e.preventDefault();
              if (customer === undefined || busy) return;
              if (mode === "signin") void signIn();
              else if (mode === "register") void register();
              else if (mode === "forgot-request") void requestReset();
              else void confirmReset();
            }}
          >
            {mode === "register" ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="account-name" className="text-[13px] font-semibold text-zup-mid">
                  Full name
                </label>
                <div className="relative">
                  <User
                    className={cn(
                      "pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 transition-colors",
                      error && !name.trim() ? "text-zup-red" : "text-zup-soft",
                    )}
                    strokeWidth={1.8}
                    aria-hidden
                  />
                  <input
                    id="account-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError("");
                    }}
                    type="text"
                    autoComplete="name"
                    placeholder="Your name"
                    className="w-full rounded-2xl border border-zup-body/12 bg-zup-bg py-3.5 pr-4 pl-11.5 text-base outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-zup-faint focus:border-zup-blue focus:ring-4 focus:ring-zup-blue/12"
                  />
                </div>
              </div>
            ) : null}

            {/* Phone is the sign-in identity; reset is keyed on email, so the
                forgot flow asks for that instead. */}
            {mode === "signin" || mode === "register" ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="account-phone" className="text-[13px] font-semibold text-zup-mid">
                  Phone number
                </label>
                <div className="relative">
                  <Phone
                    className={cn(
                      "pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 transition-colors",
                      error ? "text-zup-red" : "text-zup-soft",
                    )}
                    strokeWidth={1.8}
                    aria-hidden
                  />
                  <input
                    id="account-phone"
                    value={phone}
                    onChange={(e) => {
                      setPhoneInput(e.target.value);
                      setError("");
                    }}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="01XXXXXXXXX"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "account-form-error" : undefined}
                    className={cn(
                      "w-full rounded-2xl border bg-zup-bg py-3.5 pr-4 pl-11.5 text-base tracking-wide outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-zup-faint",
                      error
                        ? "border-zup-red focus:ring-4 focus:ring-zup-red/10"
                        : "border-zup-body/12 focus:border-zup-blue focus:ring-4 focus:ring-zup-blue/12",
                    )}
                  />
                </div>
              </div>
            ) : null}

            {mode === "register" || mode === "forgot-request" ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="account-email" className="text-[13px] font-semibold text-zup-mid">
                  Email address
                </label>
                <div className="relative">
                  <Mail
                    className={cn(
                      "pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 transition-colors",
                      error ? "text-zup-red" : "text-zup-soft",
                    )}
                    strokeWidth={1.8}
                    aria-hidden
                  />
                  <input
                    id="account-email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    placeholder="you@example.com"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "account-form-error" : undefined}
                    className={cn(
                      "w-full rounded-2xl border bg-zup-bg py-3.5 pr-4 pl-11.5 text-base outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-zup-faint",
                      error
                        ? "border-zup-red focus:ring-4 focus:ring-zup-red/10"
                        : "border-zup-body/12 focus:border-zup-blue focus:ring-4 focus:ring-zup-blue/12",
                    )}
                  />
                </div>
                {mode === "register" ? (
                  <p className="text-[12px] leading-relaxed text-zup-soft">
                    You&apos;ll sign in with your phone number — this is where we send a
                    code if you ever need to reset your password.
                  </p>
                ) : null}
              </div>
            ) : null}

            {mode === "signin" ? (
              <PasswordField
                id="account-password"
                label="Password"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  setError("");
                }}
                autoComplete="current-password"
                error={Boolean(error)}
              />
            ) : null}

            {mode === "register" ? (
              <>
                <PasswordField
                  id="account-password"
                  label="Password"
                  value={password}
                  onChange={(v) => {
                    setPassword(v);
                    setError("");
                  }}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  error={Boolean(error)}
                />
                <PasswordField
                  id="account-confirm-password"
                  label="Confirm password"
                  value={confirmPassword}
                  onChange={(v) => {
                    setConfirmPassword(v);
                    setError("");
                  }}
                  autoComplete="new-password"
                  error={Boolean(error)}
                />
              </>
            ) : null}

            {mode === "forgot-reset" ? (
              <>
                <div className="flex flex-col gap-2">
                  <label htmlFor="account-reset-otp" className="text-[13px] font-semibold text-zup-mid">
                    Enter the 6-digit code sent to {cleanEmail}
                  </label>
                  <OtpInput
                    id="account-reset-otp"
                    value={resetToken}
                    onChange={(v) => {
                      setResetToken(v);
                      setError("");
                    }}
                    error={Boolean(error)}
                  />
                </div>
                <PasswordField
                  id="account-new-password"
                  label="New password"
                  value={password}
                  onChange={(v) => {
                    setPassword(v);
                    setError("");
                  }}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  error={Boolean(error)}
                />
                <PasswordField
                  id="account-confirm-new-password"
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={(v) => {
                    setConfirmPassword(v);
                    setError("");
                  }}
                  autoComplete="new-password"
                  error={Boolean(error)}
                />
              </>
            ) : null}

            {mode === "signin" ? (
              <button
                type="button"
                onClick={() => switchMode("forgot-request")}
                className="-mt-2 self-end text-[12.5px] font-semibold text-zup-blue transition-colors hover:text-zup-blue-dark"
              >
                Forgot password?
              </button>
            ) : null}

            {error && (
              <p
                id="account-form-error"
                role="alert"
                className="-mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-zup-red"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || customer === undefined}
              className="group flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-zup-blue text-[15px] font-bold text-white transition-colors duration-200 hover:bg-zup-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zup-blue active:bg-zup-blue-dark disabled:opacity-60"
            >
              {busy
                ? "Please wait…"
                : customer === undefined
                  ? "Checking session…"
                  : mode === "signin"
                    ? "Sign in"
                    : mode === "register"
                      ? "Create account"
                      : mode === "forgot-request"
                        ? "Email me a code"
                        : "Reset password"}
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                strokeWidth={2.2}
                aria-hidden
              />
            </button>

            {mode === "forgot-request" || mode === "forgot-reset" ? (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="text-center text-[13px] font-semibold text-zup-blue transition-colors hover:text-zup-blue-dark"
              >
                Back to sign in
              </button>
            ) : (
              <>
                <div className="flex items-center gap-3" aria-hidden>
                  <span className="h-px flex-1 bg-zup-body/8" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zup-faint">
                    {mode === "signin" ? "New here?" : "Already have an account?"}
                  </span>
                  <span className="h-px flex-1 bg-zup-body/8" />
                </div>
                <button
                  type="button"
                  onClick={() => switchMode(mode === "signin" ? "register" : "signin")}
                  className="text-center text-[13px] font-semibold text-zup-blue transition-colors hover:text-zup-blue-dark"
                >
                  {mode === "signin" ? "Create an account" : "Sign in instead"}
                </button>
              </>
            )}
          </form>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[12px] text-zup-soft">
            <ShieldCheck className="h-3.5 w-3.5 text-zup-green" aria-hidden />
            Your password is stored securely and never shared.
          </p>
        </div>
        <div className="h-20" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-115 px-5 pt-10 sm:pt-12">
      <div className="zup-fade-up mb-6 flex items-center justify-between gap-3 rounded-3xl border border-zup-body/7 bg-white p-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zup-blue/8 text-zup-blue">
            <User className="h-5 w-5" strokeWidth={1.8} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-[19px] font-bold tracking-[-0.02em]">
              {customer.name}
            </h1>
            <p className="truncate text-[13.5px] text-zup-gray">{customer.phone}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-zup-body/12 bg-white px-4 py-2 text-[13px] font-semibold text-zup-mid transition-colors duration-200 hover:border-zup-body/20 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zup-blue"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Sign out
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Account sections"
        className="zup-fade-up mb-6 inline-flex rounded-full bg-zup-body/6 p-1"
      >
        {(
          [
            ["orders", "Your orders"],
            ["profile", "Profile"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "min-h-9 rounded-full px-5 text-[13.5px] font-bold transition-colors",
              tab === value
                ? "bg-white text-zup-body shadow-sm"
                : "text-zup-gray hover:text-zup-mid",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "orders" ? (
      <div className="flex flex-col gap-3.5">
        {orders === null ? (
          <div className="rounded-3xl border border-zup-body/7 bg-white px-6 py-10 text-center text-[13.5px] text-zup-gray">
            Loading your orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl border border-zup-body/7 bg-white px-6 py-10 text-center">
            <span className="mx-auto mb-4 flex h-13 w-13 items-center justify-center rounded-full bg-zup-blue/7 text-zup-blue">
              <Package className="h-6 w-6" strokeWidth={1.6} aria-hidden />
            </span>
            <p className="mb-1.5 text-[15px] font-semibold">No orders yet</p>
            <p className="mx-auto mb-5 max-w-65 text-[13px] leading-relaxed text-zup-gray">
              Orders placed with this number will show up here with live
              delivery tracking.
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 rounded-full bg-zup-blue px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-zup-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zup-blue"
            >
              Browse products
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
            </Link>
          </div>
        ) : (
          orders.map((order) => {
            const cancelled = order.status === "Cancelled";
            const stage = orderStage(order.status);
            const summary = order.items
              .map((i) => `${productNames[i.productId] ?? i.productId} ×${i.qty}`)
              .join(", ");
            return (
              <div
                key={order.id}
                className="flex flex-col gap-3 rounded-3xl border border-zup-body/7 bg-white p-5 transition-shadow duration-200 hover:shadow-md hover:shadow-zup-body/5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <span className="text-[14.5px] font-bold tracking-[-0.01em]">
                    {order.id}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1.25 text-xs font-bold",
                      statusStyles[order.status] ?? statusFallback,
                    )}
                  >
                    {order.status === "Delivered" && (
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                    )}
                    {cancelled && <XCircle className="h-3 w-3" aria-hidden />}
                    {order.status}
                  </span>
                </div>
                <span className="text-[13px] leading-relaxed text-zup-gray">
                  {summary} · {formatBDT(order.total)}
                </span>
                {order.address ? (
                  <span className="text-[12.5px] leading-relaxed text-zup-soft">
                    Deliver to: {order.address}
                  </span>
                ) : null}
                {/* Once a courier has it, the number is the thing a customer
                    actually wants — it is what they quote when they call. */}
                {order.tracking ? (
                  <span className="text-[12.5px] leading-relaxed text-zup-soft">
                    {order.tracking.courier}
                    {order.tracking.trackingCode ? (
                      <>
                        {" · "}
                        {order.tracking.trackingUrl ? (
                          <a
                            href={order.tracking.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-zup-blue hover:underline"
                          >
                            {order.tracking.trackingCode}
                          </a>
                        ) : (
                          <span className="font-semibold text-zup-mid">
                            {order.tracking.trackingCode}
                          </span>
                        )}
                      </>
                    ) : null}
                  </span>
                ) : null}
                {!cancelled && (
                  <>
                    <div className="mt-0.5 flex items-center gap-1.5" aria-hidden>
                      {[1, 2, 3].map((n) => (
                        <span
                          key={n}
                          className={cn(
                            "h-1.5 flex-1 rounded-full transition-colors",
                            stage >= n
                              ? order.status === "Delivered"
                                ? "bg-zup-green"
                                : "bg-zup-blue"
                              : "bg-zup-body/8",
                          )}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-[11.5px] font-medium text-zup-soft">
                      <span className={cn(stage >= 1 && "text-zup-mid")}>
                        Confirmed
                      </span>
                      <span className={cn(stage >= 2 && "text-zup-mid")}>
                        On the way
                      </span>
                      <span className={cn(stage >= 3 && "text-zup-green-dark")}>
                        Delivered
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
      ) : (
        <ProfileSection
          customer={customer}
          zone={zone}
          onSelectZone={onSelectZone}
          name={profileName}
          onNameChange={setProfileName}
          address={profileAddress}
          onAddressChange={setProfileAddress}
          landmark={profileLandmark}
          onLandmarkChange={setProfileLandmark}
          dirty={profileDirty}
          busy={profileBusy}
          error={profileError}
          onSave={() => void saveProfile()}
          pwOpen={pwOpen}
          pwCodeSent={pwCodeSent}
          pwCode={pwCode}
          onPwCodeChange={setPwCode}
          pwNewPassword={pwNewPassword}
          onPwNewPasswordChange={setPwNewPassword}
          pwConfirmPassword={pwConfirmPassword}
          onPwConfirmPasswordChange={setPwConfirmPassword}
          pwBusy={pwBusy}
          pwError={pwError}
          onOpenPasswordChange={openPasswordChange}
          onClosePasswordChange={() => setPwOpen(false)}
          onSendPasswordCode={() => void sendPasswordCode()}
          onSavePassword={() => void savePassword()}
        />
      )}
      <div className="h-24" />
    </main>
  );
}
