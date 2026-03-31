import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWeatherApi } from "openmeteo";
import bgLogo from "../assets/HeliosAI_Basic_BG_Logo.png";
import "../App.css";

const BACKEND_URL = "http://35.244.33.212:8000";

const Icon = {
  thermometer: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
    </svg>
  ),
  droplets: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  ),
  wind: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
      <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
      <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
    </svg>
  ),
  cloud: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  ),
  sun: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  rain: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="16" y1="13" x2="16" y2="21" />
      <line x1="8" y1="13" x2="8" y2="21" />
      <line x1="12" y1="15" x2="12" y2="23" />
      <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
    </svg>
  ),
  pressure: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  zap: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  location: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  gps: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  ),
  edit: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
};

function windDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

type LocationMode = "gps" | "manual";

export default function Home() {
  const navigate = useNavigate();
  const [location, setLocation] = useState<number[]>([]);
  const [locationMode, setLocationMode] = useState<LocationMode>("gps");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [pvOutput, setPvOutput] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (locationMode === "gps") fetchLocation();
  }, [locationMode]);

  function fetchLocation() {
    setLocation([]);
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation([pos.coords.latitude, pos.coords.longitude]);
    });
  }

  function handleModeToggle(mode: LocationMode) {
    setLocationMode(mode);
    setManualError(null);
    if (mode === "gps") {
      setManualLat("");
      setManualLng("");
    }
  }

  function applyManualLocation() {
    setManualError(null);
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setManualError("Latitude must be between −90 and 90.");
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setManualError("Longitude must be between −180 and 180.");
      return;
    }
    setLocation([lat, lng]);
  }

  async function fetchWeatherData() {
    if (!location.length) {
      setError(
        locationMode === "manual"
          ? "Apply a valid location first."
          : "Waiting for GPS location…",
      );
      return;
    }
    setError(null);
    const params = {
      latitude: location[0],
      longitude: location[1],
      hourly: [
        "temperature_2m",
        "dew_point_2m",
        "relative_humidity_2m",
        "precipitation_probability",
        "wind_speed_10m",
        "pressure_msl",
        "cloud_cover",
        "soil_moisture_1_to_3cm",
        "terrestrial_radiation_instant",
        "direct_radiation_instant",
        "direct_normal_irradiance_instant",
        "diffuse_radiation_instant",
      ],
      current: ["temperature_2m", "is_day", "wind_direction_10m"],
    };
    const responses = await fetchWeatherApi(
      "https://api.open-meteo.com/v1/forecast",
      params,
    );
    const response = responses[0];
    const utcOffsetSeconds = response.utcOffsetSeconds();
    const current = response.current()!;
    const hourly = response.hourly()!;
    const data = {
      current: {
        time: new Date((Number(current.time()) + utcOffsetSeconds) * 1000),
        temperature_2m: current.variables(0)!.value(),
        is_day: current.variables(1)!.value(),
        wind_direction_10m: current.variables(2)!.value(),
      },
      hourly: {
        time: Array.from(
          {
            length:
              (Number(hourly.timeEnd()) - Number(hourly.time())) /
              hourly.interval(),
          },
          (_, i) =>
            new Date(
              (Number(hourly.time()) +
                i * hourly.interval() +
                utcOffsetSeconds) *
                1000,
            ),
        ),
        temperature_2m: hourly.variables(0)!.valuesArray(),
        dew_point_2m: hourly.variables(1)!.valuesArray(),
        relative_humidity_2m: hourly.variables(2)!.valuesArray(),
        precipitation_probability: hourly.variables(3)!.valuesArray(),
        wind_speed_10m: hourly.variables(4)!.valuesArray(),
        pressure_msl: hourly.variables(5)!.valuesArray(),
        cloud_cover: hourly.variables(6)!.valuesArray(),
        soil_moisture_1_to_3cm: hourly.variables(7)!.valuesArray(),
        terrestrial_radiation_instant: hourly.variables(8)!.valuesArray(),
        direct_radiation_instant: hourly.variables(9)!.valuesArray(),
        direct_normal_irradiance_instant: hourly.variables(10)!.valuesArray(),
        diffuse_radiation_instant: hourly.variables(11)!.valuesArray(),
      },
    };
    setWeatherData(data);
  }

  function getCurrentHourIndex(times: Date[]): number {
    const now = new Date();
    let closest = 0,
      minDiff = Infinity;
    times.forEach((t, i) => {
      const diff = Math.abs(t.getTime() - now.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closest = i;
      }
    });
    return closest;
  }

  function buildPayload(data: any): Record<string, number> {
    const times: Date[] = data.hourly.time;
    const idx = getCurrentHourIndex(times);
    const h = data.hourly;
    const now = times[idx];
    const hour = now.getHours() + now.getMinutes() / 60;
    const doy = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
    );
    const SolarRad = h.terrestrial_radiation_instant![idx] ?? 0;
    const TempOut = h.temperature_2m![idx] ?? 20;
    const OutHum = h.relative_humidity_2m![idx] ?? 50;
    const WindSpeed = h.wind_speed_10m![idx] ?? 0;
    const RainRate = (h.precipitation_probability![idx] ?? 0) * 0.01;
    const Bar = h.pressure_msl![idx] ?? 1013;
    const dewpoint = h.dew_point_2m![idx] ?? 15;
    const dewpoint_depression = TempOut - dewpoint;
    const solar_zenith = Math.max(
      0,
      90 - 45 * Math.sin(((hour - 12) * Math.PI) / 12),
    );
    const solar_azimuth = 180 + (hour - 12) * 15;
    const air_mass =
      solar_zenith < 89
        ? 1 / (Math.cos((solar_zenith * Math.PI) / 180) + 1e-6)
        : 38;
    const is_day = data.current.is_day ?? (hour >= 6 && hour <= 18 ? 1 : 0);
    const direct = h.direct_radiation_instant![idx] ?? 0;
    const diffuse = h.diffuse_radiation_instant![idx] ?? 0;
    const poa_global = direct + diffuse;
    const clearsky_index = Math.min(SolarRad / (poa_global + 1e-8), 1);
    const poa_ratio = poa_global / (SolarRad + 1e-8);
    const cell_temp = TempOut + poa_global * 0.03;
    const temp_loss = (cell_temp - 25) * -0.004;
    const prev_idx = Math.max(0, idx - 1);
    const prev_solar = h.terrestrial_radiation_instant![prev_idx] ?? SolarRad;
    const irradiance_grad = SolarRad - prev_solar;
    const irradiance_volatility = Math.abs(irradiance_grad) / (SolarRad + 1e-8);
    const cloud_volatility = (h.cloud_cover![idx] ?? 0) / 100;
    const Hour_sin = Math.sin((hour * 2 * Math.PI) / 24);
    const Hour_cos = Math.cos((hour * 2 * Math.PI) / 24);
    const day_of_year_sin = Math.sin((doy * 2 * Math.PI) / 365);
    const day_of_year_cos = Math.cos((doy * 2 * Math.PI) / 365);
    const lag1_idx = Math.max(0, idx - 1);
    const lag2_idx = Math.max(0, idx - 2);
    const lag3_idx = Math.max(0, idx - 3);
    const SolarRad_lag1 =
      h.terrestrial_radiation_instant![lag1_idx] ?? SolarRad;
    const SolarRad_lag2 =
      h.terrestrial_radiation_instant![lag2_idx] ?? SolarRad;
    const SolarRad_lag3 =
      h.terrestrial_radiation_instant![lag3_idx] ?? SolarRad;
    return {
      SolarRad,
      TempOut,
      OutHum,
      WindSpeed,
      RainRate,
      Bar,
      dewpoint,
      dewpoint_depression,
      solar_zenith,
      solar_azimuth,
      air_mass,
      is_day,
      poa_global,
      clearsky_index,
      poa_ratio,
      cell_temp,
      temp_loss,
      irradiance_grad,
      irradiance_volatility,
      cloud_volatility,
      Hour_sin,
      Hour_cos,
      day_of_year_sin,
      day_of_year_cos,
      pv_per_kw_lag1: Math.min(SolarRad_lag1 / 1000, 1.0),
      SolarRad_lag1,
      pv_per_kw_lag2: Math.min(SolarRad_lag2 / 1000, 1.0),
      SolarRad_lag2,
      pv_per_kw_lag3: Math.min(SolarRad_lag3 / 1000, 1.0),
      SolarRad_lag3,
    };
  }

  function buildHourlyPV(data: any) {
    return data.hourly.time.map((t: Date, i: number) => {
      const h = data.hourly;
      const solar = h.terrestrial_radiation_instant![i] ?? 0;
      const temp = h.temperature_2m![i] ?? 20;
      const direct = h.direct_radiation_instant![i] ?? 0;
      const diffuse = h.diffuse_radiation_instant![i] ?? 0;
      const poa = direct + diffuse;
      const cellTemp = temp + poa * 0.03;
      const tempLoss = (cellTemp - 25) * -0.004;
      const rawPV = Math.min(solar / 1000, 1.0) * (1 + tempLoss);
      return { time: t, pv: Math.max(0, rawPV) };
    });
  }

  async function getResults() {
    if (!weatherData) {
      setError("Fetch weather data first.");
      return;
    }
    setLoading(true);
    setError(null);
    setPvOutput(null);
    try {
      const payload = buildPayload(weatherData);
      const res = await fetch(`${BACKEND_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Backend error");
      }
      const result = await res.json();
      const hourlyPV = buildHourlyPV(weatherData);
      navigate("/results", {
        state: { pvOutput: result.pv_per_kw, hourlyPV, location },
      });
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const wx = (() => {
    if (!weatherData) return null;
    const idx = getCurrentHourIndex(weatherData.hourly.time);
    const h = weatherData.hourly;
    return {
      temp: Math.round(h.temperature_2m![idx] ?? 0),
      dewpoint: Math.round(h.dew_point_2m![idx] ?? 0),
      humidity: Math.round(h.relative_humidity_2m![idx] ?? 0),
      wind: Math.round(h.wind_speed_10m![idx] ?? 0),
      windDir: windDirection(weatherData.current.wind_direction_10m ?? 0),
      pressure: Math.round(h.pressure_msl![idx] ?? 0),
      cloud: Math.round(h.cloud_cover![idx] ?? 0),
      rain: Math.round(h.precipitation_probability![idx] ?? 0),
      radiation: Math.round(h.terrestrial_radiation_instant![idx] ?? 0),
      direct: Math.round(h.direct_radiation_instant![idx] ?? 0),
      diffuse: Math.round(h.diffuse_radiation_instant![idx] ?? 0),
      soil: ((h.soil_moisture_1_to_3cm![idx] ?? 0) * 100).toFixed(1),
      isDay: weatherData.current.is_day === 1,
    };
  })();

  return (
    <>
      <nav className="explore-nav">
        <button className="explore-nav-logo">HeliosAI</button>
        <div className="explore-nav-links">
          <button className="explore-nav-link explore-nav-link--active">
            Home
          </button>
          <button
            className="explore-nav-link"
            onClick={() => navigate("/explore")}
          >
            Explore
          </button>
        </div>
      </nav>
      <div className="container">
        <div className="header">
          <div className="hero-text">
            <img src={bgLogo} className="hero-image" alt="HeliosAI logo" />
          </div>
          <p className="sub-heading">Solar Power Predictor</p>
        </div>

        <div className="action-row">
          <button className="main-button" onClick={fetchWeatherData}>
            Fetch Weather
          </button>
          <button
            className="results-button"
            onClick={getResults}
            disabled={loading}
          >
            {loading ? "Predicting…" : "Get Results"}
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="dashboard">
          {/* Location card */}
          <div className="card card-location">
            {/* Top row: label + mode toggle */}
            <div className="location-header">
              <span className="card-label">{Icon.location} Location</span>
              <div className="location-mode-toggle">
                <button
                  className={`location-mode-btn${locationMode === "gps" ? " location-mode-btn--active" : ""}`}
                  onClick={() => handleModeToggle("gps")}
                >
                  {Icon.gps} GPS
                </button>
                <button
                  className={`location-mode-btn${locationMode === "manual" ? " location-mode-btn--active" : ""}`}
                  onClick={() => handleModeToggle("manual")}
                >
                  {Icon.edit} Manual
                </button>
              </div>
            </div>

            {/* Manual input panel — only shown in manual mode */}
            {locationMode === "manual" && (
              <div className="location-manual-panel">
                <div className="location-manual-inputs">
                  <div className="location-manual-field">
                    <label
                      className="location-manual-label"
                      htmlFor="input-lat"
                    >
                      Latitude
                    </label>
                    <input
                      id="input-lat"
                      className="location-manual-input"
                      type="number"
                      placeholder="e.g. 28.6139"
                      min="-90"
                      max="90"
                      step="any"
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                    />
                    <span className="location-manual-hint">−90 to 90</span>
                  </div>
                  <div className="location-manual-field">
                    <label
                      className="location-manual-label"
                      htmlFor="input-lng"
                    >
                      Longitude
                    </label>
                    <input
                      id="input-lng"
                      className="location-manual-input"
                      type="number"
                      placeholder="e.g. 77.2090"
                      min="-180"
                      max="180"
                      step="any"
                      value={manualLng}
                      onChange={(e) => setManualLng(e.target.value)}
                    />
                    <span className="location-manual-hint">−180 to 180</span>
                  </div>
                </div>
                <div className="location-manual-footer">
                  {manualError ? (
                    <p className="location-manual-error">{manualError}</p>
                  ) : (
                    <span />
                  )}
                  <button
                    className="location-manual-apply"
                    onClick={applyManualLocation}
                  >
                    Apply Location
                  </button>
                </div>
              </div>
            )}

            {/* Bottom row: coords + status */}
            <div className="location-bottom-row">
              <div className="location-coords">
                <div className="coord-item">
                  <span className="coord-label">Latitude</span>
                  <span className="coord-value">
                    {location[0] ? location[0].toFixed(5) : "—"}
                  </span>
                </div>
                <div className="coord-item">
                  <span className="coord-label">Longitude</span>
                  <span className="coord-value">
                    {location[1] ? location[1].toFixed(5) : "—"}
                  </span>
                </div>
                {weatherData && (
                  <div className="coord-item">
                    <span className="coord-label">Last fetched</span>
                    <span className="coord-value coord-value--sm">
                      {weatherData.current.time.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
              </div>
              <span className={`weather-status${wx ? "" : " pending"}`}>
                {wx ? (wx.isDay ? "☀ Daytime" : "☽ Night") : "Awaiting fetch"}
              </span>
            </div>
          </div>

          {/* Weather cards */}
          {wx ? (
            <>
              <div className="card">
                <div className="card-label">{Icon.thermometer} Temperature</div>
                <div
                  className={`stat-value ${wx.temp > 35 ? "stat-value--hot" : wx.temp < 15 ? "stat-value--cold" : ""}`}
                >
                  {wx.temp}
                  <span className="stat-value-unit">°C</span>
                </div>
                <div className="stat-unit">Dew point · {wx.dewpoint}°C</div>
              </div>

              <div className="card">
                <div className="card-label">{Icon.droplets} Humidity</div>
                <div className="stat-value stat-value--blue">
                  {wx.humidity}
                  <span className="stat-value-unit">%</span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill progress-bar-fill--blue"
                    style={{ width: `${wx.humidity}%` }}
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-label">{Icon.wind} Wind</div>
                <div className="mini-stats">
                  <div>
                    <div className="mini-stat-value">
                      {wx.wind}{" "}
                      <span className="mini-stat-unit-inline">km/h</span>
                    </div>
                    <div className="mini-stat-unit">Speed</div>
                  </div>
                  <div>
                    <div className="mini-stat-value mini-stat-value--dim">
                      {wx.windDir}
                    </div>
                    <div className="mini-stat-unit">Direction</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-label">{Icon.pressure} Pressure</div>
                <div className="stat-value stat-value--md">
                  {wx.pressure}
                  <span className="stat-value-unit"> hPa</span>
                </div>
                <div className="stat-unit">
                  {wx.pressure > 1013 ? "High pressure" : "Low pressure"}
                </div>
              </div>

              <div className="card">
                <div className="card-label">{Icon.cloud} Cloud Cover</div>
                <div className="stat-value">
                  {wx.cloud}
                  <span className="stat-value-unit">%</span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill progress-bar-fill--slate"
                    style={{ width: `${wx.cloud}%` }}
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-label">{Icon.rain} Precipitation</div>
                <div
                  className={`stat-value${wx.rain > 60 ? " stat-value--blue" : ""}`}
                >
                  {wx.rain}
                  <span className="stat-value-unit">%</span>
                </div>
                <div className="stat-unit">Probability</div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill progress-bar-fill--blue"
                    style={{ width: `${wx.rain}%` }}
                  />
                </div>
              </div>

              <div className="card card-solar">
                <div className="card-label">{Icon.sun} Solar Radiation</div>
                <div className="solar-stats">
                  <div>
                    <div className="mini-stat-value mini-stat-value--lg solar-value--yellow">
                      {wx.radiation}{" "}
                      <span className="mini-stat-unit-inline">W/m²</span>
                    </div>
                    <div className="mini-stat-unit">Global (terrestrial)</div>
                  </div>
                  <div>
                    <div className="mini-stat-value mini-stat-value--md">
                      {wx.direct}{" "}
                      <span className="mini-stat-unit-inline">W/m²</span>
                    </div>
                    <div className="mini-stat-unit">Direct</div>
                  </div>
                  <div>
                    <div className="mini-stat-value mini-stat-value--md">
                      {wx.diffuse}{" "}
                      <span className="mini-stat-unit-inline">W/m²</span>
                    </div>
                    <div className="mini-stat-unit">Diffuse</div>
                  </div>
                  <div>
                    <div className="mini-stat-value mini-stat-value--md">
                      {wx.soil}{" "}
                      <span className="mini-stat-unit-inline">m³/m³</span>
                    </div>
                    <div className="mini-stat-unit">Soil moisture</div>
                  </div>
                </div>
                <div className="progress-bar-track progress-bar-track--mt">
                  <div
                    className="progress-bar-fill progress-bar-fill--solar"
                    style={{ width: `${Math.min(wx.radiation / 10, 100)}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card card-skeleton" />
            ))
          )}

          {pvOutput !== null && (
            <div className="card card-output">
              <div>
                <div className="card-label card-label--orange">
                  {Icon.zap} Predicted PV Output
                </div>
                <div className="output-big">{pvOutput.toFixed(4)}</div>
                <div className="output-meta">kW per kW installed capacity</div>
              </div>
              <div className="output-right">
                <div className="output-badge">
                  {pvOutput > 0.7
                    ? "Excellent"
                    : pvOutput > 0.4
                      ? "Good"
                      : pvOutput > 0.1
                        ? "Moderate"
                        : "Low"}
                </div>
                <div className="output-badge-label">Efficiency rating</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
