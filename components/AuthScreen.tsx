"use client";

import { signInWithRedirect } from "aws-amplify/auth";
import { env } from "@/lib/amplify";

/** 소셜 로그인만. 아이디·비밀번호·이메일은 받지 않는다. */
export default function AuthScreen() {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand">
          <img className="brand-mark" src="/brand.png" alt="" />
          마음장부
        </div>
        <h1>시작하기</h1>
        <p className="auth-sub">쓰던 계정으로 바로 시작할 수 있어요. 어느 기기에서든 같은 장부를 봅니다.</p>

        <div className="social">
          {env.kakao && (
            <button type="button" className="btn kakao wide" onClick={() => signInWithRedirect({ provider: { custom: "Kakao" } })}>
              <KakaoMark />
              카카오로 시작하기
            </button>
          )}
          {env.google && (
            <button type="button" className="btn google wide" onClick={() => signInWithRedirect({ provider: "Google" })}>
              <GoogleMark />
              Google로 시작하기
            </button>
          )}
          {!env.kakao && !env.google && <p className="auth-error">로그인 방법이 아직 설정되지 않았어요.</p>}
        </div>

        <p className="auth-foot">비밀번호 없이 로그인돼요. 닉네임은 그 계정의 이름을 그대로 씁니다.</p>
      </div>
    </div>
  );
}

function KakaoMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#191919"
        d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.86 5.33 4.66 6.74L5.5 21.5c-.08.3.26.55.52.38l4.5-3.03c.48.06.97.1 1.48.1 5.52 0 10-3.58 10-8S17.52 3 12 3z"
      />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.83h5.4a4.62 4.62 0 0 1-2 3.03v2.5h3.23c1.9-1.74 2.97-4.3 2.97-7.34z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.23-2.5c-.9.6-2.04.95-3.39.95-2.6 0-4.8-1.76-5.6-4.12H3.07v2.58A10 10 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.4 13.9A6 6 0 0 1 6.08 12c0-.66.11-1.3.32-1.9V7.52H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.48L6.4 13.9z" />
      <path fill="#EA4335" d="M12 5.98c1.47 0 2.78.5 3.82 1.5l2.86-2.86A10 10 0 0 0 12 2a10 10 0 0 0-8.93 5.52L6.4 10.1C7.2 7.74 9.4 5.98 12 5.98z" />
    </svg>
  );
}
