#!/usr/bin/env bash
# 빌드해서 S3 에 올리고 CloudFront 캐시를 비운다.
set -euo pipefail
cd "$(dirname "$0")/.."
PROFILE="${AWS_PROFILE:-personal}"; STACK="${STACK:-maeum-site}"
out() { aws cloudformation describe-stacks --stack-name "$STACK" --profile "$PROFILE" --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
BUCKET=$(out BucketName); DIST=$(out DistributionId)
npm run build
# 해시가 붙은 _next/static 을 먼저 올린다. HTML 을 먼저 올리면 그 사이에 들어온 사람은 아직 없는 파일을 받으려다 깨진다.
# 옛 static 은 HTML 을 바꾼 뒤에 지운다(옛 HTML 을 이미 받은 사람이 쓰는 중일 수 있으니)
aws s3 cp out/_next/static "s3://$BUCKET/_next/static" --recursive --cache-control "public,max-age=31536000,immutable" --profile "$PROFILE" --only-show-errors
# HTML·아이콘 등은 브라우저가 매번 다시 확인하게(no-cache)
aws s3 cp out/ "s3://$BUCKET" --recursive --exclude "_next/static/*" --cache-control "no-cache" --profile "$PROFILE" --only-show-errors
aws s3 sync out/ "s3://$BUCKET" --delete --exclude "_next/static/*" --profile "$PROFILE" --only-show-errors
aws s3 sync out/_next/static "s3://$BUCKET/_next/static" --delete --profile "$PROFILE" --only-show-errors
aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/*' --profile "$PROFILE" --query 'Invalidation.Id' --output text
echo "올렸어요: $(out SiteUrl)"
