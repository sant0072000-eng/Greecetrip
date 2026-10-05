type Forecast = {
  current?: Record<string, number | string | null>;
  daily?: { time?: string[]; [key: string]: (number | null)[] | string[] | undefined };
};

function places(): Record<string, [string, number, number]> {
  return {
    ath: ["Athens", 37.98, 23.73], nau: ["Nafplio / Tiryns / Palamidi", 37.57, 22.8],
    mon: ["Monemvasia", 36.69, 23.04], man: ["Karavostasi / Itilo / Kelefa", 36.7, 22.38],
    pyl: ["Pylos", 36.91, 21.7], vit: ["Vitina", 37.67, 22.17], san: ["Santorini / Megalochori", 36.38, 25.43],
    cor: ["Corinth Canal / Ancient Corinth", 37.93, 22.98], myc: ["Mycenae", 37.73, 22.76],
    epi: ["Epidaurus", 37.6, 23.08], ast: ["Paralio Astros", 37.42, 22.77],
    leo: ["Leonidio", 37.17, 22.86], kos: ["Kosmas / Moni Elonis", 37.09, 22.74],
    ger: ["Geraki", 36.99, 22.71], gyt: ["Gytheio / Dimitrios shipwreck", 36.76, 22.57],
    are: ["Areopoli / Limeni", 36.67, 22.38], dir: ["Diros Caves", 36.64, 22.38],
    vat: ["Vathia", 36.45, 22.46], kar: ["Kardamyli", 36.89, 22.23],
    kal: ["Kalamata", 37.04, 22.11], kor: ["Koroni", 36.8, 21.96],
    met: ["Methoni", 36.82, 21.7], voi: ["Voidokilia / Palace of Nestor", 36.97, 21.67],
    kyp: ["Kyparissia", 37.25, 21.67], bas: ["Bassae", 37.43, 21.9],
    kry: ["Karytaina", 37.48, 22.04], dim: ["Dimitsana / Zatouna", 37.6, 22.04],
    ste: ["Stemnitsa / Moni Prodromou", 37.55, 22.08], mai: ["Mount Mainalo", 37.65, 22.27],
    tri: ["Tripoli", 37.51, 22.37], nem: ["Nemea", 37.81, 22.71],
    oia: ["Oia", 36.46, 25.38], fir: ["Fira / Firostefani / Imerovigli", 36.42, 25.43],
    pyr: ["Pyrgos / Santo Wines", 36.38, 25.45], akr: ["Akrotiri / Red Beach / lighthouse", 36.35, 25.39],
  };
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export default async (request: Request) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
  }
  const locations = places();
  const ids = [...new Set((new URL(request.url).searchParams.get("places") || "ath,nau,mon,man,pyl,vit,san").split(","))];
  if (!ids.length || ids.length > 35 || ids.some((id) => !Object.hasOwn(locations, id))) {
    return Response.json({ error: "Choose valid itinerary locations." }, { status: 400 });
  }
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: ids.map((id) => locations[id][1]).join(","),
    longitude: ids.map((id) => locations[id][2]).join(","),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,rain_sum,showers_sum",
    timezone: "Europe/Athens",
    forecast_days: "16",
  }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error("Weather provider unavailable");
    const raw = await response.json() as Forecast | Forecast[];
    const forecasts = Array.isArray(raw) ? raw : [raw];
    if (forecasts.length !== ids.length) throw new Error("Incomplete weather response");
    const data = Object.fromEntries(ids.map((id, index) => {
      const forecast = forecasts[index];
      if (!Array.isArray(forecast.daily?.time)) throw new Error("Invalid weather response");
      return [id, {
        name: locations[id][0],
        current: {
          time: typeof forecast.current?.time === "string" ? forecast.current.time : null,
          temperature: numeric(forecast.current?.temperature_2m),
          feelsLike: numeric(forecast.current?.apparent_temperature),
          code: numeric(forecast.current?.weather_code),
          wind: numeric(forecast.current?.wind_speed_10m),
        },
        days: forecast.daily.time.map((date, dayIndex) => ({
          date,
          code: numeric(forecast.daily?.weather_code?.[dayIndex]),
          high: numeric(forecast.daily?.temperature_2m_max?.[dayIndex]),
          low: numeric(forecast.daily?.temperature_2m_min?.[dayIndex]),
          probability: numeric(forecast.daily?.precipitation_probability_max?.[dayIndex]),
          rain: numeric(forecast.daily?.rain_sum?.[dayIndex]),
          showers: numeric(forecast.daily?.showers_sum?.[dayIndex]),
        })),
      }];
    }));
    return Response.json({ fetchedAt: new Date().toISOString(), places: data }, {
      headers: { "Cache-Control": "public, max-age=300", "Netlify-CDN-Cache-Control": "public, s-maxage=600" },
    });
  } catch {
    return Response.json({ error: "Live weather is temporarily unavailable. Check your connection and try again." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
};
