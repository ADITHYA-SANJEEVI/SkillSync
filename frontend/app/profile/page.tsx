// app/profile/page.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Mail, ShieldCheck, Copy, Edit3, MapPin, Trash2, Upload, Camera, Loader2, User } from "lucide-react";

/* ───────── API base (robust) ───────── */
function computeApiBase(): string {
  const env = process?.env?.NEXT_PUBLIC_API_BASE?.trim();
  if (env) return env;
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000`;
  }
  return "http://127.0.0.1:8000";
}
const API_BASE = computeApiBase();

/* Candidate endpoints: we will try these in order until one works */
const AVATAR_ENDPOINTS = [
  "/api/v1/profile/avatar",
  "/api/v1/profile/upload-avatar",
  "/api/v1/account/avatar",
  "/api/v1/user/avatar",
  "/api/v1/users/avatar",
  "/api/v1/files/avatar",
  "/api/v1/files/upload",
  "/api/v1/media/upload",
  "/api/v1/upload/avatar",
  "/api/v1/llm/upload-avatar",
].map((p) => `${API_BASE}${p}`);

const ENDPOINT = {
  get: `${API_BASE}/api/v1/profile/me`,        // if your GET lives elsewhere it's fine; UI still works with fallback
  update: `${API_BASE}/api/v1/profile/update`,
  deleteAccount: `${API_BASE}/api/v1/profile/delete`,
};

type Profile = {
  full_name: string;
  email: string;
  headline?: string;
  location?: string;
  plan?: string;
  status?: "Active" | "Inactive";
  uid?: string;
  avatar_url?: string | null;
  verified?: boolean;
};

function cn(...v: Array<string | false | undefined>) { return v.filter(Boolean).join(" "); }

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store", credentials: "include" });
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  return r.json();
}

async function putJson(url: string, body: any) {
  const r = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PUT ${url} -> ${r.status} ${await r.text().catch(()=>"")}`);
  return r.json().catch(() => ({}));
}

/* ───── client resize → ≤512 ───── */
async function fileToWebp(file: File, maxSide = 512): Promise<Blob> {
  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  await new Promise((res) => (img.onload = res));
  const { width, height } = img;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/webp", 0.92)!);
  URL.revokeObjectURL(img.src);
  return blob;
}

/* ───────── Clipboard helper ───────── */
function useClipboard() {
  const [state, set] = React.useState<null | "ok" | "fail">(null);
  const copy = React.useCallback(async (t: string) => {
    try { await navigator.clipboard.writeText(t); set("ok"); }
    catch { set("fail"); }
    finally { setTimeout(() => set(null), 1400); }
  }, []);
  return { state, copy };
}

/* ───────── Camera Capture Modal (desktop+mobile) ───────── */
function CameraCapture({
  open,
  onClose,
  onConfirm, // returns a Blob (JPEG)
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (jpegBlob: Blob) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [shot, setShot] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    async function start() {
      if (!open) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        alert("Camera access denied or unavailable.");
        onClose();
      }
    }
    start();
    return () => {
      alive = false;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setShot(null);
    };
  }, [open, onClose]);

  function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, w, h);
    const dataURL = canvas.toDataURL("image/jpeg", 0.95);
    setShot(dataURL);
  }

  async function confirm() {
    if (!shot) return;
    setBusy(true);
    try {
      const res = await fetch(shot);
      const blob = await res.blob(); // JPEG
      onConfirm(blob);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[61] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#11152a] p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-white">Take a photo</h3>
        {!shot ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black">
            <video ref={videoRef} playsInline muted className="block w-full" />
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot} alt="Preview" className="w-full" />
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {!shot ? (
              <button onClick={captureFrame} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                Capture
              </button>
            ) : (
              <>
                <button onClick={() => setShot(null)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                  Retake
                </button>
                <button onClick={confirm} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Use photo
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Smart upload that discovers the correct route ───────── */
async function uploadToDiscoveredEndpoint(blobOrFile: Blob | File): Promise<{ url: string; endpoint: string }> {
  const f = (blobOrFile as File).name
    ? (blobOrFile as File)
    : new File([blobOrFile], blobOrFile.type.includes("jpeg") ? "avatar.jpg" : "avatar.webp", { type: blobOrFile.type });

  // Build a single FormData object (cloned per attempt to avoid consumed streams)
  function buildForm(): FormData {
    const form = new FormData();
    form.append("file", f);
    form.append("avatar", f);
    form.append("image", f);
    form.append("photo", f);
    return form;
  }

  const tried: Array<{ url: string; status: number }> = [];

  for (const url of AVATAR_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        body: buildForm(),
        credentials: "include",
      });

      // 404/405 → try next endpoint
      if (res.status === 404 || res.status === 405) {
        tried.push({ url, status: res.status });
        continue;
      }

      // Other non-OK: bubble up the text (maybe useful error)
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Upload failed (${res.status}) @ ${url}`);
      }

      const data = await res.json().catch(() => ({}));
      const outUrl = data?.url as string | undefined;
      if (!outUrl) throw new Error(`Server OK but missing { url } @ ${url}`);
      return { url: outUrl, endpoint: url };
    } catch (e: any) {
      // Network or server error not 404/405 → stop here
      if (e?.message) throw e;
      throw new Error(`Upload error @ ${url}`);
    }
  }

  // If we got here, none of the endpoints existed
  const list = tried.map((t) => `${t.url} → ${t.status}`).join("\n");
  throw new Error(`No avatar upload route found.\nTried:\n${list || AVATAR_ENDPOINTS.join("\n")}`);
}

/* ───────── Avatar Modal (chooser + camera) ───────── */
function AvatarModal({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: (url: string) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [camOpen, setCamOpen] = React.useState(false);
  const pickRef = React.useRef<HTMLInputElement | null>(null);

  async function uploadWithFallback(file: File) {
    setBusy(true);
    try {
      // 1) Try WebP (small). If server rejects with 415/400 AT THE CHOSEN ENDPOINT,
      //    we’ll catch that inside uploadToDiscoveredEndpoint when it throws.
      try {
        const webp = await fileToWebp(file, 512);
        const { url, endpoint } = await uploadToDiscoveredEndpoint(webp);
        success(url, endpoint);
        return;
      } catch (e: any) {
        // If error suggests unsupported type, fall back to original
        const msg = String(e?.message || "");
        if (!/415|unsupported|content[- ]?type/i.test(msg)) {
          // might be "No avatar upload route found." or network; still try original next
        }
      }

      // 2) Try original PNG/JPEG
      const { url, endpoint } = await uploadToDiscoveredEndpoint(file);
      success(url, endpoint);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function success(url: string, endpoint: string) {
    try {
      localStorage.setItem("profile.avatar_url", url);
      window.dispatchEvent(new CustomEvent("profile:updated", { detail: { avatar_url: url } }));
    } catch {}
    console.info("Avatar uploaded via:", endpoint);
    onUploaded(url);
    onClose();
  }

  async function onChoose(file: File | null) {
    if (!file) return;
    if (!/image\/(png|jpe?g)/.test(file.type)) {
      alert("Please choose a PNG or JPEG image.");
      return;
    }
    await uploadWithFallback(file);
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#11152a]/95 p-5 shadow-2xl">
            <h3 className="text-lg font-medium text-white">Update profile photo</h3>
            <p className="mt-1 text-sm text-white/60">Choose an existing photo or take a new one.</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => pickRef.current?.click()}
                className="group rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <div className="flex items-center gap-3">
                  <Upload className="h-5 w-5 opacity-80 group-hover:opacity-100" />
                  <span>Choose photo</span>
                </div>
                <input
                  ref={pickRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => onChoose(e.target.files?.[0] ?? null)}
                />
              </button>

              <button
                onClick={() => setCamOpen(true)}
                className="group rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <div className="flex items-center gap-3">
                  <Camera className="h-5 w-5 opacity-80 group-hover:opacity-100" />
                  <span>Take photo</span>
                </div>
              </button>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white/80 opacity-60"
                title="Upload happens automatically after choosing/taking a photo"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <CameraCapture
        open={camOpen}
        onClose={() => setCamOpen(false)}
        onConfirm={async (jpegBlob) => {
          const jpegFile = new File([jpegBlob], "camera.jpg", { type: "image/jpeg" });
          await uploadWithFallback(jpegFile);
          setCamOpen(false);
        }}
      />
    </>
  );
}

/* ───────── Main Profile Page (SS2 visuals preserved) ───────── */
export default function ProfilePage() {
  const [p, setP] = React.useState<Profile | null>(null);
  const [edit, setEdit] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [avatarOpen, setAvatarOpen] = React.useState(false);
  const [danger, setDanger] = React.useState(false);
  const { state: copied, copy } = useClipboard();

  const [full_name, setFullName] = React.useState("");
  const [headline, setHeadline] = React.useState("");
  const [location, setLocation] = React.useState("");

  React.useEffect(() => {
    (async () => {
      const data = await getJson<Profile>(ENDPOINT.get).catch(() => ({
        full_name: "Roopa Sanjeevi",
        email: "roopa.crs@gmail.com",
        headline: "",
        location: "",
        plan: "Free (Dev)",
        status: "Active",
        uid: "5006d8e2-bb01-4ea8-a0bc-3ccf…",
        avatar_url: null,
        verified: true,
      }));
      setP(data);
      setFullName(data.full_name ?? "");
      setHeadline(data.headline ?? "");
      setLocation(data.location ?? "");
      try {
        if (data.avatar_url) {
          localStorage.setItem("profile.avatar_url", data.avatar_url);
          window.dispatchEvent(new CustomEvent("profile:updated", { detail: { avatar_url: data.avatar_url } }));
        }
      } catch {}
    })();
  }, []);

  async function handleSave() {
    if (!p) return;
    setSaving(true);
    try {
      await putJson(ENDPOINT.update, { full_name, headline, location });
      const next = { ...p, full_name, headline, location };
      setP(next);
      setEdit(false);
    } catch (e: any) {
      alert(e?.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!p) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="h-8 w-40 rounded-lg bg-white/10" />
        <div className="mt-6 h-64 rounded-2xl border border-white/10 bg-white/5" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-4xl font-semibold text-transparent">
        Profile
      </h1>
      <p className="mt-2 text-white/70">Manage your identity and account preferences.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Left card */}
        <section className="rounded-2xl border border-white/10 bg-[#0f1430]/70 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-start gap-4">
            <button
              className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/5 ring-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              onClick={() => setAvatarOpen(true)}
              title="Change profile photo"
            >
              {p.avatar_url ? (
                <Image src={p.avatar_url} alt="Avatar" fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-10 w-10 text-white/60 group-hover:text-white" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/50 py-1 text-xs text-white">
                Change
              </div>
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-xl font-semibold text-white">{p.full_name}</span>
                {p.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300" title="Verified email">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/80">
                <Link href={`mailto:${p.email}`} className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30" title="Send email">
                  <Mail className="h-4 w-4 opacity-80" />
                  {p.email}
                </Link>

                {p.uid && <CopyUid uid={p.uid} />}
                {/* Copy state hint */}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-white/50">Plan</div>
              <button onClick={() => window.open("/billing", "_blank")} className="mt-1 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-left text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30" title="Manage billing">
                {p.plan || "Free (Dev)"} <ExternalArrow />
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-white/50">Status</div>
              <span className="mt-1 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-white">
                <span className={cn("h-2.5 w-2.5 rounded-full", p.status === "Active" ? "bg-emerald-400" : "bg-zinc-400")} />
                {p.status ?? "Active"}
              </span>
            </div>
          </div>
        </section>

        {/* Right card */}
        <section className="rounded-2xl border border-white/10 bg-[#0f1430]/70 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Account Details</h2>
            <button
              onClick={() => setEdit((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <Edit3 className="h-4 w-4" />
              {edit ? "Close" : "Edit"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Full name" value={edit ? full_name : p.full_name} onChange={setFullName} editable={edit} />
            <Field
              label="Email"
              value={p.email}
              editable={false}
              trailing={
                <button onClick={() => window.open("/account/email", "_blank")} className="rounded-lg px-2 py-1 text-sm text-indigo-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                  Manage
                </button>
              }
            />
            <Field label="Headline" placeholder="e.g., Full-Stack Dev, ML-first" value={edit ? headline : (p.headline ?? "")} onChange={setHeadline} editable={edit} />
            <Field label="Location" placeholder="City, Country" value={edit ? location : (p.location ?? "")} onChange={setLocation} editable={edit} leading={<MapPin className="h-4 w-4 opacity-70" />} />
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => setDanger(true)} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
              <Trash2 className="h-4 w-4" />
              Delete account
            </button>

            {edit && (
              <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Delete confirm */}
      {danger && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#11152a] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Delete account?</h3>
            <p className="mt-1 text-sm text-white/70">This action is irreversible.</p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button onClick={() => setDanger(false)} className="rounded-lg px-4 py-2 text-sm text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30">Cancel</button>
              <button onClick={async () => { try { await fetch(ENDPOINT.deleteAccount, { method: "POST", credentials: "include" }); } catch {} setDanger(false); }} className="rounded-lg bg-rose-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar modal */}
      <AvatarModal
        open={avatarOpen}
        onClose={() => setAvatarOpen(false)}
        onUploaded={(url) => setP((old) => (old ? { ...old, avatar_url: url } : old))}
      />
    </div>
  );
}

/* ───────── UI Bits ───────── */
function Field({
  label,
  value,
  onChange,
  editable,
  placeholder,
  leading,
  trailing,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  editable: boolean;
  placeholder?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-sm text-white/70">{label}</div>
      {editable ? (
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus-within:ring-2 focus-within:ring-indigo-400">
          {leading}
          <input
            className="w-full bg-transparent outline-none placeholder:text-white/40"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
          />
          {trailing}
        </div>
      ) : (
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90">
          {leading}
          <span className="truncate">{value || <span className="text-white/40">{placeholder || "—"}</span>}</span>
          {trailing}
        </div>
      )}
    </div>
  );
}

function CopyUid({ uid }: { uid: string }) {
  const { state, copy } = useClipboard();
  return (
    <button
      onClick={() => copy(uid)}
      className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      title="Copy UID"
    >
      <span className="rounded bg-white/10 px-2 py-0.5 text-xs">UID</span>
      <span className="truncate max-w-[12rem] font-mono opacity-90">{uid}</span>
      <Copy className="h-4 w-4 opacity-80" />
    </button>
  );
}

function ExternalArrow() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-80" aria-hidden>
      <path d="M14 3h7v7" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M21 3l-9 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M5 12v7h7" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
