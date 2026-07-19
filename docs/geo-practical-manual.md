# GEO 실무 적용 매뉴얼

작성일: 2026-07-18  
목적: GEO(Generative Engine Optimization)를 위해 실무자가 해야 할 일을 논문 데이터에 근거해 우선순위별 업무 절차로 정리한다.

## 근거와 사용 원칙

이 문서는 2026년 7월 18일 기준으로 확인한 다음 자료에 근거한다.

- Critical survey: "Optimizing Visibility in Generative Engines: A Systematic and Critical Survey" (arXiv:2607.14035)
- 공개 문헌 매트릭스: https://arxiv.org/src/2607.14035/anc/literature_matrix.csv
- 대표 원문: Aggarwal et al. "GEO: Generative Engine Optimization" (arXiv:2311.09735)
- 대표 원문: Puerto et al. "C-SEO Bench" (arXiv:2506.11097)
- 대표 원문: Schulte et al. "Don't Measure Once" (arXiv:2604.07585)
- 대표 원문: Vishwakarma et al. "What Gets Cited" (arXiv:2605.25517)
- 대표 원문: Xu et al. "Measuring Google AI Overviews" (arXiv:2605.14021)

해석 원칙:

- 논문들이 공통으로 지지하는 것은 "LLM을 속이는 문구"가 아니라 "검색되고, 이해되고, 인용 가능한 원천 정보"를 만드는 것이다.
- 많은 GEO 연구는 고정 후보 문서, 시뮬레이터, 자동 평가자, preprint 환경에 의존한다. 따라서 현업 적용 시 반드시 자체 반복 측정이 필요하다.
- 업무 우선순위는 "측정 → 검색 후보 진입 → 답변형 콘텐츠 → 인용 증거 → 외부 신뢰 → 품질/리스크" 순서로 둔다.

---

## 1. 측정 세트 만들기

### 목표

GEO 성과를 감으로 판단하지 않고, 엔진별·질의별·반복 실행별로 측정 가능한 상태를 만든다.

### 논문 근거

- Schulte et al. "Don't Measure Once": generative engine visibility는 단일 측정값이 아니라 분포로 봐야 한다고 주장한다.
- Grossman et al. "How Generative AI Disrupts Search": Google SERP, AI Overviews, Gemini 간 source overlap이 낮다고 보고한다.
- Kirsten et al. "Characterizing Web Search": AI Overviews cited domain 중 상당수가 전통 Google top 10 밖에 있음을 보고한다.
- Chen et al. "CC-GSEO-Bench": exposure, faithful credit, source influence를 분리해 측정해야 함을 제안한다.
- Zhang et al. "Citation Absorption": 단순 citation 여부보다 답변 안에 source 내용이 얼마나 흡수되는지가 중요하다고 본다.

### 업무 절차

1. 핵심 질의군을 만든다.
   - 브랜드명 질의: "[브랜드명]", "[브랜드명] 가격", "[브랜드명] 후기"
   - 카테고리 질의: "최고의 [카테고리] 추천", "[카테고리] 비교"
   - 문제 기반 질의: "[문제] 해결 방법", "[상황]에 적합한 [제품/서비스]"
   - 대안 질의: "[경쟁사] 대안", "[브랜드명] vs [경쟁사]"
   - 구매 의도 질의: "[카테고리] 가격", "[카테고리] 도입 전 체크리스트"
   - 정보 탐색 질의: "[주제]란", "[주제] 방법", "[주제] 사례"

2. 질의 수를 정한다.
   - 초기 진단: 50개
   - 운영 대시보드: 100-200개
   - 대형 사이트/커머스: 카테고리별 100개 이상

3. 엔진을 나눈다.
   - ChatGPT
   - Perplexity
   - Gemini
   - Google AI Overviews
   - Google 일반 SERP
   - 필요 시 Bing Copilot, Claude search, SearchGPT 계열 도구

4. 반복 측정 규칙을 정한다.
   - 같은 질의를 최소 5회 반복한다.
   - 주 1회 고정 측정한다.
   - 주요 콘텐츠 변경 후 24시간, 7일, 14일, 30일 시점에 재측정한다.
   - 지역, 언어, 로그인 여부, 브라우저 상태를 기록한다.

5. 결과를 구조화한다.
   - answer_text: 생성 답변 전문
   - mentioned_brand: 브랜드 언급 여부
   - cited_url: 인용 URL
   - cited_domain: 인용 도메인
   - citation_position: 첫 번째, 두 번째, 세 번째 등
   - claim_supported: 답변 claim이 실제 cited page와 일치하는지
   - share_of_answer: 답변 중 우리 정보가 차지하는 비중
   - competitor_mentions: 경쟁사 언급
   - wrong_claims: 틀린 정보
   - referral_sessions: AI referral traffic
   - conversion: AI referral 전환

### 산출물

- `GEO Query Set`
- `Engine Visibility Dashboard`
- `Citation Accuracy Log`
- `Wrong Answer Backlog`
- `Content Change Impact Report`

### KPI

- AI answer mention rate
- AI citation rate
- citation position
- claim support rate
- answer share
- competitor gap
- AI referral sessions
- AI referral conversion rate

### 체크리스트

- [ ] 브랜드, 카테고리, 문제, 대안, 구매, 정보 질의를 모두 포함했다.
- [ ] 같은 질의를 여러 엔진에서 측정한다.
- [ ] 같은 질의를 반복 실행해 평균과 분산을 본다.
- [ ] "언급"과 "인용"과 "정확한 인용"을 구분한다.
- [ ] 콘텐츠 변경 전후를 같은 기준으로 비교한다.

### 주의사항

- 한 번의 AI 답변으로 성패를 판단하지 않는다.
- Google 순위만으로 AI Overviews 노출을 예측하지 않는다.
- citation이 있다고 해서 해당 claim이 정확하다고 보지 않는다.

---

## 2. 검색 후보 진입 개선

### 목표

AI answer engine이 답변을 만들기 전에 우리 페이지를 검색 후보, retrieved context, cited source 후보에 넣을 가능성을 높인다.

### 논문 근거

- Puerto et al. "C-SEO Bench": C-SEO rewrite 기법의 효과는 제한적이며, 전통 SEO 방식의 candidate ranking이 더 중요하다고 보고한다.
- Vishwakarma et al. "What Gets Cited": topical relevance와 list position이 citation probability에 큰 영향을 준다고 보고한다.
- Kim et al. "SAGEO Arena": citation 중심 rewrite가 retrieval/reranking을 악화할 수 있음을 보고한다.
- Ho et al. "Rewrite-to-Rank": rewrite는 inclusion 개선에 도움을 줄 수 있으나 절대 rank 효과는 제한적이라고 보고한다.

### 업무 절차

1. 크롤링 가능성을 점검한다.
   - robots.txt에서 Googlebot, Bingbot, GPTBot, PerplexityBot 등 주요 crawler 정책을 확인한다.
   - 중요한 페이지가 noindex, canonical 오류, 로그인 장벽, JS 렌더링 문제에 막히지 않는지 확인한다.
   - sitemap.xml에 핵심 페이지가 포함되어 있는지 확인한다.

2. 색인 상태를 점검한다.
   - Google Search Console에서 색인 여부를 확인한다.
   - 핵심 URL을 `site:domain.com 핵심 키워드`로 검색한다.
   - 제목, meta description, canonical, hreflang, structured data 오류를 확인한다.

3. query-page mapping을 만든다.
   - 한 query cluster에는 대표 landing page 하나를 지정한다.
   - 서로 다른 의도의 query를 한 페이지에 과도하게 합치지 않는다.
   - 구매 의도, 비교 의도, 정보 탐색 의도, 문제 해결 의도를 분리한다.

4. 내부 링크를 설계한다.
   - 핵심 hub page에서 세부 page로 연결한다.
   - 세부 page에서 비교, FAQ, 사례, 가격, 문서 페이지로 연결한다.
   - anchor text는 실제 질의 의도와 맞춘다.

5. technical SEO를 정리한다.
   - Core Web Vitals
   - 서버 응답 속도
   - 모바일 렌더링
   - 중복 URL 정리
   - structured data
   - breadcrumb
   - product, organization, article, FAQ schema

6. 외부 검색 신호를 확보한다.
   - 업계 미디어
   - 리뷰 사이트
   - 파트너 페이지
   - 고객 사례
   - 비교/랭킹 페이지
   - 공신력 있는 디렉터리

### 산출물

- `Crawlability Audit`
- `Index Coverage Report`
- `Query-to-Page Map`
- `Internal Linking Plan`
- `Structured Data Checklist`
- `Technical SEO Fix Backlog`

### KPI

- indexed URL count
- core query ranking
- crawl errors
- sitemap coverage
- structured data valid page count
- AI cited URL 후보 수

### 체크리스트

- [ ] 핵심 페이지가 크롤링 가능하다.
- [ ] 핵심 페이지가 색인되어 있다.
- [ ] query cluster별 대표 URL이 있다.
- [ ] 내부 링크가 hub-and-spoke 구조를 갖는다.
- [ ] schema markup이 실제 페이지 내용과 일치한다.
- [ ] citation용 문구를 넣느라 검색 relevance를 훼손하지 않았다.

### 주의사항

- GEO rewrite가 검색 순위를 떨어뜨리면 전체 효과가 악화될 수 있다.
- AI crawler 허용 여부는 법무, 저작권, 콘텐츠 전략과 함께 결정한다.
- 생성형 엔진 노출만 보고 전통 SEO를 약화시키면 안 된다.

---

## 3. 질문에 바로 답하는 콘텐츠 만들기

### 목표

AI answer engine이 페이지 일부만 읽어도 사용자의 질문에 바로 답할 수 있게 만든다.

### 논문 근거

- Aggarwal et al. "GEO": quotations, statistics, citations 등 answer-friendly 요소가 visibility 개선에 도움을 줄 수 있다고 보고한다.
- Wan et al. "What Evidence...": query-document relevance가 여러 credibility signal보다 더 큰 영향을 줄 수 있다고 보고한다.
- Chen et al. "Mind Reader": latent demand coverage가 노출 개선에 도움이 될 수 있다고 주장한다.
- Zhou et al. "IF-GEO": 여러 query를 한 페이지에 동시에 최적화할 때 충돌 위험이 있음을 분석한다.
- Liu & Xu "FeatGEO": lexical edit보다 informational property가 더 중요하다고 보고한다.

### 업무 절차

1. 페이지의 target question을 하나 정한다.
   - 예: "B2B SaaS 가격 정책을 어떻게 설계해야 하는가?"
   - 예: "우리 제품은 어떤 고객에게 적합한가?"
   - 예: "[제품 A]와 [제품 B]의 차이는 무엇인가?"

2. 첫 100-200단어 안에 답을 배치한다.
   - 정의
   - 핵심 결론
   - 추천 대상
   - 예외 조건
   - 가격/스펙/제한사항
   - 업데이트 날짜

3. H2/H3를 질문형으로 설계한다.
   - "무엇인가?"
   - "누구에게 적합한가?"
   - "가격은 얼마인가?"
   - "대안은 무엇인가?"
   - "장단점은 무엇인가?"
   - "도입 전 확인할 점은 무엇인가?"

4. 답변 블록을 만든다.
   - 2-4문장 요약
   - 5-7개 bullet
   - 비교표
   - "추천 대상 / 비추천 대상"
   - "핵심 수치"
   - "근거 출처"

5. latent demand를 커버한다.
   - 사용자가 직접 묻지 않았지만 이어서 궁금해할 질문을 FAQ로 추가한다.
   - 가격, 구현 난이도, 리스크, 대안, 실패 조건을 포함한다.
   - 같은 페이지에 의도가 충돌하는 질문은 넣지 않는다.

6. 페이지 유형별 템플릿을 만든다.
   - 제품 페이지: 대상, 문제, 기능, 가격, 비교, 사례, FAQ
   - 비교 페이지: 기준, 차이, 추천 대상, 제한점, 최신 업데이트
   - 가이드 페이지: 정의, 절차, 체크리스트, 예시, 출처
   - 사례 페이지: 배경, 문제, 적용, 수치, 한계, 재현 조건

### 산출물

- `Answer-First Content Template`
- `Page Intent Brief`
- `FAQ Expansion List`
- `Comparison Table Template`
- `Content Rewrite Brief`

### KPI

- target query answer match score
- page-level mention rate
- citation rate by section
- FAQ citation count
- wrong answer reduction
- organic ranking movement

### 체크리스트

- [ ] 페이지마다 주 target question이 있다.
- [ ] 첫 화면에서 핵심 답이 보인다.
- [ ] H2/H3가 사용자의 실제 질문과 맞는다.
- [ ] 비교표, 요약, FAQ가 있다.
- [ ] 가격, 스펙, 대상, 조건이 모호하지 않다.
- [ ] 하나의 페이지에 의도가 다른 query를 과도하게 넣지 않았다.

### 주의사항

- LLM이 좋아할 법한 표현보다 정보 완전성이 중요하다.
- 너무 많은 query를 한 페이지에 넣으면 핵심 relevance가 흐려질 수 있다.
- 내용이 없는 FAQ 양산은 품질 신호를 약화시킬 수 있다.

---

## 4. 인용 가능한 증거 만들기

### 목표

AI가 답변에 사용할 수 있는 검증 가능한 근거, 수치, 출처, 문장 단위를 페이지 안에 제공한다.

### 논문 근거

- Aggarwal et al. "GEO": quotation, statistics, references가 visibility 개선에 도움이 될 수 있다고 보고한다.
- Liu et al. "Evaluating Verifiability": AI answer citation의 support와 correctness가 불완전함을 보고한다.
- Xu et al. "Measuring Google AI Overviews": AI Overviews의 cited page와 생성 claim 사이 불일치가 존재한다고 보고한다.
- Vykopal et al. "Credibility and Groundedness": assistant별 source credibility와 misinformation citation 차이를 분석한다.
- Zhang et al. "Citation Absorption": citation breadth와 depth를 구분해 봐야 한다고 제안한다.

### 업무 절차

1. citation unit을 만든다.
   - 1문장 정의
   - 1문장 결론
   - 1문장 수치
   - 1문장 비교 기준
   - 1문장 방법론

2. 수치와 날짜를 명확히 쓴다.
   - "2026년 7월 기준"
   - "조사 대상 120개"
   - "응답자 1,204명"
   - "월 $99부터"
   - "평균 32% 감소"

3. 출처를 붙인다.
   - 1차 데이터
   - 논문
   - 공식 문서
   - 고객 사례
   - 업계 보고서
   - 내부 조사 방법론

4. 비교표를 표준화한다.
   - 비교 기준
   - 우리 제품
   - 경쟁 제품
   - 추천 상황
   - 제한 사항
   - 출처/업데이트 날짜

5. claim inventory를 만든다.
   - 페이지에 있는 핵심 claim을 목록화한다.
   - 각 claim마다 근거 URL, 근거 유형, 업데이트 날짜를 연결한다.
   - 근거 없는 claim은 삭제하거나 완화한다.

6. citation QA를 실행한다.
   - AI가 우리 페이지를 인용한 답변을 수집한다.
   - 답변 claim이 실제 페이지 내용과 일치하는지 표시한다.
   - 불일치하면 페이지의 표현을 더 명확하게 고친다.

### 산출물

- `Claim Inventory`
- `Citation Unit Library`
- `Source Evidence Table`
- `Comparison Evidence Table`
- `AI Citation QA Log`

### KPI

- supported claim rate
- citation accuracy rate
- cited section count
- unsupported claim count
- outdated claim count
- answer absorption score

### 체크리스트

- [ ] 핵심 claim마다 근거가 있다.
- [ ] 숫자에는 날짜와 조건이 있다.
- [ ] 비교에는 기준이 있다.
- [ ] 표와 요약이 페이지 본문에 실제로 존재한다.
- [ ] AI가 오해하기 쉬운 과장 표현을 줄였다.
- [ ] 인용된 답변의 claim support를 검수했다.

### 주의사항

- 인용을 유도하려고 근거 없는 숫자를 만들면 안 된다.
- schema에만 넣고 본문에는 없는 정보는 위험하다.
- "최고", "유일", "가장 빠른" 같은 claim은 강한 근거가 없으면 피한다.

---

## 5. 외부 신뢰 구축

### 목표

AI answer engine이 자사 사이트 밖에서도 브랜드, 제품, 저자, 카테고리를 신뢰할 수 있게 만든다.

### 논문 근거

- Li & Sinnamon "Arbiters of Public Knowledge": answer engine이 인용하는 도메인이 집중되고 편중될 수 있음을 분석한다.
- Chen et al. "How to Dominate AI Search": 여러 AI search engine에서 third-party media 선호를 관찰한다.
- Allaham & Diakopoulos "Synthetic Sources": AI-generated synthetic source가 citation 생태계에 섞여 있음을 분석한다.
- Sharma "Discovery Gap": 브랜드 인지도와 카테고리 organic discovery가 다를 수 있음을 보여준다.
- Vishwakarma et al. "What Gets Cited": topical relevance와 position 외에도 일부 맥락 신호가 citation probability에 영향을 줄 수 있음을 보고한다.

### 업무 절차

1. entity profile을 정리한다.
   - 브랜드명
   - 제품명
   - 카테고리
   - 대표 설명문
   - 공식 URL
   - 창업자/저자/전문가
   - 주요 고객군
   - 경쟁/대안 제품

2. 외부 mention inventory를 만든다.
   - 언론 기사
   - 리뷰 사이트
   - 파트너 페이지
   - 고객 사례
   - 업계 리포트
   - 마켓플레이스
   - 디렉터리
   - 커뮤니티
   - 논문/백서/컨퍼런스 자료

3. 정보 일관성을 맞춘다.
   - 제품 설명
   - 가격
   - 카테고리
   - 로고/브랜드 표기
   - 회사명
   - URL
   - 고객군
   - 주요 기능

4. third-party 콘텐츠를 만든다.
   - 고객 사례
   - 전문가 인터뷰
   - 비교 리뷰
   - 업계 리포트 참여
   - 파트너 공동 문서
   - 데이터 기반 리서치

5. 카테고리 discovery를 개선한다.
   - 브랜드명 없이도 발견될 query를 정의한다.
   - "문제 → 카테고리 → 대안 → 제품" 흐름의 외부 mention을 확보한다.
   - 경쟁사 대안 페이지와 category guide를 만든다.

6. 평판 리스크를 모니터링한다.
   - 잘못된 가격
   - 오래된 제품 설명
   - 부정확한 리뷰
   - 경쟁사 중심 비교
   - AI-generated 저품질 mention

### 산출물

- `Entity Profile`
- `External Mention Inventory`
- `Third-Party Source Gap Analysis`
- `PR and Review Target List`
- `Category Discovery Plan`

### KPI

- authoritative mention count
- third-party citation rate
- brand mention consistency
- category query discovery rate
- competitor-only answer rate
- outdated external claim count

### 체크리스트

- [ ] 브랜드/제품 설명이 외부 사이트에서도 일관된다.
- [ ] 권위 있는 third-party source에 언급되어 있다.
- [ ] 브랜드명 없는 카테고리 질의에서도 발견된다.
- [ ] 경쟁사 대안/비교 맥락에 들어가 있다.
- [ ] 외부 사이트의 오래된 정보가 수정되었다.

### 주의사항

- paid placement는 표시 의무와 신뢰 리스크를 검토한다.
- AI-generated 저품질 외부 글을 대량 배포하는 방식은 장기 리스크가 크다.
- 자사 사이트만 최적화하면 entity 신뢰 형성이 부족할 수 있다.

---

## 6. 품질과 리스크 관리

### 목표

GEO 작업이 hallucination, citation 오류, ranking manipulation, spam, 브랜드 훼손으로 이어지지 않게 통제한다.

### 논문 근거

- Pfrommer et al. "Ranking Manipulation": RAG/Perplexity 환경에서 ranking manipulation 가능성을 보고한다.
- Nestaas et al. "Adversarial SEO": production system도 adversarial SEO에 취약할 수 있음을 보인다.
- Qian et al. "Ranking Blind Spot": LLM ranker의 blind spot을 분석한다.
- Zheng et al. "GRADA": graph-based reranking이 공격 방어에 도움을 줄 수 있다고 보고한다.
- Wen et al. "GEO Risks": concentration, disclosure, integrity 리스크를 제기한다.
- Hu "Dynamics of Adversarial Attacks": ranking attack 경쟁을 반복게임으로 모델링한다.

### 업무 절차

1. 금지 전술을 명문화한다.
   - hidden prompt injection
   - invisible text
   - keyword stuffing
   - fake review
   - fabricated statistics
   - unsupported superlatives
   - cloaking
   - schema spam
   - AI-only doorway pages

2. 콘텐츠 변경 승인 기준을 만든다.
   - claim 근거 확인
   - 법무/규제 표현 확인
   - 브랜드 톤 확인
   - SEO 영향 확인
   - AI answer 테스트 확인
   - rollback 가능 여부 확인

3. AI answer 오류를 수집한다.
   - 틀린 가격
   - 틀린 기능
   - 존재하지 않는 고객 사례
   - 경쟁사와 혼동
   - 오래된 정보
   - 잘못된 citation

4. 오류 수정 루프를 운영한다.
   - source page 표현을 명확히 고친다.
   - FAQ에 오해 방지 문구를 추가한다.
   - structured data를 실제 본문과 맞춘다.
   - 외부 사이트의 잘못된 정보를 수정 요청한다.
   - 엔진별 피드백/신고 채널을 사용한다.

5. 실험을 통제한다.
   - control page와 test page를 나눈다.
   - 변경 내용을 로그로 남긴다.
   - 측정 기간을 정한다.
   - traffic, ranking, AI citation을 함께 본다.
   - 악화 시 rollback한다.

6. governance를 만든다.
   - GEO owner
   - SEO owner
   - content owner
   - legal/review owner
   - analytics owner
   - release approver

### 산출물

- `GEO Risk Policy`
- `Forbidden Tactics List`
- `Content Change Approval Checklist`
- `AI Wrong Answer Log`
- `Rollback Plan`
- `Experiment Register`

### KPI

- unsupported claim count
- wrong answer count
- hallucinated citation count
- spam-risk page count
- rollback count
- legal review issue count

### 체크리스트

- [ ] 금지 전술이 문서화되어 있다.
- [ ] 자동 rewrite는 사람이 검수한다.
- [ ] 핵심 claim은 근거와 연결되어 있다.
- [ ] AI 답변 오류를 별도 backlog로 관리한다.
- [ ] 실험은 control과 rollback 계획이 있다.
- [ ] 단기 노출보다 브랜드 안전을 우선한다.

### 주의사항

- 조작 전술은 단기 효과가 있어도 장기적으로 경쟁 포화와 평판 리스크를 만든다.
- 자동 생성 콘텐츠는 사실성, 저작권, 표절, 브랜드 톤을 반드시 점검한다.
- GEO 성과를 과장 보고하지 않는다. preprint 기반 기법은 자체 검증 전까지 가설로 취급한다.

---

## 30일 실행 로드맵

### 1주차: 측정 기반 구축

- 핵심 query 50개를 선정한다.
- 측정 엔진을 정한다.
- 기본 visibility를 5회 반복 측정한다.
- mention, citation, claim support, wrong answer를 기록한다.

### 2주차: 검색 후보 진입 개선

- crawlability와 index coverage를 점검한다.
- query-to-page map을 만든다.
- 우선순위 페이지 10개를 선정한다.
- technical SEO backlog를 만든다.

### 3주차: 콘텐츠 구조 개선

- 우선순위 페이지 10개에 answer-first 구조를 적용한다.
- 첫 문단, H2/H3, FAQ, 비교표, claim unit을 정리한다.
- claim inventory와 source evidence table을 만든다.

### 4주차: 외부 신뢰와 리스크 운영

- 외부 mention inventory를 만든다.
- 잘못된 외부 정보를 수정 요청한다.
- third-party source gap을 정리한다.
- GEO risk policy와 forbidden tactics list를 확정한다.
- 변경 후 24시간, 7일 측정값을 비교한다.

---

## 운영 회의 아젠다

매주 GEO 운영 회의에서는 다음 순서로 본다.

1. 지난주 핵심 query visibility 변화
2. 엔진별 mention/citation 변화
3. wrong answer와 unsupported claim
4. 경쟁사 언급 변화
5. 콘텐츠 변경 영향
6. technical SEO issue
7. 외부 mention 확보 현황
8. 다음 주 실험과 rollback 기준

---

## 최종 원칙

GEO의 실무 핵심은 다음 여섯 가지다.

1. 측정하지 않으면 최적화하지 않는다.
2. 검색 후보에 들어가지 못하면 답변에 인용되기 어렵다.
3. 페이지는 질문에 직접 답해야 한다.
4. 답변에 쓰일 수 있는 근거 단위를 제공해야 한다.
5. 자사 밖의 신뢰 출처가 필요하다.
6. 조작보다 품질, 정확성, 투명성이 장기적으로 안전하다.

한 문장으로 요약하면, GEO는 "AI가 검색하고, 이해하고, 인용하고, 요약해도 안전한 원천 정보 구조를 만드는 운영 체계"다.
