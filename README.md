# HeliosAI — Solar PV Forecasting with Mixture-of-Experts

> A full-stack solar photovoltaic (PV) forecasting system that combines **XGBoost, MLP, and TabTransformer** models through a **Mixture-of-Experts (MoE)** architecture to generate short-term PV power forecasts under varying weather conditions.

HeliosAI uses multiple complementary machine-learning experts and a **meta-learner** to combine their predictions into a final forecast. The system is exposed through a **FastAPI backend** and a **React + TypeScript frontend**.

---

## Architecture

```text
                    Weather + Time Features
                              │
                              ▼
                    ┌───────────────────┐
                    │ Feature Pipeline  │
                    └─────────┬─────────┘
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
         XGBoost             MLP        TabTransformer
             │                │                │
             └────────────────┼────────────────┘
                              ▼
                       ┌─────────────┐
                       │ Meta-Learner│
                       └──────┬──────┘
                              ▼
                      PV Power Forecast
```

---

## Key Features

* **Mixture-of-Experts forecasting** using XGBoost, MLP, and TabTransformer
* **Meta-learning** for combining expert predictions
* **FastAPI inference server**
* **React + TypeScript + Vite** frontend
* Single and batch prediction support
* CPU-compatible inference
* Models loaded once at startup for repeated inference

---

## Tech Stack

| Component        | Technologies                            |
| ---------------- | --------------------------------------- |
| Backend          | Python, FastAPI                         |
| Machine Learning | XGBoost, TensorFlow/Keras, scikit-learn |
| Architecture     | Mixture-of-Experts, Meta-Learner        |
| Frontend         | React, TypeScript, Vite                 |
| API              | REST / JSON                             |

---

## Project Structure

```text
HeliosAI/
├── backend/
│   ├── helios_api.py
│   ├── heliosai_v12_artifacts/
│   │   └── trained model artifacts
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── .gitignore
└── README.md
```

---

# Installation & Setup

## Requirements

Before starting, make sure you have:

* **Python 3.12**
* **Node.js + npm**
* **Git**

Clone the repository:

```powershell
git clone https://github.com/5heron/HeliosAI.git
cd HeliosAI
```

---

## 1. Backend Setup

Open **PowerShell** and run:

```powershell
cd backend

python -m venv venv
.\venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Start the FastAPI server

```powershell
uvicorn helios_api:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be available at:

```text
http://localhost:8000
```

### Check the backend

Open:

```text
http://localhost:8000/health
```

Or run:

```powershell
curl http://localhost:8000/health
```

---

## 2. Frontend Setup

Open a **new PowerShell window**:

```powershell
cd HeliosAI\frontend

npm install
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

> The frontend expects the FastAPI backend to be running at `http://localhost:8000`.

---

# Running the Full Application

You need **two terminals** running at the same time.

### Terminal 1 — Backend

```powershell
cd HeliosAI\backend
.\venv\Scripts\Activate.ps1
uvicorn helios_api:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2 — Frontend

```powershell
cd HeliosAI\frontend
npm run dev
```

Then open:

```text
http://localhost:5173
```

---

# API Endpoints

| Method | Endpoint         | Description                   |
| ------ | ---------------- | ----------------------------- |
| `GET`  | `/health`        | Check server and model status |
| `GET`  | `/models/info`   | Retrieve model metadata       |
| `POST` | `/predict`       | Generate a single prediction  |
| `POST` | `/predict/batch` | Generate batch predictions    |

---

# Inference Pipeline

```text
Client Request
      │
      ▼
   FastAPI
      │
      ▼
Feature Processing
      │
      ├───────────────┬────────────────┐
      ▼               ▼                ▼
   XGBoost           MLP        TabTransformer
      │               │                │
      └───────────────┴────────────────┘
                      │
                      ▼
                Meta-Learner
                      │
                      ▼
                Final Forecast
                      │
                      ▼
                   JSON
```

---

# Development Notes

* The trained models are loaded once when the backend starts.
* GPU hardware is **not required** for inference.
* CORS is enabled for local frontend development.
* Do **not** commit `venv/` or `node_modules/`.
* Keep model artifacts and dependencies aligned with the versions specified by the project.

---

# Roadmap

* [ ] Dockerized deployment
* [ ] Production backend deployment
* [ ] Production frontend deployment
* [ ] Additional inference and monitoring capabilities

---

## Project Goal

HeliosAI explores how **heterogeneous machine-learning models can be combined through a Mixture-of-Experts architecture** to build a unified solar PV forecasting system rather than relying on a single predictive model.

---

**Built with Python, FastAPI, XGBoost, TensorFlow/Keras, React, and TypeScript.**
