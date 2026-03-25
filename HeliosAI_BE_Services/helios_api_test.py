"""
HeliosAI API — Test Client
===========================
Three test cases designed to route to each expert:
  Case 1 → XGBoost       (low uncertainty:  perfect clear sky, stable lags)
  Case 2 → LSTM          (mid uncertainty:  mild transitional conditions)
  Case 3 → TabTransformer (high uncertainty: volatile, contradictory signals)

Install:  pip install requests
Run:      python helios_api_test.py
"""

import requests
import json

BASE = "http://localhost:8000"

# ──────────────────────────────────────────────────────────────
# CASE 1 — XGBoost target
# Low uncertainty: near-perfect clear sky, all lags tightly consistent,
# minimal volatility. XGBoost q75-q25 interval should be very narrow.
# ──────────────────────────────────────────────────────────────
XGB_SAMPLE = {
    "SolarRad": 45.0,           # early morning — low, predictable ramp
    "TempOut": 18.0,
    "OutHum": 72.0,
    "WindSpeed": 0.8,
    "RainRate": 0.0,
    "Bar": 1016.0,
    "dewpoint": 12.0,
    "dewpoint_depression": 6.0,
    "solar_zenith": 78.0,       # low sun angle — early morning
    "solar_azimuth": 95.0,
    "air_mass": 4.8,
    "is_day": 1.0,
    "poa_global": 48.0,
    "clearsky_index": 0.96,     # clear sky — XGBoost knows exactly what this means
    "poa_ratio": 1.02,
    "cell_temp": 22.0,
    "temp_loss": -0.005,
    "irradiance_grad": 0.001,
    "irradiance_volatility": 0.001,
    "cloud_volatility": 0.001,
    "Hour_sin": 0.259,          # ~7am
    "Hour_cos": 0.966,
    "day_of_year_sin": 0.5,
    "day_of_year_cos": 0.866,
    "pv_per_kw_lag1": 0.02,     # very low consistent lags — predictable ramp
    "SolarRad_lag1": 22.0,
    "pv_per_kw_lag2": 0.005,
    "SolarRad_lag2": 8.0,
    "pv_per_kw_lag3": 0.001,
    "SolarRad_lag3": 2.0,
}

# ──────────────────────────────────────────────────────────────
# CASE 2 — LSTM target
# Mid uncertainty: partial cloud, some irradiance variation,
# lags starting to diverge from current. Transitional conditions.
# ──────────────────────────────────────────────────────────────
LSTM_SAMPLE = {
    "SolarRad": 420.0,          # moderate, partially cloudy
    "TempOut": 27.0,
    "OutHum": 62.0,
    "WindSpeed": 3.5,
    "RainRate": 0.0,
    "Bar": 1010.0,
    "dewpoint": 17.5,
    "dewpoint_depression": 9.5,
    "solar_zenith": 40.0,
    "solar_azimuth": 175.0,
    "air_mass": 1.31,
    "is_day": 1.0,
    "poa_global": 445.0,
    "clearsky_index": 0.61,     # moderate cloud cover
    "poa_ratio": 1.06,
    "cell_temp": 42.0,
    "temp_loss": -0.013,
    "irradiance_grad": 0.055,   # some gradient — conditions changing
    "irradiance_volatility": 0.09,
    "cloud_volatility": 0.08,
    "Hour_sin": 0.5,
    "Hour_cos": 0.866,
    "day_of_year_sin": 0.5,
    "day_of_year_cos": 0.866,
    "pv_per_kw_lag1": 0.38,     # lags diverging from current
    "SolarRad_lag1": 490.0,
    "pv_per_kw_lag2": 0.45,
    "SolarRad_lag2": 560.0,
    "pv_per_kw_lag3": 0.50,
    "SolarRad_lag3": 610.0,     # was higher 3 hrs ago — declining trend
}

# ──────────────────────────────────────────────────────────────
# CASE 3 — TabTransformer target
# High uncertainty: heavily overcast, high cloud + irradiance
# volatility, lags completely decoupled from current reading.
# ──────────────────────────────────────────────────────────────
TABTF_SAMPLE = {
    "SolarRad": 185.0,          # low, heavy cloud
    "TempOut": 26.0,
    "OutHum": 85.0,
    "WindSpeed": 6.0,
    "RainRate": 0.3,
    "Bar": 1005.0,
    "dewpoint": 21.0,
    "dewpoint_depression": 5.0,
    "solar_zenith": 55.0,
    "solar_azimuth": 160.0,
    "air_mass": 1.74,
    "is_day": 1.0,
    "poa_global": 195.0,
    "clearsky_index": 0.22,     # heavily overcast
    "poa_ratio": 1.05,
    "cell_temp": 35.0,
    "temp_loss": -0.009,
    "irradiance_grad": 0.22,    # rapid swings
    "irradiance_volatility": 0.55,
    "cloud_volatility": 0.61,   # very high cloud churn
    "Hour_sin": 0.866,
    "Hour_cos": 0.5,
    "day_of_year_sin": 0.5,
    "day_of_year_cos": 0.866,
    "pv_per_kw_lag1": 0.52,     # lags completely decoupled — was sunny
    "SolarRad_lag1": 680.0,
    "pv_per_kw_lag2": 0.61,
    "SolarRad_lag2": 750.0,
    "pv_per_kw_lag3": 0.58,
    "SolarRad_lag3": 720.0,
}

CASES = [
    (XGB_SAMPLE,   'XGBoost',        'Early morning clear sky ramp — low, predictable irradiance'),
    (LSTM_SAMPLE,  'LSTM',           'Partial cloud, declining trend, mid volatility'),
    (TABTF_SAMPLE, 'TabTransformer', 'Heavy overcast, decoupled lags, high volatility'),
]


def print_input(sample):
    groups = {
        'Weather':    ['SolarRad', 'TempOut', 'OutHum', 'WindSpeed', 'RainRate', 'Bar'],
        'Humidity':   ['dewpoint', 'dewpoint_depression'],
        'Solar Geo':  ['solar_zenith', 'solar_azimuth', 'air_mass', 'is_day'],
        'Irradiance': ['poa_global', 'clearsky_index', 'poa_ratio', 'cell_temp',
                       'temp_loss', 'irradiance_grad', 'irradiance_volatility',
                       'cloud_volatility'],
        'Time':       ['Hour_sin', 'Hour_cos', 'day_of_year_sin', 'day_of_year_cos'],
        'Lags':       ['pv_per_kw_lag1', 'SolarRad_lag1', 'pv_per_kw_lag2',
                       'SolarRad_lag2', 'pv_per_kw_lag3', 'SolarRad_lag3'],
    }
    print(f"  {'─'*55}")
    print(f"  INPUT")
    print(f"  {'─'*55}")
    for group, fields in groups.items():
        pairs = "   ".join(f"{k}={sample[k]}" for k in fields if k in sample)
        print(f"  {group:<12}: {pairs}")


def print_output(data, expected_expert):
    routed_correctly = data['expert_used'] == expected_expert
    status_icon = '' if routed_correctly else ''
    print(f"  {'─'*55}")
    print(f"  OUTPUT  {status_icon}  Expected: {expected_expert}")
    print(f"  {'─'*55}")
    print(f"  PV Output    : {data['pv_per_kw']:.4f} kW/kW")
    print(f"  Uncertainty  : {data['uncertainty']:.4f}")
    print(f"  Interval     : [{data['lower_bound']:.4f}, {data['upper_bound']:.4f}]")
    print(f"  Expert used  : {data['expert_used']}")
    print(f"  Regime       : {data['regime']}")
    print(f"  Vol score    : {data['vol_score']:.4f}")
    if not routed_correctly:
        print(f"  NOTE: Routed to {data['expert_used']} — uncertainty may sit outside expected band")


def test_health():
    print("\n" + "="*60)
    print("  GET /health")
    print("="*60)
    r = requests.get(f"{BASE}/health")
    print(f"  Status: {r.status_code}")
    print(json.dumps(r.json(), indent=2))


def test_model_info():
    print("\n" + "="*60)
    print("  GET /models/info")
    print("="*60)
    r = requests.get(f"{BASE}/models/info")
    print(f"  Status: {r.status_code}")
    data = r.json()
    print(f"  Features : {data['feature_count']}")
    print(f"  Routing  : {data['routing']}")
    print(f"  Experts  :")
    for k, v in data['experts'].items():
        print(f"    [{k}] {v}")


def test_expert_routing():
    print("\n" + "="*60)
    print("  EXPERT ROUTING TESTS — one case per expert")
    print("="*60)

    routing_results = []

    for i, (sample, expected, description) in enumerate(CASES, 1):
        print(f"\n  ── Case {i}: {expected} ──────────────────────────────")
        print(f"  Scenario: {description}")
        print_input(sample)
        r    = requests.post(f"{BASE}/predict", json=sample)
        data = r.json()
        print(f"\n  Status: {r.status_code}")
        print_output(data, expected)
        routing_results.append({
            'case': i,
            'expected': expected,
            'got': data['expert_used'],
            'correct': data['expert_used'] == expected,
        })

    # Summary
    print(f"\n\n{'='*60}")
    print(f"  ROUTING SUMMARY")
    print(f"{'='*60}")
    print(f"  {'Case':<6} {'Expected':<18} {'Got':<18} {'Result'}")
    print(f"  {'─'*56}")
    for r in routing_results:
        icon = '✅ correct' if r['correct'] else '⚠️  mismatch'
        print(f"  {r['case']:<6} {r['expected']:<18} {r['got']:<18} {icon}")
    correct = sum(r['correct'] for r in routing_results)
    print(f"\n  {correct}/3 routed as expected")
    if correct < 3:
        print(f"  Tip: mismatches mean that case's uncertainty fell outside")
        print(f"       the expected band. Try adjusting irradiance_volatility")
        print(f"       or clearsky_index to push uncertainty into the right range.")


if __name__ == '__main__':
    print("HeliosAI API Test Client")
    print("Connecting to:", BASE)

    try:
        test_health()
        test_model_info()
        test_expert_routing()
        print("\n✅ All tests complete.")
    except requests.exceptions.ConnectionError:
        print("\n Could not connect. Is the server running?")
        print("   Start it with:  python helios_api.py")