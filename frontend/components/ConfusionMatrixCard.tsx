"use client";
const CM_URL = process.env.NEXT_PUBLIC_CM_URL || "";

export default function ConfusionMatrixCard() {
  if (!CM_URL) {
    return <p className="text-slate-500 text-sm">Set NEXT_PUBLIC_CM_URL in .env.local to show the confusion matrix image.</p>;
  }
  return (
    <figure>
      <img src={CM_URL} alt="Confusion Matrix" className="rounded-xl border w-full" />
      <figcaption className="mt-2 text-sm text-slate-600">Model evaluation (confusion matrix)</figcaption>
    </figure>
  );
}
