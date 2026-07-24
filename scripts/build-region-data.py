#!/usr/bin/env python3
"""
상권분석 데이터 엔진 — 원본 3종(data/) → 압축 데이터셋(src/server/data/region/).

앱에 xlsx 파서 의존성을 넣지 않도록, 이 스크립트로 컴팩트 JSON을 "미리 생성·커밋"한다.
원본이 갱신되면 수동 재실행: `python3 scripts/build-region-data.py`

출력:
  region/population-by-sgg.json  ① 시군구별 총/남/여/여성비/증감 (행안부)
  region/hospitals-by-sgg.json   ② 시군구별 종별 병·의원 수 (심평원)
  region/demand-by-specialty.json ③ 표시과목별 상위 상병(환자수) (심평원)
  region/hospital-points.json.gz  ② 반경 밀집도용 개별 좌표(컬럼형, gzip)
  region/meta.json               생성 요약(행수·정규화 실패 등)

정규화(조인 키): `${시도축약}|${구정규화}` — 광주(전남 편입)·수원시 구 등 특수케이스 반영.
"""
import csv, io, json, gzip, os, collections, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(ROOT, "src", "server", "data", "region")
os.makedirs(OUT, exist_ok=True)

# ── 시도명 축약 ──────────────────────────────────────────────
SIDO_ABBR = {
    "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천",
    "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종",
    "경기도": "경기", "강원도": "강원", "강원특별자치도": "강원",
    "충청북도": "충북", "충청남도": "충남", "전라북도": "전북", "전북특별자치도": "전북",
    "전라남도": "전남", "경상북도": "경북", "경상남도": "경남",
    "제주특별자치도": "제주", "제주도": "제주", "세종시": "세종",
}
METROS = ["서울", "부산", "대구", "인천", "광주", "대전", "울산"]


def abbr_sido(s):
    s = (s or "").strip()
    return SIDO_ABBR.get(s, s)


def norm_district(d):
    """행안부 '수원시 장안구' → '수원장안구' (병원파일 표기와 통일). 공백·중간 '시 ' 제거."""
    return (d or "").replace("시 ", "").replace(" ", "").strip()


def fixup(key):
    """공통 특수케이스 보정: 세종(시군구 없음)은 단일 키로 통일."""
    sido = key.split("|", 1)[0]
    if sido == "세종":
        return "세종|세종"
    return key


def canon_from_hospital(sido_raw, sgg):
    """병원파일: 시군구코드명에 광역시명이 접두(대구동구·광주북구)로 박혀있으면 그걸로 시도 복원."""
    sgg = (sgg or "").strip()
    if sgg == "부산진구":               # 고유명(부산진+구) — '부산' 접두로 오인 금지
        return "부산|부산진구"
    for m in METROS:
        if sgg.startswith(m) and sgg != m + "시":
            return fixup(f"{m}|{sgg[len(m):]}")   # 광주북구 → 광주|북구, 대구동구 → 대구|동구
    return fixup(f"{abbr_sido(sido_raw)}|{norm_district(sgg)}")


def canon_from_mois(sido_raw, sgg):
    """행안부: 시도명(축약) + 시군구명(정규화)."""
    return fixup(f"{abbr_sido(sido_raw)}|{norm_district(sgg)}")


def read_csv_cp949(path):
    txt = open(path, encoding="cp949", errors="replace").read()
    return list(csv.reader(io.StringIO(txt)))


def to_int(v):
    try:
        return int(float(str(v).replace(",", "").strip()))
    except Exception:
        return 0


meta = {}

# ── ① 행안부 인구 → 시군구 집계 ───────────────────────────────
mois_path = os.path.join(DATA, "행안부인구.csv")
rows = read_csv_cp949(mois_path)[1:]
# 컬럼: 0행정기관코드 1기준연월 2시도명 3시군구명 4읍면동명 5전체전월 6남전월 7여전월
#       8전체당월 9남당월 10여당월 11전체증감 12남증감 13여증감
pop = collections.defaultdict(lambda: {"total": 0, "male": 0, "female": 0, "delta": 0, "dongs": 0})
for r in rows:
    if len(r) < 11 or not r[2].strip():
        continue
    key = canon_from_mois(r[2], r[3])
    p = pop[key]
    p["total"] += to_int(r[8]); p["male"] += to_int(r[9]); p["female"] += to_int(r[10])
    p["delta"] += to_int(r[11]); p["dongs"] += 1
population = {}
for k, p in pop.items():
    t = p["total"]
    population[k] = {
        "total": t, "male": p["male"], "female": p["female"],
        "femaleRatio": round(p["female"] / t * 1000) / 10 if t else None,
        "delta": p["delta"], "dongs": p["dongs"],
    }
meta["population_sgg"] = len(population)
json.dump(population, open(os.path.join(OUT, "population-by-sgg.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))

# ── ② 병원 → 시군구 종별 집계 + 좌표 포인트 ─────────────────────
import openpyxl
wb = openpyxl.load_workbook(os.path.join(DATA, "심평원병원정보.xlsx"), read_only=True)
ws = wb["병원정보서비스"]
it = ws.iter_rows(values_only=True); h = next(it)
ci = {k: i for i, k in enumerate(h)}
hosp = collections.defaultdict(lambda: collections.Counter())
# 개원 추세(경쟁 신호): 기준일 2026-06-30(파일 기준) 대비 최근 1년·3년 개원 수.
import datetime
REF = datetime.date(2026, 6, 30)
D1 = REF - datetime.timedelta(days=365)
D3 = REF - datetime.timedelta(days=365 * 3)

def parse_open_date(v):
    if v is None or v == "":
        return None
    if hasattr(v, "year"):
        return datetime.date(v.year, v.month, v.day)
    s = str(v)[:10]
    try:
        return datetime.date(int(s[0:4]), int(s[5:7]), int(s[8:10]))
    except Exception:
        return None

openings = collections.defaultdict(lambda: {"y1": 0, "y3": 0, "total": 0})
# 포인트(컬럼형): 종별 인덱스 / 위 / 경 / 시군구키 인덱스
TYPES = []  # 종별코드명 목록(인덱스 부여)
tindex = {}
KEYS = []; kindex = {}
p_type = []; p_lat = []; p_lng = []; p_key = []; p_name = []
no_coord = 0
for r in it:
    sido = r[ci["시도코드명"]]; sgg = r[ci["시군구코드명"]]
    jong = (r[ci["종별코드명"]] or "").strip()
    key = canon_from_hospital(sido, sgg)
    hosp[key][jong] += 1
    od = parse_open_date(r[ci["개설일자"]])
    if od:
        o = openings[key]; o["total"] += 1
        if od >= D1:
            o["y1"] += 1
        if od >= D3:
            o["y3"] += 1
    x = r[ci["좌표(X)"]]; y = r[ci["좌표(Y)"]]
    if x in (None, "") or y in (None, ""):
        no_coord += 1
        continue
    if jong not in tindex:
        tindex[jong] = len(TYPES); TYPES.append(jong)
    if key not in kindex:
        kindex[key] = len(KEYS); KEYS.append(key)
    p_type.append(tindex[jong])
    p_lat.append(round(float(y), 5)); p_lng.append(round(float(x), 5))
    p_key.append(kindex[key])
    p_name.append((r[ci["요양기관명"]] or "").strip())

hospitals = {k: dict(c) for k, c in hosp.items()}
meta["hospital_sgg"] = len(hospitals)
meta["hospital_no_coord"] = no_coord
json.dump(hospitals, open(os.path.join(OUT, "hospitals-by-sgg.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))

# 개원 추세(시군구별 최근 1년·3년 개원 수) — 경쟁 심화 신호. 기준일 2026-06-30.
openings_out = {k: v for k, v in openings.items()}
meta["openings_ref"] = REF.isoformat()
json.dump(openings_out, open(os.path.join(OUT, "openings-by-sgg.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))

points = {"types": TYPES, "keys": KEYS,
          "t": p_type, "lat": p_lat, "lng": p_lng, "k": p_key, "n": p_name}
gzip.open(os.path.join(OUT, "hospital-points.json.gz"), "wt", encoding="utf-8").write(
    json.dumps(points, ensure_ascii=False, separators=(",", ":")))
meta["hospital_points"] = len(p_type)

# ── ③ 상병통계 → 표시과목별 상위 상병 ──────────────────────────
hira_path = os.path.join(DATA, "심평원상병통계.csv")
rows = read_csv_cp949(hira_path)[1:]
# 컬럼: 0진료년도 1표시과목 2주상병코드 3환자수 4명세서청구건수 5입내원일수 6보험자부담 7요양급여총액
bysubj = collections.defaultdict(list)
for r in rows:
    if len(r) < 4:
        continue
    bysubj[r[1].strip()].append({"code": r[2].strip(), "patients": to_int(r[3]),
                                 "claims": to_int(r[4]), "days": to_int(r[5])})
demand = {}
for subj, arr in bysubj.items():
    arr.sort(key=lambda x: x["patients"], reverse=True)
    demand[subj] = arr[:20]
meta["demand_specialties"] = len(demand)
json.dump(demand, open(os.path.join(OUT, "demand-by-specialty.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))

# ── ④ 한방 진료통계 → 시군구별 주상병(대분류) 진료인원(최신연도) ───────
oriental_path = os.path.join(DATA, "심평원한방진료.csv")
orows = read_csv_cp949(oriental_path)[1:]
# 컬럼: 0진료개시년도 1진료형태(한방기관외래/입원) 2시도명 3시군구명 4주상병분류(대분류) 5진료인원 6진료비(천원)
years = [to_int(r[0]) for r in orows if len(r) >= 7 and to_int(r[0])]
latest = max(years) if years else 0
# key → dx → {out, in}
odata = collections.defaultdict(lambda: collections.defaultdict(lambda: {"out": 0, "in": 0}))
for r in orows:
    if len(r) < 7 or to_int(r[0]) != latest:
        continue
    key = canon_from_mois(r[2], r[3])
    dxc = odata[key][r[4].strip()]
    if "외래" in r[1]:
        dxc["out"] += to_int(r[5])
    else:
        dxc["in"] += to_int(r[5])
oriental = {}
for key, dxs in odata.items():
    rows_ = [{"dx": dx, "patients": v["out"] + v["in"], "out": v["out"], "in": v["in"]} for dx, v in dxs.items()]
    rows_.sort(key=lambda x: x["patients"], reverse=True)
    oriental[key] = {"year": latest, "total": sum(x["patients"] for x in rows_), "byDx": rows_[:15]}
meta["oriental_year"] = latest
meta["oriental_sgg"] = len(oriental)
json.dump(oriental, open(os.path.join(OUT, "oriental-demand-by-sgg.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))

# ── ⑤ 다빈도 질병통계(전국, 3단 상병, 3년 추이) — 전체/한방 ──────────
def parse_frequent(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    # 헤더행: 0입원외래 1코드 2 3단질병명 3순위 4환자수(당해) 9환자수(-1) 14환자수(-2)
    out = []
    for r in ws.iter_rows(values_only=True):
        if not r or r[0] not in ("외래", "입원"):
            continue
        y0, y1, y2 = to_int(r[4]), to_int(r[9]), to_int(r[14])
        trend = round((y0 - y2) / y2 * 1000) / 10 if y2 else None  # 2년 증감률 %
        out.append({"io": r[0], "code": str(r[1] or "").strip(), "name": str(r[2] or "").strip(),
                    "rank": to_int(r[3]), "y0": y0, "y1": y1, "y2": y2, "trend": trend})
    out.sort(key=lambda x: x["y0"], reverse=True)
    return out[:60]

frequent = {}
years_freq = None
for kind, fname in [("전체", "심평원다빈도_전체.xlsx"), ("한방", "심평원다빈도_한방.xlsx")]:
    p = os.path.join(DATA, fname)
    if os.path.exists(p):
        frequent[kind] = parse_frequent(p)
meta["frequent_kinds"] = list(frequent.keys())
# 최신연도 라벨(파일명에 2025) — 표기용
frequent_meta = {"latest": 2025, "prev": 2024, "prev2": 2023}
json.dump({"years": frequent_meta, "data": frequent},
          open(os.path.join(OUT, "frequent-diseases.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))

# ── ⑥ 양방 시도별 상병 수요 (지역=시도 단위) ────────────────────
prov_path = os.path.join(DATA, "심평원시도별상병.csv")
prows = read_csv_cp949(prov_path)[1:]
# 컬럼: 0진료년도 1주상병코드 2시도구분 3환자수 ...
prov = collections.defaultdict(collections.Counter)
for r in prows:
    if len(r) < 4:
        continue
    prov[r[2].strip()][r[1].strip()] += to_int(r[3])
province = {}
for sido, c in prov.items():
    province[sido] = [{"code": code, "patients": n} for code, n in c.most_common(30)]
meta["province_demand"] = len(province)
json.dump(province, open(os.path.join(OUT, "province-demand.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))

# ── ⑦ 상병별 성별×연령 타깃 (전국, 5단→3단 집계) ────────────────
sa_path = os.path.join(DATA, "심평원상병_성연령.csv")
sarows = read_csv_cp949(sa_path)[1:]
# 컬럼: 0진료년도 1주상병코드(5단) 2성별 3연령군(예 05_20~24세) 4환자수 ...

def decade_band(agelabel):
    try:
        lo = int(agelabel.split("_")[1].split("~")[0].replace("세", "").replace(" 이상", ""))
    except Exception:
        return "기타"
    if lo < 20:
        return "10대이하"
    if lo >= 60:
        return "60대+"
    return f"{lo // 10 * 10}대"

sa = collections.defaultdict(lambda: {"m": 0, "f": 0, "age": collections.Counter()})
for r in sarows:
    if len(r) < 5:
        continue
    code3 = r[1].strip()[:3]
    pat = to_int(r[4])
    d = sa[code3]
    if r[2].strip() == "남":
        d["m"] += pat
    else:
        d["f"] += pat
    d["age"][decade_band(r[3].strip())] += pat
disease_demo = {}
ranked = sorted(sa.items(), key=lambda x: x[1]["m"] + x[1]["f"], reverse=True)[:200]
for code, d in ranked:
    total = d["m"] + d["f"]
    ages = [{"band": b, "share": round(n / total * 1000) / 10} for b, n in d["age"].most_common(3)] if total else []
    disease_demo[code] = {"total": total, "male": d["m"], "female": d["f"],
                          "femaleRatio": round(d["f"] / total * 1000) / 10 if total else None, "ageTop": ages}
meta["disease_demographics"] = len(disease_demo)
json.dump(disease_demo, open(os.path.join(OUT, "disease-demographics.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))

json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), ensure_ascii=False, indent=2)

# 요약 출력
for f in sorted(glob.glob(os.path.join(OUT, "*"))):
    print(f"{os.path.getsize(f):>10,}  {os.path.relpath(f, ROOT)}")
print("meta:", json.dumps(meta, ensure_ascii=False))
