#!/usr/bin/env bash
# 개인 AWS 계정(personal 프로필)에 로그인 + DB 스택을 올리고 .env.local 을 갱신한다.
# 카카오 로그인 켜기: infra/deploy.sh KakaoClientId=REST_API_KEY KakaoClientSecret=CLIENT_SECRET
# 배포 주소 추가:    infra/deploy.sh "CallbackUrls=http://localhost:3000/,https://내주소/" "LogoutUrls=http://localhost:3000/,https://내주소/"
set -euo pipefail
cd "$(dirname "$0")/.."
PROFILE="${AWS_PROFILE:-personal}"; REGION="${AWS_REGION:-ap-northeast-2}"; STACK="${STACK:-maeum-ledger}"
ARGS=(); [ $# -gt 0 ] && ARGS=(--parameter-overrides "$@")
aws cloudformation deploy --template-file infra/stack.yaml --stack-name "$STACK" \
  --capabilities CAPABILITY_IAM --profile "$PROFILE" --region "$REGION" --no-fail-on-empty-changeset "${ARGS[@]}"
exec "$(dirname "$0")/write-env.sh"
