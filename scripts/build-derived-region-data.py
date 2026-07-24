#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
파생 지역 데이터 생성 — 소득(시도) · 접근성(시군구).

외부 API(data.go.kr/KOSIS) egress가 차단된 환경이라, 공개 통계를 코드로 정리한
"큐레이션 오프라인 참조표"를 만든다. 정밀 수치가 아니라 **오디널(순위·등급) 근사**이며,
출처와 한계는 data/README.md 에 명시한다. 원본 데이터가 확보되면 이 스크립트만 교체.

산출물(src/server/data/region/):
  · income-by-sido.json  — 시도 1인당 개인소득 상대지수(전국=100)·5분위·순위
  · access-by-sgg.json    — 시군구 광역 대중교통 접근 등급(0~3)·수단 태그

키 검증: population-by-sgg.json 의 canonical key(255) 전수에 대해 접근성 값을 채운다.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "src", "server", "data", "region")

# ── ① 소득: 시도별 1인당 개인소득 상대지수(전국=100) ─────────────────────────
# 출처: 통계청 「지역소득」 1인당 개인소득(가계 최종 처분가능소득 기반) 시도 순위.
# 개인소득은 재분배 후 지표라 시도 간 격차가 GRDP보다 좁다(대개 92~114 범위).
# 값은 최근 확정연도 기준 상대 근사(오디널 신뢰, 절대값 아님). 5분위: 5=최상위.
SIDO_INCOME_INDEX = {
    "서울": 114,
    "울산": 108,
    "세종": 106,
    "대전": 101,
    "경기": 100,
    "광주": 99,
    "부산": 98,
    "충남": 98,
    "인천": 97,
    "제주": 97,
    "대구": 96,
    "경남": 96,
    "충북": 96,
    "강원": 95,
    "경북": 94,
    "전남": 94,
    "전북": 93,
}


def build_income():
    ordered = sorted(SIDO_INCOME_INDEX.items(), key=lambda kv: -kv[1])
    n = len(ordered)
    out = {}
    for rank, (sido, idx) in enumerate(ordered, start=1):
        # 5분위: 상위 20%씩. rank 1~3=5분위 … (17개 → 대략 3~4개씩)
        quintile = 5 - ((rank - 1) * 5) // n  # rank1→5 … rankN→1
        out[sido] = {"index": idx, "quintile": quintile, "rank": rank, "total": n}
    return out


# ── ② 접근성: 시군구 광역 대중교통 접근 등급 ─────────────────────────────────
# 등급 정의(오디널):
#   3 = 다노선 도시철도 환승 거점(광역 유입 강)
#   2 = 도시철도/수도권 전철 정차
#   1 = KTX/SRT·광역철도·경전철 접근(도시철도망 밖이나 광역 연결)
#   0 = 철도 접근 미약(버스 위주)
# 분류는 운영 중 노선 기준 큐레이션. 기본 0에서 아래 집합만 상향.

# 3등급(다노선 도시철도 환승 거점)
HUB3 = set()
# 서울 25개 자치구 전부(지하철 다노선)
SEOUL = ["종로구","중구","용산구","성동구","광진구","동대문구","중랑구","성북구","강북구","도봉구",
         "노원구","은평구","서대문구","마포구","양천구","강서구","구로구","금천구","영등포구","동작구",
         "관악구","서초구","강남구","송파구","강동구"]
for g in SEOUL:
    HUB3.add(f"서울|{g}")
HUB3 |= {"부산|중구","부산|부산진구","부산|동래구","대구|중구","인천|부평구","광주|광산구","대전|동구",
         # 경기 다노선 환승 거점
         "경기|수원팔달구","경기|수원영통구","경기|성남분당구","경기|안양동안구","경기|부천원미구",
         "경기|부천소사구","경기|광명시","경기|용인기흥구","경기|의정부시"}

# 2등급(도시철도/수도권 전철 정차)
RAIL2 = set()
# 부산 도시철도 자치구
for g in ["서구","동구","영도구","남구","북구","해운대구","사하구","금정구","연제구","수영구","사상구","강서구"]:
    RAIL2.add(f"부산|{g}")
# 대구 도시철도 자치구
for g in ["동구","서구","남구","북구","수성구","달서구"]:
    RAIL2.add(f"대구|{g}")
# 인천 도시철도/전철 자치구
for g in ["중구","동구","미추홀구","연수구","남동구","계양구","서구"]:
    RAIL2.add(f"인천|{g}")
# 광주 1호선 통과 자치구
for g in ["동구","서구","남구"]:
    RAIL2.add(f"광주|{g}")
# 대전 1호선 통과 자치구
for g in ["중구","서구","유성구"]:
    RAIL2.add(f"대전|{g}")
# 경남 양산(부산 2호선 연장)
RAIL2.add("경남|양산시")
# 충남 천안 2개 구(수도권 전철 1호선 종점)·아산(1호선 온양온천+천안아산 KTX)
RAIL2 |= {"충남|천안동남구","충남|천안서북구","충남|아산시"}
# 경기 수도권 전철망: 포천·안성 제외 전 시군구가 전철 접근(default 2). 아래에서 일괄 처리.

# 1등급(KTX/SRT·광역철도·경전철 접근)
ACCESS1 = set()
ACCESS1 |= {"부산|기장군","대구|달성군","광주|북구","대전|대덕구"}
# 울산(도시철도 없음, 동해선·KTX울산역)
ACCESS1 |= {"울산|남구","울산|북구","울산|울주군"}
# 세종(조치원 경부선)
ACCESS1 |= {"세종|세종"}
# 강원 KTX/준고속
ACCESS1 |= {"강원|춘천시","강원|원주시","강원|강릉시","강원|동해시","강원|평창군"}
# 충북 오송 KTX(청주 흥덕구)
ACCESS1 |= {"충북|청주흥덕구"}
# 충남 공주 KTX
ACCESS1 |= {"충남|공주시"}
# 전북 호남/전라선 KTX
ACCESS1 |= {"전북|익산시","전북|정읍시","전북|남원시","전북|김제시"}
# 전남 호남/전라선 KTX
ACCESS1 |= {"전남|목포시","전남|순천시","전남|여수시","전남|나주시","전남|광양시"}
# 경북 경부/중앙선 KTX·KTX-이음
ACCESS1 |= {"경북|포항남구","경북|포항북구","경북|경주시","경북|김천시","경북|구미시","경북|안동시","경북|영주시"}
# 경남 경전선 KTX·부산김해경전철
ACCESS1 |= {"경남|김해시","경남|창원의창구","경남|창원성산구","경남|창원마산합포구","경남|창원마산회원구",
            "경남|진주시","경남|밀양시"}

MODES = {  # 등급별 대표 수단 태그(라벨용)
    3: ["도시철도(다노선)"],
    2: ["도시철도·전철"],
    1: ["KTX·광역철도"],
    0: ["버스 위주"],
}


def build_access(keys):
    out = {}
    for k in keys:
        sido = k.split("|")[0]
        lvl = 0
        if k in HUB3:
            lvl = 3
        elif k in RAIL2:
            lvl = 2
        elif k in ACCESS1:
            lvl = 1
        elif sido == "경기" and k not in ("경기|포천시", "경기|안성시"):
            # 수도권 전철망: 포천·안성 외 경기 전 시군구는 전철 접근(2)
            lvl = 2
        out[k] = {"level": lvl, "modes": MODES[lvl]}
    return out


def main():
    pop = json.load(open(os.path.join(OUT, "population-by-sgg.json"), encoding="utf-8"))
    keys = list(pop.keys())

    income = build_income()
    access = build_access(keys)

    json.dump(income, open(os.path.join(OUT, "income-by-sido.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    json.dump(access, open(os.path.join(OUT, "access-by-sgg.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    from collections import Counter
    dist = Counter(v["level"] for v in access.values())
    print(f"income: {len(income)} 시도")
    print(f"access: {len(access)} 시군구  등급분포 " + " ".join(f"L{l}={dist[l]}" for l in (3, 2, 1, 0)))


if __name__ == "__main__":
    main()
