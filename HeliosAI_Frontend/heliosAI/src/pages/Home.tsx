import { useEffect, useState } from "react";
import { fetchWeatherApi } from "openmeteo";
import bgLogo from "../assets/HeliosAI_Basic_BG_Logo.png";
import "../App.css";

const BACKEND_URL = "http://localhost:8000";

export default function Home() {
  const [location, setLocation] = useState<number[]>([]);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [pvOutput, setPvOutput] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLocation();
  }, []);

  function fetchLocation() {
    console.log("Is it in yet");
    setLocation([]);
    navigator.geolocation.getCurrentPosition((position) => {
      if (location.length < 2) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setLocation([lat, lon]);
        console.log(location);
      }
    });
  }

  async function fetchWeatherData() {
    console.log("OpenMeteo is goated");
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
    const url = "https://api.open-meteo.com/v1/forecast";
    const responses = await fetchWeatherApi(url, params);

    const response = responses[0];

    const latitude = response.latitude();
    const longitude = response.longitude();
    const elevation = response.elevation();
    const utcOffsetSeconds = response.utcOffsetSeconds();

    console.log(
      `\nCoordinates: ${latitude}°N ${longitude}°E`,
      `\nElevation: ${elevation}m asl`,
      `\nTimezone difference to GMT+0: ${utcOffsetSeconds}s`,
    );

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

    console.log(
      `\nCurrent time: ${data.current.time}\n`,
      `\nCurrent temperature_2m: ${data.current.temperature_2m}`,
      `\nCurrent is_day: ${data.current.is_day}`,
      `\nCurrent wind_direction_10m: ${data.current.wind_direction_10m}`,
    );
    console.log("\nHourly data:\n", data.hourly);

    setWeatherData(data);
  }

  // ── Find the closest slot to right now ───────────────────────
  // Open-Meteo timestamps are at :30 past the hour, not on the hour,
  // so an exact match would always fail — find nearest instead.
  function getCurrentHourIndex(times: Date[]): number {
    const now = new Date();
    let closest = 0;
    let minDiff = Infinity;
    times.forEach((t, i) => {
      const diff = Math.abs(t.getTime() - now.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closest = i;
      }
    });
    return closest;
  }

  // ── Map Open-Meteo fields → 31 features the backend expects ──
  function buildPayload(data: any): Record<string, number> {
    const times: Date[] = data.hourly.time;
    const idx = getCurrentHourIndex(times);
    const h = data.hourly;
    const now = times[idx];

    // Fractional hour (e.g. 10.5 for 10:30) for smooth cyclical encoding
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

    // Solar geometry approximated from fractional hour
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

    // Simplified Faiman cell temperature model
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

    // pv lags: approximated from solar radiation (no historical PV from Open-Meteo)
    const pv_lag1 = Math.min(SolarRad_lag1 / 1000, 1.0);
    const pv_lag2 = Math.min(SolarRad_lag2 / 1000, 1.0);
    const pv_lag3 = Math.min(SolarRad_lag3 / 1000, 1.0);

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
      pv_per_kw_lag1: pv_lag1,
      SolarRad_lag1,
      pv_per_kw_lag2: pv_lag2,
      SolarRad_lag2,
      pv_per_kw_lag3: pv_lag3,
      SolarRad_lag3,
    };

    console.log(
      `Using hourly slot index ${idx}:`,
      times[idx].toLocaleTimeString(),
    );
    console.log("Payload:", payload);
    return payload;
  }

  async function getResults() {
    if (!weatherData) {
      setError("Please fetch weather data first.");
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
      console.log("Backend response:", result);
      setPvOutput(result.pv_per_kw);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="hero-text">
        <img src={bgLogo} className="hero-image" alt="Main logo" />
      </div>
      <p className="sub-heading">Solar power predictor</p>
      <button className="main-button" onClick={fetchWeatherData}>
        Fetch Weather
      </button>
      <button
        className="results-button"
        onClick={getResults}
        disabled={loading}
      >
        {loading ? "Predicting..." : "Get Results"}
      </button>

      {error && (
        <div className="card">
          <p style={{ color: "red" }}>{error}</p>
        </div>
      )}

      <div className="card">
        <div className="sub-heading">Latitude : {location[0]}</div>
        <div className="sub-heading">Longitude : {location[1]}</div>
        {weatherData && (
          <div className="sub-heading">
            Weather fetched ✓ ({weatherData.current.time.toLocaleTimeString()})
          </div>
        )}
        {pvOutput !== null && (
          <div className="sub-heading">
            Predicted PV Output : {pvOutput.toFixed(4)} kW/kW
          </div>
        )}
      </div>
    </div>
  );
}
