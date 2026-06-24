"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ConfirmationResult, RecaptchaVerifier as RecaptchaVerifierType } from "firebase/auth";
import { getApiUrl } from "@/lib/api";
import { Capacitor, registerPlugin } from "@capacitor/core";

type Profile = {
  id: string;
  phone?: string | null;
  phone_verified?: boolean | null;
  role?: string | null;
  role_id?: number | null;
};

type NativePhoneAuthPlugin = {
  sendOtp(options: { phoneNumber: string }): Promise<{
    verificationId?: string;
    idToken?: string;
    phoneNumber?: string;
    autoVerified?: boolean;
  }>;
  verifyOtp(options: { verificationId?: string; code: string }): Promise<{
    idToken: string;
    phoneNumber?: string;
    autoVerified?: boolean;
  }>;
};

const NativePhoneAuth = registerPlugin<NativePhoneAuthPlugin>("NativePhoneAuth");

const HIDDEN_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/select-role",
  "/auth-callback",
  "/admin",
];

function toE164(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

export default function PhoneVerificationGate({ user, pathname }: { user: any; pathname?: string | null }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [nativeVerificationId, setNativeVerificationId] = useState<string | null>(null);
  const verifierRef = useRef<RecaptchaVerifierType | null>(null);

  const hiddenByRoute = useMemo(
    () => HIDDEN_PATHS.some((path) => pathname?.startsWith(path)),
    [pathname]
  );

  useEffect(() => {
    if (!user?.id || hiddenByRoute) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(getApiUrl(`/api/users/profile?userId=${user.id}`))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setProfile(data);
        setPhone(data.phone || "");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, hiddenByRoute]);

  const shouldVerify =
    !!user?.id &&
    !hiddenByRoute &&
    !loading &&
    profile &&
    profile.role !== "superadmin" &&
    profile.role_id !== 5 &&
    profile.phone_verified !== true;

  async function getVerifier() {
    if (verifierRef.current) return verifierRef.current;

    const [{ RecaptchaVerifier }, { auth }] = await Promise.all([
      import("firebase/auth"),
      import("@/lib/firebase"),
    ]);

    verifierRef.current = new RecaptchaVerifier(auth, "phone-recaptcha-container", {
      size: "normal",
      "expired-callback": () => {
        verifierRef.current?.clear();
        verifierRef.current = null;
        setMessage("reCAPTCHA expired. Please verify it again.");
      },
    });
    await verifierRef.current.render();
    return verifierRef.current;
  }

  async function completePhoneVerification(idToken: string) {
    const res = await fetch(getApiUrl("/api/users/verify-phone"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, idToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Phone verification failed");

    setProfile((prev) => prev ? { ...prev, phone: data.phone, phone_verified: true } : prev);

    if (Capacitor.isNativePlatform()) {
      try {
        const raw = localStorage.getItem("cofarmz_mobile_user");
        if (raw) {
          localStorage.setItem(
            "cofarmz_mobile_user",
            JSON.stringify({ ...JSON.parse(raw), phone: data.phone, phone_verified: true })
          );
        }
      } catch {}
    }
  }

  async function handleSendOtp() {
    try {
      setMessage("");
      setSending(true);
      const formattedPhone = toE164(phone);
      if (!/^\+[1-9]\d{9,14}$/.test(formattedPhone)) {
        throw new Error("Enter a valid mobile number with country code");
      }

      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
        const result = await NativePhoneAuth.sendOtp({ phoneNumber: formattedPhone });
        setPhone(formattedPhone);

        if (result.idToken) {
          await completePhoneVerification(result.idToken);
          setMessage("Phone verified.");
          return;
        }

        if (!result.verificationId) {
          throw new Error("Could not start native phone verification");
        }

        setNativeVerificationId(result.verificationId);
        setMessage("OTP sent. Please enter the code.");
        return;
      }

      const verifier = await getVerifier();
      const [{ signInWithPhoneNumber }, { auth }] = await Promise.all([
        import("firebase/auth"),
        import("@/lib/firebase"),
      ]);
      const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setConfirmation(result);
      setPhone(formattedPhone);
      setMessage("OTP sent. Please enter the code.");
    } catch (error: any) {
      verifierRef.current?.clear();
      verifierRef.current = null;
      setMessage(error?.message || "Could not send OTP");
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyOtp() {
    try {
      if (!confirmation && !nativeVerificationId) throw new Error("Send OTP first");
      setMessage("");
      setVerifying(true);

      if (nativeVerificationId) {
        const result = await NativePhoneAuth.verifyOtp({
          verificationId: nativeVerificationId,
          code: code.trim(),
        });
        await completePhoneVerification(result.idToken);
      } else if (confirmation) {
        const credential = await confirmation.confirm(code.trim());
        const idToken = await credential.user.getIdToken();
        await completePhoneVerification(idToken);
      }
    } catch (error: any) {
      setMessage(error?.message || "Invalid OTP");
    } finally {
      setVerifying(false);
    }
  }

  if (!shouldVerify) return null;
  const otpSent = !!confirmation || !!nativeVerificationId;

  return (
    <div className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/60 px-4 sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-widest text-green-700">Mobile verification</p>
          <h2 className="mt-1 text-2xl font-black text-gray-950">Verify your phone</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-gray-500">
            Enter your mobile number and verify the OTP to continue using CoFarmz.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 9876543210"
            disabled={otpSent || sending || verifying}
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-base font-bold text-gray-950 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:bg-gray-100"
          />

          {otpSent && (
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter 6 digit OTP"
              disabled={verifying}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-base font-bold text-gray-950 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          )}

          {message && <p className="text-sm font-semibold text-gray-600">{message}</p>}

          {!otpSent && (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <div
                id="phone-recaptcha-container"
                className="flex min-h-[78px] items-center justify-center overflow-hidden"
              />
            </div>
          )}

          <button
            type="button"
            onClick={otpSent ? handleVerifyOtp : handleSendOtp}
            disabled={sending || verifying || (otpSent ? code.length < 6 : phone.trim().length < 10)}
            className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-green-600/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {otpSent
              ? verifying ? "Verifying..." : "Verify OTP"
              : sending ? "Sending OTP..." : "Send OTP"}
          </button>

          {otpSent && (
            <button
              type="button"
              onClick={() => {
                setConfirmation(null);
                setNativeVerificationId(null);
                setCode("");
                setMessage("");
                verifierRef.current?.clear();
                verifierRef.current = null;
              }}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-700"
            >
              Change number
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
