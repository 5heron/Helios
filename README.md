# HeliosAI — Solar PV Forecasting MoE

HeliosAI is a **Mixture-of-Experts (MoE)** inference system for short-term solar photovoltaic (PV) power output forecasting. It combines XGBoost, MLP, and TabTransformer models with a meta-learner to deliver accurate predictions across different weather regimes.

## Project Structure

```
HeliosAI/
├── backend/                    # FastAPI inference server + models
│   ├── helios_api.py
│   ├── heliosai_v12_artifacts/ # Trained model files
│   ├── requirements.txt
│   └── venv/                   # Python virtual environment
├── frontend/                   # React + Vite frontend
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
└── README.md
```

## Tech Stack

- **Backend**: FastAPI, XGBoost, TensorFlow (Keras), scikit-learn
- **Frontend**: React + TypeScript + Vite
- **Models**: Mixture-of-Experts (XGBoost + MLP + TabTransformer + Meta Learner)

## How to Run the Project

### 1. Backend (FastAPI Server)

```bash
# Go to backend folder
cd Backend

# Create virtual environment (if not already created)
python3.12 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Start the inference server
uvicorn helios_api:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be available at: **http://localhost:8000**

**Test the server:**
```bash
curl http://localhost:8000/health
```

### 2. Frontend (React + Vite)

Open a **new terminal** and run:

```bash
# Go to frontend folder
cd Frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will usually open at: **http://localhost:5173**

> Note: Make sure the backend is running first, as the frontend will call `http://localhost:8000` for predictions.

## Available API Endpoints

| Method       | Endpoint              | Description                        |
|--------------|-----------------------|------------------------------------|
| `GET`        | `/health`             | Check server and model status      |
| `GET`        | `/models/info`        | Get model metadata                 |
| `POST`       | `/predict`            | Single prediction                  |
| `POST`       | `/predict/batch`      | Batch predictions (up to 1000)     |

## Development Tips

- The models are loaded once at startup for fast inference.
- GPU is **not required** — the server runs efficiently on CPU.
- CORS is enabled for local development.
- Never commit the `venv/` or `node_modules/` folders (they are ignored via `.gitignore`).

## Future Improvements

- Add Docker support
- Deploy backend with Gunicorn + Nginx
- Build frontend for production (`npm run build`)

---
