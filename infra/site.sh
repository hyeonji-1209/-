#!/usr/bin/env bash
# 사이트 스택(S3 + CloudFront + Route 53) 배포. 인증서 때문에 us-east-1.
#   1단계: ./infra/site.sh            → 네임서버 4개가 출력된다. 가비아에 넣는다.
#   2단계: ./infra/site.sh ready      → 인증서 발급 + alicework.kr 연결 (네임서버 전파 뒤에)
set -euo pipefail
cd "$(dirname "$0")/.."
PROFILE="${AWS_PROFILE:-personal}"; STACK="${STACK:-maeum-site}"
READY=false; [ "${1:-}" = "ready" ] && READY=true
aws cloudformation deploy --template-file infra/site.yaml --stack-name "$STACK" \
  --profile "$PROFILE" --region us-east-1 --no-fail-on-empty-changeset \
  --parameter-overrides ZoneName=alicework.kr DomainName=heartledger.alicework.kr DomainReady=$READY
aws cloudformation describe-stacks --stack-name "$STACK" --profile "$PROFILE" --region us-east-1 \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' --output table
