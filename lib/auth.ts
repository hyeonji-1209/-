"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAuthSession, fetchUserAttributes, getCurrentUser, signOut as amplifySignOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { cloudEnabled, configureAmplify } from "./amplify";

export type AuthState =
  | { status: "loading" }
  | { status: "out" }
  | { status: "in"; /** 아이덴티티 ID — DB 의 pk. 클라우드 미설정이면 null */ user: string | null; email: string | null };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async () => {
    if (!cloudEnabled) {
      setState({ status: "in", user: null, email: null });
      return;
    }
    try {
      await getCurrentUser();
      const [session, attrs] = await Promise.all([fetchAuthSession(), fetchUserAttributes().catch(() => ({}) as { email?: string })]);
      if (!session.identityId) throw new Error("no identity");
      setState({ status: "in", user: session.identityId, email: attrs.email ?? null });
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
      return "이메일 또는 비밀번호가 맞지 않아요.";
    case "UsernameExistsException":
      return "이미 가입된 이메일이에요. 로그인해 주세요.";
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
