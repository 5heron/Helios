"""
HeliosAI MoE — FastAPI Inference Server
========================================
Serves the trained MoE pipeline over HTTP.

Install deps:
  pip install fastapi uvicorn xgboost tensorflow joblib scikit-learn

Run:
  python helios_api.py
  # or
  uvicorn helios_api:app --host 0.0.0.0 --port 8000 --reload

Endpoints:
  GET  /health          — check server + model status
  POST /predict         — single prediction
  POST /predict/batch   — batch predictions
  GET  /models/info     — model metadata
"""

import numpy as np
import joblib
import json
import warnings
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

warnings.filterwarnings('ignore')

ARTIFACT_DIR = Path('heliosai_v12_artifacts')

# ── Feature definition ───────────────────────────────────────
FEATURE_COLS = [
    'SolarRad', 'TempOut', 'OutHum', 'WindSpeed', 'RainRate', 'Bar',
    'dewpoint', 'dewpoint_depression', 'solar_zenith', 'solar_azimuth',
    'air_mass', 'is_day', 'poa_global', 'clearsky_index', 'poa_ratio',
    'cell_temp', 'temp_loss', 'irradiance_grad', 'irradiance_volatility',
    'cloud_volatility', 'Hour_sin', 'Hour_cos', 'day_of_year_sin',
    'day_of_year_cos', 'pv_per_kw_lag1', 'SolarRad_lag1',
    'pv_per_kw_lag2', 'SolarRad_lag2', 'pv_per_kw_lag3', 'SolarRad_lag3',
]
ALL_FEATS = FEATURE_COLS + ['vol_score']

# ── Global model store ───────────────────────────────────────
models = {}


def load_models():
    """Load all artifacts into memory at startup."""
    from xgboost import XGBRegressor
    import tensorflow as tf
    from tensorflow.keras.models import load_model
    from tensorflow.keras.layers import (
        Layer, LayerNormalization, MultiHeadAttention, Dense, Dropout
    )

    print("Loading artifacts...")
    assert ARTIFACT_DIR.exists(), f"Artifact directory not found: {ARTIFACT_DIR}"

    # XGBoost quantile models
    xgb_q50 = XGBRegressor(); xgb_q50.load_model(str(ARTIFACT_DIR / 'xgb_q50.json'))
    xgb_q25 = XGBRegressor(); xgb_q25.load_model(str(ARTIFACT_DIR / 'xgb_q25.json'))
    xgb_q75 = XGBRegressor(); xgb_q75.load_model(str(ARTIFACT_DIR / 'xgb_q75.json'))

    # Custom Keras layers for TabTransformer
    class LearnablePositionalEncoding(Layer):
        def __init__(self, seq_len, d_model, **kwargs):
            super().__init__(**kwargs)
            self.seq_len = seq_len; self.d_model = d_model
        def build(self, input_shape):
            self.pos_emb = self.add_weight(
                name='pos_emb', shape=(1, self.seq_len, self.d_model),
                initializer='glorot_uniform', trainable=True)
            super().build(input_shape)
        def call(self, x): return x + self.pos_emb
        def get_config(self):
            cfg = super().get_config()
            cfg.update({'seq_len': self.seq_len, 'd_model': self.d_model})
            return cfg

    class CLSTokenPrepend(Layer):
        def __init__(self, d_model, **kwargs):
            super().__init__(**kwargs)
            self.d_model = d_model
        def build(self, input_shape):
            self.cls_token = self.add_weight(
                name='cls_token', shape=(1, 1, self.d_model),
                initializer=tf.keras.initializers.TruncatedNormal(stddev=0.02),
                trainable=True)
            super().build(input_shape)
        def call(self, x):
            batch_size = tf.shape(x)[0]
            cls = tf.tile(self.cls_token, [batch_size, 1, 1])
            return tf.concat([cls, x], axis=1)
        def get_config(self):
            cfg = super().get_config()
            cfg.update({'d_model': self.d_model})
            return cfg

    class TransformerBlock(Layer):
        def __init__(self, d_model, n_heads, ffn_dim, dropout=0.1, **kwargs):
            super().__init__(**kwargs)
            self.d_model = d_model; self.n_heads = n_heads
            self.ffn_dim = ffn_dim; self.dropout_rate = dropout
            self.norm1 = LayerNormalization(epsilon=1e-6)
            self.norm2 = LayerNormalization(epsilon=1e-6)
            self.attn  = MultiHeadAttention(num_heads=n_heads, key_dim=d_model//n_heads)
            self.ff1   = Dense(ffn_dim, activation='gelu')
            self.ff2   = Dense(d_model)
            self.drop1 = Dropout(dropout)
            self.drop2 = Dropout(dropout)
        def call(self, x, training=False):
            xn = self.norm1(x)
            x  = x + self.drop1(self.attn(xn, xn, training=training), training=training)
            xn = self.norm2(x)
            x  = x + self.drop2(self.ff2(self.ff1(xn)), training=training)
            return x
        def get_config(self):
            cfg = super().get_config()
            cfg.update({'d_model': self.d_model, 'n_heads': self.n_heads,
                        'ffn_dim': self.ffn_dim, 'dropout': self.dropout_rate})
            return cfg

    class ExtractCLS(Layer):
        def call(self, x): return x[:, 0, :]
        def get_config(self): return super().get_config()

    custom_objects = {
        'LearnablePositionalEncoding': LearnablePositionalEncoding,
        'CLSTokenPrepend':             CLSTokenPrepend,
        'TransformerBlock':            TransformerBlock,
        'ExtractCLS':                  ExtractCLS,
    }

    mlp_model   = load_model(str(ARTIFACT_DIR / 'expert_mlp.keras'))
    tabtf_model = load_model(str(ARTIFACT_DIR / 'expert_tabtransformer.keras'),
                             custom_objects=custom_objects)

    meta_learner = XGBRegressor()
    meta_learner.load_model(str(ARTIFACT_DIR / 'meta_learner.json'))

    # Scalers
    scaler_X = joblib.load(ARTIFACT_DIR / 'scaler_X.save')
    scaler_y = joblib.load(ARTIFACT_DIR / 'scaler_y.save')

    # Meta JSON
    meta = json.loads((ARTIFACT_DIR / 'meta.json').read_text())

    models.update({
        'xgb_q50':      xgb_q50,
        'xgb_q25':      xgb_q25,
        'xgb_q75':      xgb_q75,
        'mlp':          mlp_model,
        'tabtf':        tabtf_model,
        'meta_learner': meta_learner,
        'scaler_X':     scaler_X,
        'scaler_y':     scaler_y,
        'meta':         meta,
    })
    print("✅ All models loaded.")


# ── Lifespan ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_models()
    yield
    models.clear()


app = FastAPI(
    title="HeliosAI MoE Inference API",
    description="Solar PV output forecasting via Mixture-of-Experts pipeline",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic schemas ─────────────────────────────────────────
class WeatherInput(BaseModel):
    # Core weather
    SolarRad:             float = Field(..., description="Solar radiation (W/m²)")
    TempOut:              float = Field(..., description="Outside temperature (°C)")
    OutHum:               float = Field(..., description="Outside humidity (%)")
    WindSpeed:            float = Field(..., description="Wind speed (m/s)")
    RainRate:             float = Field(0.0, description="Rain rate (mm/hr)")
    Bar:                  float = Field(..., description="Barometric pressure (hPa)")
    dewpoint:             float = Field(..., description="Dew point (°C)")
    dewpoint_depression:  float = Field(..., description="Dewpoint depression (°C)")

    # Solar geometry
    solar_zenith:         float = Field(..., description="Solar zenith angle (°)")
    solar_azimuth:        float = Field(..., description="Solar azimuth angle (°)")
    air_mass:             float = Field(..., description="Optical air mass")
    is_day:               float = Field(..., description="1 if daytime, 0 if night")

    # Irradiance derived
    poa_global:           float = Field(..., description="Plane-of-array global irradiance")
    clearsky_index:       float = Field(..., description="Clear-sky index [0-1]")
    poa_ratio:            float = Field(..., description="POA ratio")
    cell_temp:            float = Field(..., description="PV cell temperature (°C)")
    temp_loss:            float = Field(..., description="Temperature loss factor")
    irradiance_grad:      float = Field(..., description="Irradiance gradient")
    irradiance_volatility:float = Field(..., description="Irradiance volatility")
    cloud_volatility:     float = Field(..., description="Cloud volatility index")

    # Cyclical time features
    Hour_sin:             float = Field(..., description="sin(hour * 2π/24)")
    Hour_cos:             float = Field(..., description="cos(hour * 2π/24)")
    day_of_year_sin:      float = Field(..., description="sin(doy * 2π/365)")
    day_of_year_cos:      float = Field(..., description="cos(doy * 2π/365)")

    # Lag features
    pv_per_kw_lag1:       float = Field(..., description="PV output 1 hour ago")
    SolarRad_lag1:        float = Field(..., description="Solar radiation 1 hour ago")
    pv_per_kw_lag2:       float = Field(..., description="PV output 2 hours ago")
    SolarRad_lag2:        float = Field(..., description="Solar radiation 2 hours ago")
    pv_per_kw_lag3:       float = Field(..., description="PV output 3 hours ago")
    SolarRad_lag3:        float = Field(..., description="Solar radiation 3 hours ago")

    # Optional: auto-computed if omitted
    vol_score:            Optional[float] = Field(None, description="Volatility score (auto-computed if omitted)")

    class Config:
        json_schema_extra = {
            "example": {
                "SolarRad": 450.0, "TempOut": 28.5, "OutHum": 60.0,
                "WindSpeed": 3.2, "RainRate": 0.0, "Bar": 1013.0,
                "dewpoint": 19.5, "dewpoint_depression": 9.0,
                "solar_zenith": 35.0, "solar_azimuth": 180.0,
                "air_mass": 1.22, "is_day": 1.0,
                "poa_global": 480.0, "clearsky_index": 0.82,
                "poa_ratio": 1.05, "cell_temp": 45.0, "temp_loss": -0.012,
                "irradiance_grad": 0.03, "irradiance_volatility": 0.05,
                "cloud_volatility": 0.04,
                "Hour_sin": 0.866, "Hour_cos": 0.5,
                "day_of_year_sin": 0.707, "day_of_year_cos": 0.707,
                "pv_per_kw_lag1": 0.38, "SolarRad_lag1": 420.0,
                "pv_per_kw_lag2": 0.35, "SolarRad_lag2": 390.0,
                "pv_per_kw_lag3": 0.30, "SolarRad_lag3": 350.0,
            }
        }


class BatchInput(BaseModel):
    samples: list[WeatherInput]


class PredictionResponse(BaseModel):
    pv_per_kw:   float
    lower_bound: float
    upper_bound: float
    regime:      str
    vol_score:   float


class BatchPredictionResponse(BaseModel):
    predictions: list[PredictionResponse]
    count:       int


# ── Inference logic ──────────────────────────────────────────
P33 = 0.309
P66 = 0.543


def compute_vol_score(row_dict: dict, imax: float) -> float:
    ci = min(max(row_dict['clearsky_index'], 0.0), 1.0)
    iv = row_dict['irradiance_volatility']
    return (1 - ci) * 0.6 + (iv / (imax + 1e-8)) * 0.4


def get_regime(vol_score: float) -> str:
    if vol_score <= P33:  return 'stable'
    elif vol_score > P66: return 'volatile'
    else:                 return 'mild'


def run_inference(inputs: list[dict]) -> list[dict]:
    imax = models['meta']['irr_vol_max']

    # Build feature matrix
    rows = []
    vol_scores = []
    for inp in inputs:
        vs = inp.get('vol_score')
        if vs is None:
            vs = compute_vol_score(inp, imax)
        vol_scores.append(vs)
        row = [inp[f] for f in FEATURE_COLS] + [vs]
        rows.append(row)

    X_raw = np.array(rows, dtype=np.float32)
    X_sc  = np.clip(models['scaler_X'].transform(X_raw), -5, 5)

    # XGBoost: q25, q50, q75
    xgb_pred = models['xgb_q50'].predict(X_raw)
    xgb_q25  = models['xgb_q25'].predict(X_raw)
    xgb_q75  = models['xgb_q75'].predict(X_raw)

    # MLP
    mlp_pred_sc = models['mlp'].predict(X_sc, verbose=0).flatten()
    mlp_pred    = np.clip(
        models['scaler_y'].inverse_transform(
            mlp_pred_sc.reshape(-1, 1)).flatten(), 0, None)

    # TabTransformer
    tabtf_pred_sc = models['tabtf'].predict(X_sc, verbose=0).flatten()
    tabtf_pred    = np.clip(
        models['scaler_y'].inverse_transform(
            tabtf_pred_sc.reshape(-1, 1)).flatten(), 0, None)

    # Meta-learner stacking
    meta_X     = np.stack([xgb_pred, mlp_pred, tabtf_pred], axis=1)
    final_pred = np.clip(models['meta_learner'].predict(meta_X), 0, None)

    results = []
    for i in range(len(inputs)):
        vs     = float(vol_scores[i])
        regime = get_regime(vs)
        results.append({
            'pv_per_kw':   float(round(final_pred[i], 6)),
            'lower_bound': float(round(max(xgb_q25[i], 0), 6)),
            'upper_bound': float(round(xgb_q75[i], 6)),
            'regime':      regime,
            'vol_score':   float(round(vs, 6)),
        })
    return results


# ── Routes ───────────────────────────────────────────────────
@app.get('/health')
def health():
    loaded = len(models) > 0
    return {
        'status':        'ok' if loaded else 'models not loaded',
        'models_loaded': loaded,
        'artifact_dir':  str(ARTIFACT_DIR),
        'experts':       ['XGBoost', 'MLP', 'TabTransformer'],
        'combiner':      'Meta-learner (XGBoost stacking)',
    }


@app.get('/models/info')
def model_info():
    if not models:
        raise HTTPException(status_code=503, detail="Models not loaded")
    meta = models['meta']
    return {
        'feature_count':  meta['n_features'],
        'features':       meta['feature_cols'],
        'vol_thresholds': meta['vol_thresholds'],
        'experts': {
            '0': 'XGBoost        — stable regime specialist',
            '1': 'MLP            — mild regime specialist',
            '2': 'TabTransformer — volatile regime specialist',
        },
        'combiner': 'Meta-learner XGBoost stacking (all three experts always run)',
    }


@app.post('/predict', response_model=PredictionResponse)
def predict(data: WeatherInput):
    if not models:
        raise HTTPException(status_code=503, detail="Models not loaded")
    try:
        result = run_inference([data.model_dump()])
        return result[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/predict/batch', response_model=BatchPredictionResponse)
def predict_batch(data: BatchInput):
    if not models:
        raise HTTPException(status_code=503, detail="Models not loaded")
    if len(data.samples) == 0:
        raise HTTPException(status_code=400, detail="No samples provided")
    if len(data.samples) > 1000:
        raise HTTPException(status_code=400, detail="Max 1000 samples per batch")
    try:
        inputs  = [s.model_dump() for s in data.samples]
        results = run_inference(inputs)
        return {'predictions': results, 'count': len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == '__main__':
    uvicorn.run('helios_api:app', host='0.0.0.0', port=8000, reload=False)