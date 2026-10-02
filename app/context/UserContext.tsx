"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/roles";

interface User {
  _id: string;
  clerkId: string;
  email: string;
  name: string;
  imageUrl?: string;
  role: Role; // was "admin" | "user", now also allows "host"
  onboardingChoice?: "client" | "girl";
  createdAt: number;
  appearance?: {
    accent: string;
    rainMode: string;
    rainDensity: number;
    rainSpeed: number;
    rainOpacity: number;
    glow: boolean;
  };
}

export const UserContext = createContext<User | null>(null);
export function useUserContext() {
  return useContext(UserContext);
}
