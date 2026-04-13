// frontend/lib/userStore.ts
import { create } from "zustand";

export type ProfileSummary = {
  full_name?: string;
  email?: string;
  avatar_url?: string | null;
};

type State = {
  profile: ProfileSummary;
  setProfile: (p: ProfileSummary) => void;
  setAvatar: (url: string | null) => void;
};

export const useUserStore = create<State>((set) => ({
  profile: { full_name: "", email: "", avatar_url: null },
  setProfile: (p) => set({ profile: { ...p } }),
  setAvatar: (url) => set((s) => ({ profile: { ...s.profile, avatar_url: url } })),
}));
