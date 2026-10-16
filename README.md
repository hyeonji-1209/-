# 마음장부

축의금·부의금으로 주고받은 마음을 행사별로 한곳에 모아 두는 장부.

- 위쪽 카드에서 행사를 고르고, 바로 아래에서 **이름 · 금액 · 관계 버튼** 으로 적는다 (Enter 또는 →)
- 관계 버튼(친척·친구·교회…)은 "+ 추가"로 직접 만들고, 한 번 고르면 바꾸기 전까지 그대로 유지된다
- 카드에 사진을 끌어다 놓으면 대표 사진이 된다
- "엑셀로 다운받기"로 행사별 또는 전체 명단을 .xlsx 로 받는다
- 로그인은 소셜만(카카오, 구글). 비밀번호·이메일을 받지 않고 닉네임은 그 계정 이름을 쓴다. 어느 기기에서든 같은 장부를 본다 (AWS Cognito + DynamoDB). 로그인 설정이 없으면 이 기기에만 저장한다

## 실행

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # out/ 에 정적 사이트 생성
npm test        # lib 단위 테스트 (Node 22 내장 러너)
npm run typecheck
```

## 로그인 + DB (개인 AWS 계정, 서울 리전)

인프라는 `infra/stack.yaml` 한 장이다. Cognito 사용자 풀(소셜 로그인 전용), 아이덴티티 풀, DynamoDB 테이블 `maeum-ledger`,
그리고 "자기 pk 아래 항목만" 읽고 쓰게 하는 IAM 역할이 들어 있다.

```bash
# AWS CLI 의 personal 프로필(개인 계정)로 배포하고 .env.local 을 만든다
./infra/deploy.sh

# 이미 배포돼 있으면 .env.local 만 다시 만들기
./infra/write-env.sh
```

`.env.local` 은 커밋하지 않는다. 값이 비어 있으면 앱은 로그인 없이 로컬 모드로 돈다.

### 카카오 로그인 켜기

1. [카카오 개발자](https://developers.kakao.com) 에서 앱 생성 → 카카오 로그인 활성화 → **OpenID Connect 활성화**
2. 동의항목에서 `닉네임` 을 필수 동의로 (이메일은 필요 없다 → 비즈 앱 전환 불필요)
3. 보안 탭에서 Client Secret 생성 + 활성화
4. Redirect URI 에 `https://heartledger-610863997824.auth.ap-northeast-2.amazoncognito.com/oauth2/idpresponse` 등록
5. 배포:
   ```bash
   ./infra/deploy.sh KakaoClientId=REST_API_키 KakaoClientSecret=클라이언트_시크릿
   ```

### 구글 로그인 켜기

1. [Google Cloud 콘솔](https://console.cloud.google.com/apis/credentials) → 프로젝트 생성 → OAuth 동의 화면(외부, 앱 이름 마음장부) → 게시
2. 사용자 인증 정보 → OAuth 클라이언트 ID 만들기 → 웹 애플리케이션
   - 승인된 JavaScript 원본: `https://heartledger-610863997824.auth.ap-northeast-2.amazoncognito.com`
   - 승인된 리디렉션 URI: `https://heartledger-610863997824.auth.ap-northeast-2.amazoncognito.com/oauth2/idpresponse`
3. 배포 (카카오 키도 같이 넘겨야 유지된다):
   ```bash
   ./infra/deploy.sh KakaoClientId=… KakaoClientSecret=… GoogleClientId=… GoogleClientSecret=…
   ```

배포 주소가 생기면 `CallbackUrls`/`LogoutUrls` 파라미터에도 그 주소를 넣어 다시 배포한다.

## 배포 (alicework.kr)

정적 파일을 S3 에 두고 CloudFront 가 `https://heartledger.alicework.kr` 로 서빙한다. 스택은 `infra/site.yaml` (인증서 때문에 us-east-1).

```bash
./infra/site.sh          # 1단계: 네임서버 4개 출력 → 가비아 "네임서버 설정"에 입력
./infra/site.sh ready    # 2단계: 네임서버 전파 뒤 실행. 인증서 발급 + 도메인 연결 (이미 끝남)
./infra/publish.sh       # 빌드해서 올리기 (코드 바꿀 때마다)
```

도메인이 연결되면 로그인 콜백 주소도 추가한다:
```bash
./infra/deploy.sh "CallbackUrls=http://localhost:3000/,https://heartledger.alicework.kr/" "LogoutUrls=http://localhost:3000/,https://heartledger.alicework.kr/"
```
