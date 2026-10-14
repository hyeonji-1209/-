#!/usr/bin/env bash
# 빌드해서 S3 에 올리고 CloudFront 캐시를 비운다.
set -euo pipefail
cd "$(dirname "$0")/.."
PROFILE="${AWS_PROFILE:-personal}"; STACK="${STACK:-maeum-site}"
out() { aws cloudformation describe-stacks --stack-name "$STACK" --profile "$PROFILE" --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
BUCKET=$(out BucketName); DIST=$(out DistributionId)
npm run build
aws s3 sync out/ "s3://$BUCKET" --delete --profile "$PROFILE"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/*' --profile "$PROFILE" --query 'Invalidation.Id' --output text
echo "올렸어요: $(out SiteUrl)"
