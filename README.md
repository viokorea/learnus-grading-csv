# LearnUs 채점 CSV 변환기

채점 완료 엑셀과 LearnUs 채점 워크시트로 점수·피드백 댓글 업로드용 CSV를 만듭니다. AI와 서버가 필요하지 않으며 파일은 브라우저에서만 처리합니다.

- 퀴즈와 다중 문제 과제의 배점·점수 합산 및 만점 환산
- 분반 전체의 점수·감점 사유·총점 검증 후 다음 단계 진행
- Quiz/Assignment·주차·분반 파일명 확인, 모호한 정보의 수동 확인
- 다음 클릭 대상 강조와 단계별 화면 표시
- 전체 CSV 일괄 다운로드
- 처음 5명 CSV 미리보기, 줄바꿈 표시, LearnUs 설정부터 설명하는 캡처 안내
- Pretendard 폰트 자체 호스팅

사이트: https://viokorea.github.io/learnus-grading-csv/

HTML·CSS·JS, 라이브러리·폰트와 학생 정보가 없는 안내 캡처만 포함합니다. 학생 데이터, 엑셀, CSV는 저장소에 포함하지 마세요.

같은 활동·분반에서 다운로드한 원본 파일명의 워크시트가 필요합니다. 파일명을 변경하지 마세요. 종류 확인은 파일명에 기반하며 실제 LearnUs 활동을 직접 조회하지 않습니다. 엑셀에는 학번·성명·분반, `1번(10점)` 또는 `1번(5점)` 형태의 열과 바로 옆 사유 열이 필요합니다. 수식은 Excel에서 계산 후 저장하세요.

## 개발

`python3 -m http.server 8765`로 로컬 미리보기. `node tests/test-converter.cjs`와 `node tests/test-ui.cjs`로 검증합니다.

## 배포

GitHub Pages: main 브랜치 루트, `.nojekyll`로 정적 파일을 그대로 배포합니다.

## 포함 라이브러리

SheetJS CE 0.20.3 (Apache-2.0): vendor/SHEETJS-LICENSE.txt
Pretendard Variable (SIL OFL): fonts/OFL.txt
