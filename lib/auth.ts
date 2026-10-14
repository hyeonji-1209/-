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

/** Cognito 오류를 사람이 읽을 말로 */
export function authMessage(e: unknown): string {
  const name = (e as { name?: string })?.name ?? "";
  switch (name) {
    case "NotAuthorizedException":
    case "UserNotFoundException":
      return "아이디 또는 비밀번호가 맞지 않아요.";
    case "UsernameExistsException":
      return "이미 사용 중인 아이디예요.";
    case "InvalidPasswordException":
      return "비밀번호는 8자 이상이어야 해요.";
    case "InvalidParameterException":
      return "입력값을 다시 확인해 주세요.";
    case "CodeMismatchException":
      return "인증번호가 맞지 않아요.";
    case "ExpiredCodeException":
      return "인증번호가 만료됐어요. 다시 보내 주세요.";
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "시도가 너무 많아요. 잠시 후 다시 해 주세요.";
    case "NetworkError":
      return "인터넷 연결을 확인해 주세요.";
    default:
      return (e as Error)?.message || "문제가 생겼어요. 다시 시도해 주세요.";
  }
}
