# Subtitler

> 텍스트로 영상의 타이밍과 자막을 기술하고, 브라우저에서 MP4로 렌더링하는 Video Authoring Language.

[![Live](https://img.shields.io/badge/Live-subtitler.joun.cc-18181b?style=flat-square)](https://subtitler.joun.cc)
![WebCodecs](https://img.shields.io/badge/WebCodecs-browser--native-2563eb?style=flat-square)
![Privacy](https://img.shields.io/badge/Privacy-local--only-16a34a?style=flat-square)

```text
3.2 버튼이 작동하지 않아요.
4 이 부분을 변경해주세요.
6 2 어색해 보여요.
```

이 스크립트는 세 개의 자막을 영상에 배치합니다. Subtitler는 결과를 바로 미리 보여주고 MP4로 내보냅니다.

**[subtitler.joun.cc에서 실행하기 →](https://subtitler.joun.cc)**

## 빠르게 시작하기

1. [Subtitler](https://subtitler.joun.cc)를 엽니다.
2. MP4, MOV 또는 M4V 영상을 끌어다 놓습니다.
3. 타임스탬프와 자막을 한 줄씩 입력합니다.
4. 입력한 줄을 선택하거나 타임라인을 움직여 결과를 미리 봅니다.
5. 자막 스타일을 선택합니다.
6. **메모가 포함된 영상 내보내기**를 누릅니다.

영상은 서버로 업로드되지 않습니다. 브라우저가 기기 안에서 영상을 처리하고 `video-annotated.mp4`를 다운로드합니다.

## 로컬에서 실행하기

Node.js 22 이상을 준비합니다.

```bash
npm install
npm run start
```

<http://127.0.0.1:5173>을 엽니다.

### Docker로 실행하기

```bash
docker compose up --build
```

<http://127.0.0.1:3011>을 엽니다.

Compose 설정은 외부 Docker 네트워크 `proxy`를 사용합니다. 네트워크가 없다면 생성합니다.

```bash
docker network create proxy
```

## 스크립트 작성하기

한 줄에 하나의 자막을 작성합니다.

```text
시간 [지속시간] 내용
```

### 다음 자막까지 표시하기

```text
3.2 버튼이 작동하지 않아요.
4 이 부분을 변경해주세요.
```

첫 번째 자막은 3.2초에 시작하고 4초에 끝납니다. 마지막 자막의 기본 표시 시간은 3초입니다.

### 표시 시간 지정하기

```text
6 2 어색해 보여요.
```

자막을 6초부터 2초 동안 표시합니다.

### 분과 초 사용하기

```text
01:15.5 마지막 장면입니다.
```

자막을 1분 15.5초부터 표시합니다.

## 미리보기 확인하기

영상을 불러온 뒤 스크립트에서 원하는 줄로 커서를 옮기면 해당 줄의 시작 시점으로 영상이 이동합니다. 타임라인 슬라이더와 **−0.1s**, **+0.1s** 버튼을 사용하면 자막 타이밍을 더 세밀하게 확인할 수 있습니다.

## 자막 스타일 바꾸기

다음 프리셋 중 하나를 선택합니다.

- 클래식
- 깔끔한 박스
- 임팩트
- 소프트 아웃라인
- 하이 콘트라스트
- 에디토리얼 바

프리셋을 선택하면 해당 프리셋의 CSS가 **고급: CSS로 직접 조정** 편집기에 불러와집니다. 더 세밀한 제어가 필요하면 이 CSS를 수정합니다.

```css
.caption {
  color: #ffd400;
  font-size: 5cqw;
}

.caption-word {
  letter-spacing: 0.02em;
}
```

`.caption`, `.caption-line`, `.caption-word`를 선택자로 사용할 수 있습니다. 외부 `@import`와 `url(...)`은 미리보기와 내보내기에서 무시됩니다.

선택한 프리셋과 수정한 CSS는 브라우저에 자동 저장되어 다음 방문에도 복원됩니다. **프리셋으로 되돌리기**를 누르면 현재 프리셋의 기본 CSS를 다시 불러옵니다.

## 현재 지원하는 기능

- MP4, MOV, M4V 입력
- 타임스탬프 기반 자막 스크립트
- 스크립트 줄 선택 시 해당 타임스탬프로 이동
- 타임라인 미리보기와 0.1초 단위 이동
- 6가지 자막 프리셋
- 자동 저장되는 사용자 CSS와 프리셋 복원
- H.264 MP4 내보내기
- 원본 오디오 유지
- 한국어·영어 UI 자동 전환
- 브라우저 내부 영상 처리

## 렌더링 과정

```text
Video + Script + Style
          ↓
     Parse timeline
          ↓
 Decode → Composite → Encode
          ↓
          MP4
```

1. Subtitler가 스크립트를 시간 기반 장면 데이터로 변환합니다.
2. [Mediabunny](https://mediabunny.dev/)가 영상 컨테이너를 읽습니다.
3. WebCodecs가 영상 프레임을 디코딩하고 H.264로 인코딩합니다.
4. Canvas가 각 프레임에 자막을 합성합니다.
5. 브라우저가 완성된 MP4를 다운로드합니다.

Node.js 서버는 HTML과 JavaScript만 제공합니다. 영상 파일과 렌더링 결과를 저장하지 않습니다.

## 브라우저 요구사항

최신 Chrome 또는 Edge를 사용합니다. 영상 내보내기에는 WebCodecs와 H.264 인코딩 지원이 필요합니다.

브라우저나 운영체제가 원본 영상의 코덱을 지원하지 않으면 내보내기가 중단됩니다.

## 프로젝트가 지향하는 것

Subtitler는 타임스탬프 자막에서 시작합니다. 목표는 영상 전체를 텍스트로 기술하는 작은 언어와 브라우저 네이티브 렌더러를 만드는 것입니다.

- 텍스트, 이미지, 도형 배치
- 전환과 시간 기반 애니메이션
- 재사용 가능한 스타일과 템플릿
- 사람이 읽고 도구가 생성할 수 있는 프로젝트 포맷

---

Describe in text. Preview instantly. Render locally.
