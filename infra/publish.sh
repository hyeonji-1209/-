#!/usr/bin/env bash
# 빌드해서 S3 에 올리고 CloudFront 캐시를 비운다.
set -euo pipefail
cd "$(dirname "$0")/.."
PROFILE="${AWS_PROFILE:-personal}"; STACK="${STACK:-maeum-site}"
out() { aws cloudformation describe-stacks --stack-name "$STACK" --profile "$PROFILE" --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
BUCKET=$(out BucketName); DIST=$(out DistributionId)
npm run build
# HTML·아이콘 등은 브라우저가 매번 다시 확인하게(no-cache), 해시가 붙은 _next/static 은 1년 캐시
aws s3 cp out/ "s3://$BUCKET" --recursive --exclude "_next/static/*" --cache-control "no-cache" --profile "$PROFILE" --only-show-errors
aws s3 sync out/ "s3://$BUCKET" --delete --exclude "*" --include "_next/static/*" --cache-control "public,max-age=31536000,immutable" --profile "$PROFILE" --only-show-errors
aws s3 sync out/ "s3://$BUCKET" --delete --exclude "_next/static/*" --profile "$PROFILE" --only-show-errors
aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/*' --profile "$PROFILE" --query 'Invalidation.Id' --output text
echo "올렸어요: $(out SiteUrl)"
