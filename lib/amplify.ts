"use client";

import { Amplify } from "aws-amplify";
import "aws-amplify/auth/enable-oauth-listener";

/** infra/write-env.sh 가 .env.local 에 채워 주는 값들. 비어 있으면 로그인 없이 이 기기에만 저장하는 모드로 돈다. */
export const env = {
  region: process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-northeast-2",
  userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID ?? "",
  clientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID ?? "",
  identityPoolId: process.env.NEXT_PUBLIC_IDENTITY_POOL_ID ?? "",
  table: process.env.NEXT_PUBLIC_TABLE ?? "maeum-ledger",
  authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN ?? "",
  kakao: process.env.NEXT_PUBLIC_KAKAO === "1",
};

export const cloudEnabled = !!(env.userPoolId && env.clientId && env.identityPoolId);

let configured = false;
export function configureAmplify() {
  if (configured || !cloudEnabled || typeof window === "undefined") return;
  configured = true;
  const here = `${window.location.origin}/`;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: env.userPoolId,
        userPoolClientId: env.clientId,
        identityPoolId: env.identityPoolId,
        loginWith: {
          email: true,
          ...(env.authDomain
            ? {
                oauth: {
                  domain: env.authDomain,
                  scopes: ["openid", "email", "profile", "aws.cognito.signin.user.admin"],
                  redirectSignIn: [here],
                  redirectSignOut: [here],
                  responseType: "code" as const,
                  providers: [{ custom: "Kakao" }],
                },
              }
            : {}),
        },
      },
    },
  });
}

configureAmplify();
