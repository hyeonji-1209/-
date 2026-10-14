"use client";

import { useAuth } from "@/lib/auth";
import { cloudEnabled } from "@/lib/amplify";
import App from "@/components/App";
import AuthScreen from "@/components/AuthScreen";

export default function Page() {
  const auth = useAuth();

  if (auth.status === "loading") return <div className="app" />;
  if (auth.status === "out") return <AuthScreen />;
  return <App key={auth.user ?? "local"} user={auth.user} username={auth.username} nickname={auth.nickname} onSignOut={cloudEnabled ? auth.signOut : undefined} />;
}
