import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchWeatherApi } from "openmeteo";
import "../App.css";

const BACKEND_URL = "http://35.244.33.212:8000";

interface WeatherSnapshot {
  temp: number;
  humidity: number;
  cloud: number;
  wind: number;
  radiation: number;
  direct: number;
  diffuse: number;
  isDay: boolean;
}

interface PanelData {
  lat: number;
  lng: number;
  place: string;
  weather: WeatherSnapshot;
  pvOutput: number;
}

function getRating(pv: number) {
  if (pv > 0.7) return { label: "Excellent", cls: "rating--excellent" };
  if (pv > 0.4) return { label: "Good", cls: "rating--good" };
  if (pv > 0.1) return { label: "Moderate", cls: "rating--moderate" };
  return { label: "Low", cls: "rating--low" };
}

function windDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
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

async function fetchSolarData(
  lat: number,
  lng: number,
): Promise<{ weather: WeatherSnapshot; pvOutput: number }> {
  const params = {
    latitude: lat,
    longitude: lng,
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

  const times = Array.from(
    {
      length:
        (Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval(),
    },
    (_, i) =>
      new Date(
        (Number(hourly.time()) + i * hourly.interval() + utcOffsetSeconds) *
          1000,
      ),
  );

  const h = {
    time: times,
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
  };

  const idx = getCurrentHourIndex(times);
  const isDay = current.variables(1)!.value() === 1;
  const windDir = current.variables(2)!.value();

  const weather: WeatherSnapshot = {
    temp: Math.round(h.temperature_2m![idx] ?? 0),
    humidity: Math.round(h.relative_humidity_2m![idx] ?? 0),
    cloud: Math.round(h.cloud_cover![idx] ?? 0),
    wind: Math.round(h.wind_speed_10m![idx] ?? 0),
    radiation: Math.round(h.terrestrial_radiation_instant![idx] ?? 0),
    direct: Math.round(h.direct_radiation_instant![idx] ?? 0),
    diffuse: Math.round(h.diffuse_radiation_instant![idx] ?? 0),
    isDay,
  };

  // Build payload
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
  const SolarRad_lag1 = h.terrestrial_radiation_instant![lag1_idx] ?? SolarRad;
  const SolarRad_lag2 = h.terrestrial_radiation_instant![lag2_idx] ?? SolarRad;
  const SolarRad_lag3 = h.terrestrial_radiation_instant![lag3_idx] ?? SolarRad;

  const payload = {
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
    is_day: isDay ? 1 : 0,
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

  const res = await fetch(`${BACKEND_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Backend error");
  const result = await res.json();

  return { weather, pvOutput: result.pv_per_kw };
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    );
    const data = await res.json();
    const a = data.address;
    return (
      a.city ||
      a.town ||
      a.village ||
      a.county ||
      a.state ||
      a.country ||
      "Unknown location"
    );
  } catch {
    return "Unknown location";
  }
}

// ── Mini bar chart for radiation ──────────────────────────────
function RadiationBar({
  value,
  max = 1000,
  color,
}: {
  value: number;
  max?: number;
  color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="explore-bar-track">
      <div
        className="explore-bar-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ── Side panel ────────────────────────────────────────────────
function SidePanel({
  data,
  loading,
  error,
}: {
  data: PanelData | null;
  loading: boolean;
  error: string | null;
}) {
  const rating = data ? getRating(data.pvOutput) : null;

  if (loading) {
    return (
      <div className="explore-panel explore-panel--visible">
        <div className="explore-panel-inner">
          <div className="explore-skeleton-title" />
          <div className="explore-skeleton-sub" />
          <div className="explore-skeleton-hero" />
          <div className="explore-skeleton-row" />
          <div className="explore-skeleton-row" />
          <div className="explore-skeleton-row" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="explore-panel explore-panel--visible">
        <div className="explore-panel-inner">
          <div className="explore-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="explore-panel">
        <div className="explore-panel-hint">
          <div className="explore-hint-icon">☀</div>
          <div className="explore-hint-text">
            Click anywhere on the map to get a solar snapshot
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="explore-panel explore-panel--visible">
      <div className="explore-panel-inner">
        {/* Location */}
        <div className="explore-place">{data.place}</div>
        <div className="explore-coords">
          {data.lat.toFixed(4)}°, {data.lng.toFixed(4)}°
        </div>

        {/* PV hero */}
        <div className={`explore-pv-card ${rating!.cls}`}>
          <div className="explore-pv-label">⚡ PV Output</div>
          <div className="explore-pv-value">{data.pvOutput.toFixed(4)}</div>
          <div className="explore-pv-unit">kW per kW capacity</div>
          <div className={`explore-pv-badge ${rating!.cls}`}>
            {rating!.label}
          </div>
        </div>

        {/* Weather rows */}
        <div className="explore-wx-grid">
          <div className="explore-wx-item">
            <div className="explore-wx-label">Temperature</div>
            <div className="explore-wx-value">{data.weather.temp}°C</div>
          </div>
          <div className="explore-wx-item">
            <div className="explore-wx-label">Humidity</div>
            <div className="explore-wx-value">{data.weather.humidity}%</div>
          </div>
          <div className="explore-wx-item">
            <div className="explore-wx-label">Cloud Cover</div>
            <div className="explore-wx-value">{data.weather.cloud}%</div>
          </div>
          <div className="explore-wx-item">
            <div className="explore-wx-label">Wind</div>
            <div className="explore-wx-value">{data.weather.wind} km/h</div>
          </div>
        </div>

        {/* Radiation breakdown */}
        <div className="explore-section-label">Solar Radiation</div>
        <div className="explore-radiation">
          <div className="explore-rad-row">
            <span className="explore-rad-label">Global</span>
            <span className="explore-rad-value">
              {data.weather.radiation} W/m²
            </span>
          </div>
          <RadiationBar
            value={data.weather.radiation}
            color="linear-gradient(90deg,#f97316,#fbbf24)"
          />

          <div className="explore-rad-row" style={{ marginTop: 10 }}>
            <span className="explore-rad-label">Direct</span>
            <span className="explore-rad-value">
              {data.weather.direct} W/m²
            </span>
          </div>
          <RadiationBar value={data.weather.direct} color="#f97316" />

          <div className="explore-rad-row" style={{ marginTop: 10 }}>
            <span className="explore-rad-label">Diffuse</span>
            <span className="explore-rad-value">
              {data.weather.diffuse} W/m²
            </span>
          </div>
          <RadiationBar value={data.weather.diffuse} color="#fbbf24" />
        </div>

        {/* Day/night */}
        <div className="explore-daynight">
          <span
            className={`weather-status ${data.weather.isDay ? "" : "pending"}`}
          >
            {data.weather.isDay ? "☀ Daytime" : "☽ Nighttime"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function Explore() {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [panelData, setPanelData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
    });

    // Dark-ish OSM tile style (Stadia Alidade Smooth Dark)
    L.tileLayer(
      "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 18,
      },
    ).addTo(map);

    // Custom marker icon (avoids broken default leaflet image paths in Vite)
    const icon = L.divIcon({
      className: "",
      html: `<div class="explore-marker"><div class="explore-marker-dot"></div><div class="explore-marker-ring"></div></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    map.on("click", async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      // Place / move marker
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
      }

      setLoading(true);
      setError(null);
      setPanelData(null);

      try {
        const [{ weather, pvOutput }, place] = await Promise.all([
          fetchSolarData(lat, lng),
          reverseGeocode(lat, lng),
        ]);
        setPanelData({ lat, lng, place, weather, pvOutput });
      } catch (e: any) {
        setError(e.message ?? "Failed to fetch data for this location.");
      } finally {
        setLoading(false);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <div className="explore-root">
      {/* Nav */}
      <nav className="explore-nav">
        <button className="explore-nav-logo" onClick={() => navigate("/")}>
          HeliosAI
        </button>
        <div className="explore-nav-links">
          <button className="explore-nav-link" onClick={() => navigate("/")}>
            Home
          </button>
          <button className="explore-nav-link explore-nav-link--active">
            Explore
          </button>
        </div>
      </nav>

      <div className="explore-body">
        <div className="explore-map-wrap">
          <div ref={mapRef} className="explore-map" />
          <div className="explore-map-hint">Click anywhere to query</div>
        </div>

        <SidePanel data={panelData} loading={loading} error={error} />
      </div>
    </div>
  );
}
