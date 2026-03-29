document.querySelectorAll("[data-carousel]").forEach((carousel) => {
  const track = carousel.querySelector("[data-carousel-track]");
  const prev = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");

  if (!track || !prev || !next) {
    return;
  }

  const step = () => track.clientWidth;

  prev.addEventListener("click", () => {
    track.scrollBy({ left: -step(), behavior: "smooth" });
  });

  next.addEventListener("click", () => {
    track.scrollBy({ left: step(), behavior: "smooth" });
  });
});

const postalCodeCache = new Map();

const formatPostalCode = (value) => {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

  if (cleaned.length <= 3) {
    return cleaned;
  }

  return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
};

const getPostalZone = (value) => formatPostalCode(value).replace(/\s/g, "").slice(0, 3);

const haversineDistanceKm = (start, end) => {
  const earthRadiusKm = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latDelta = toRadians(end.lat - start.lat);
  const lonDelta = toRadians(end.lon - start.lon);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(start.lat)) *
      Math.cos(toRadians(end.lat)) *
      Math.sin(lonDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fetchPostalCoordinates = async (postalCode) => {
  const zone = getPostalZone(postalCode);

  if (zone.length !== 3) {
    throw new Error("invalid_postal_code");
  }

  if (postalCodeCache.has(zone)) {
    return postalCodeCache.get(zone);
  }

  const response = await fetch(`https://api.zippopotam.us/ca/${zone}`);

  if (!response.ok) {
    throw new Error("postal_code_not_found");
  }

  const data = await response.json();
  const place = data.places && data.places[0];

  if (!place) {
    throw new Error("postal_code_not_found");
  }

  const coordinates = {
    lat: Number(place.latitude),
    lon: Number(place.longitude),
  };

  postalCodeCache.set(zone, coordinates);
  return coordinates;
};

document.querySelectorAll("[data-travel-estimator]").forEach((estimator) => {
  const input = estimator.querySelector(".travel-estimator-input");
  const button = estimator.querySelector("[data-travel-estimator-submit]");
  const result = estimator.querySelector("[data-travel-estimator-result]");
  const originPostalCode = estimator.dataset.originPostalCode || "G1E 3V7";

  if (!input || !button || !result) {
    return;
  }

  const setResult = (message) => {
    result.textContent = message;
  };

  const calculateEstimate = async () => {
    const formattedPostalCode = formatPostalCode(input.value);
    const zone = getPostalZone(formattedPostalCode);

    input.value = formattedPostalCode;

    if (zone.length !== 3) {
      setResult("Code invalide");
      return;
    }

    button.disabled = true;
    button.textContent = "...";
    setResult("Calcul...");

    try {
      const [originCoordinates, destinationCoordinates] = await Promise.all([
        fetchPostalCoordinates(originPostalCode),
        fetchPostalCoordinates(formattedPostalCode),
      ]);

      const distanceKm = haversineDistanceKm(originCoordinates, destinationCoordinates);
      const billableDistanceKm = Math.max(0, distanceKm - 20);
      const travelPrice = billableDistanceKm * 0.5;

      if (billableDistanceKm <= 0) {
        setResult("Gratuit!");
        return;
      }

      setResult(`${travelPrice.toFixed(2)} $`);
    } catch (error) {
      setResult("Indisponible");
    } finally {
      button.disabled = false;
      button.textContent = "Calculer";
    }
  };

  input.addEventListener("input", () => {
    input.value = formatPostalCode(input.value);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      calculateEstimate();
    }
  });

  button.addEventListener("click", calculateEstimate);
});
