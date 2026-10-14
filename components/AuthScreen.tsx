"use client";

import { useState, type FormEvent } from "react";
import { confirmResetPassword, confirmSignUp, resendSignUpCode, resetPassword, signIn, signInWithRedirect, signUp } from "aws-amplify/auth";
import { env } from "@/lib/amplify";
import { authMessage } from "@/lib/auth";

type Mode = "login" | "signup" | "confirm" | "forgot" | "reset";

const TITLE: Record<Mode, string> = {
  login: "로그인",
  signup: "회원가입",
  confirm: "이메일 인증",
  forgot: "비밀번호 찾기",
  reset: "새 비밀번호",
};

export default function AuthScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function go(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
    setCode("");
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if ((e as { name?: string })?.name === "UserNotConfirmedException") {
        await resendSignUpCode({ username: email }).catch(() => {});
        setNotice("가입이 아직 안 끝났어요. 메일로 보낸 인증번호를 넣어 주세요.");
        setMode("confirm");
      } else setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const username = email.trim().toLowerCase();
    if (mode === "login") {
      run(async () => {
        const r = await signIn({ username, password });
        if (r.isSignedIn) onSignedIn();
        else if (r.nextStep.signInStep === "CONFIRM_SIGN_UP") go("confirm");
        else setError("이 계정은 추가 확인이 필요해요.");
      });
    } else if (mode === "signup") {
      run(async () => {
        const r = await signUp({ username, password, options: { userAttributes: { email: username } } });
        if (r.isSignUpComplete) {
          await signIn({ username, password });
          onSignedIn();
        } else {
          setNotice(`${username} 으로 인증번호를 보냈어요.`);
          setMode("confirm");
        }
      });
    } else if (mode === "confirm") {
      run(async () => {
        await confirmSignUp({ username, confirmationCode: code.trim() });
        if (password) {
          const r = await signIn({ username, password });
          if (r.isSignedIn) return onSignedIn();
        }
        setNotice("인증이 끝났어요. 로그인해 주세요.");
        setMode("login");
      });
    } else if (mode === "forgot") {
      run(async () => {
        await resetPassword({ username });
        setNotice(`${username} 으로 인증번호를 보냈어요.`);
        setMode("reset");
      });
    } else if (mode === "reset") {
      run(async () => {
        await confirmResetPassword({ username, confirmationCode: code.trim(), newPassword: password });
        const r = await signIn({ username, password });
        if (r.isSignedIn) onSignedIn();
        else {
          setNotice("비밀번호를 바꿨어요. 로그인해 주세요.");
          setMode("login");
        }
      });
    }
  }

  const needCode = mode === "confirm" || mode === "reset";
  const needPassword = mode !== "forgot" && mode !== "confirm";

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          마음장부
        </div>
        <h1>{TITLE[mode]}</h1>
        <p className="auth-sub">
          {mode === "login" && "로그인하면 어느 기기에서든 같은 장부를 볼 수 있어요."}
          {mode === "signup" && "이메일과 비밀번호(8자 이상)만 있으면 돼요."}
          {mode === "confirm" && (notice || "메일로 보낸 6자리 인증번호를 넣어 주세요.")}
          {mode === "forgot" && "가입한 이메일로 인증번호를 보내 드려요."}
          {mode === "reset" && (notice || "인증번호와 새 비밀번호를 넣어 주세요.")}
        </p>

        <form className="auth-form" onSubmit={submit}>
          <label className="field">
            <span>이메일</span>
            <input className="line-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={!needCode} readOnly={needCode} />
          </label>
          {needCode && (
            <label className="field">
              <span>인증번호</span>
              <input className="line-input num" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
            </label>
          )}
          {needPassword && (
            <label className="field">
              <span>{mode === "reset" ? "새 비밀번호" : "비밀번호"}</span>
              <input
                className="line-input"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
          )}
          {error && <p className="auth-error">{error}</p>}
          {!error && notice && mode === "login" && <p className="auth-notice">{notice}</p>}
          <button type="submit" className="btn primary wide" disabled={busy}>
            {busy ? "잠시만요…" : mode === "login" ? "로그인" : mode === "signup" ? "가입하기" : mode === "forgot" ? "인증번호 보내기" : "확인"}
          </button>
        </form>

        {mode === "login" && env.kakao && (
          <button type="button" className="btn kakao wide" onClick={() => signInWithRedirect({ provider: { custom: "Kakao" } })}>
            카카오로 시작하기
          </button>
        )}

        <div className="auth-links">
          {mode === "login" && (
            <>
              <button type="button" className="link" onClick={() => go("signup")}>
                회원가입
              </button>
              <button type="button" className="link" onClick={() => go("forgot")}>
                비밀번호 찾기
              </button>
            </>
          )}
          {mode === "confirm" && (
            <button type="button" className="link" onClick={() => run(async () => { await resendSignUpCode({ username: email.trim().toLowerCase() }); setNotice("인증번호를 다시 보냈어요."); })}>
              인증번호 다시 보내기
            </button>
          )}
          {mode !== "login" && (
            <button type="button" className="link" onClick={() => go("login")}>
              로그인으로 돌아가기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
