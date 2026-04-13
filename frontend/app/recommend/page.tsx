"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function RedirectRecommend() {
  const router = useRouter();
  useEffect(() => { router.replace("/course-genie"); }, [router]);
  return null;
}
