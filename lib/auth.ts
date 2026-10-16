"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAuthSession, fetchUserAttributes, getCurrentUser, signOut as amplifySignOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { cloudEnabled, configureAmplify } from "./amplify";

export type AuthState =
  | { status: "loading" }
  | { status: "out" }
  | { status: "in"; /** 아이덴티티 ID — DB 의 pk. 클라우드 미설정이면 null */ user: string | null; username: string | null; nickname: string | null };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async () => {
    if (!cloudEnabled) {
      setState({ status: "in", user: null, username: null, nickname: null });
      return;
    }
    try {
      const me = await getCurrentUser();
      const [session, attrs] = await Promise.all([fetchAuthSession(), fetchUserAttributes().catch(() => ({}) as { nickname?: string })]);
      if (!session.identityId) throw new Error("no identity");
      // 소셜로 들어온 사람의 username 은 "kakao_…"/"google_…" 라서 보여 주지 않는다
      const username = /^(kakao|google)_/i.test(me.username) ? null : me.username;
      setState({ status: "in", user: session.identityId, username, nickname: attrs.nickname ?? null });
    } catch {
      setState({ status: "out" });
    }
  }, []);

  useEffect(() => {
    configureAmplify();
    refresh();
    if (!cloudEnabled) return;
    return Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signedIn" || payload.event === "signInWithRedirect") refresh();
      else if (payload.event === "signedOut") setState({ status: "out" });
    });
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await amplifySignOut();
    } finally {
      setState({ status: "out" });
    }
  }, []);

  return { ...state, refresh, signOut };
}

