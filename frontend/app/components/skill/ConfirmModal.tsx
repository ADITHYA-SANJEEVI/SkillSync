import React from "react";

type Props = {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title = "Clear results?",
  message = "This will remove your saved Skill Analysis from this session.",
  confirmLabel = "Clear",
  cancelLabel = "Keep",
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      {/* Dialog */}
      <div className="relative w-[92%] max-w-md rounded-2xl p-5 bg-gradient-to-br from-white/[0.07] to-white/[0.02] ring-1 ring-white/15 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-slate-200 bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-95 transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
