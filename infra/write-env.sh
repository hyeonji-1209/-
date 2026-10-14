#!/usr/bin/env bash
# CloudFormation 스택 출력값을 읽어 .env.local 을 만든다.
set -euo pipefail
cd "$(dirname "$0")/.."
PROFILE="${AWS_PROFILE:-personal}"; REGION="${AWS_REGION:-ap-northeast-2}"; STACK="${STACK:-maeum-ledger}"
out() { aws cloudformation describe-stacks --stack-name "$STACK" --profile "$PROFILE" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
cat > .env.local <<ENV
NEXT_PUBLIC_AWS_REGION=$(out Region)
NEXT_PUBLIC_USER_POOL_ID=$(out UserPoolId)
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$(out UserPoolClientId)
NEXT_PUBLIC_IDENTITY_POOL_ID=$(out IdentityPoolId)
NEXT_PUBLIC_TABLE=$(out TableName)
NEXT_PUBLIC_AUTH_DOMAIN=$(out AuthDomain)
NEXT_PUBLIC_KAKAO=$(out KakaoEnabled)
ENV
echo ".env.local 을 썼어요:"; sed 's/=.*/=…/' .env.local
