const getCarouselIndex = (track) => {
  const step = track.clientWidth;

  if (!step) {
    return 0;
  }

  return Math.round(track.scrollLeft / step);
};

const lightbox = document.querySelector("[data-lightbox]");
const lightboxImage = lightbox?.querySelector("[data-lightbox-image]");
const lightboxCaption = lightbox?.querySelector("[data-lightbox-caption]");
const lightboxCounter = lightbox?.querySelector("[data-lightbox-counter]");
const lightboxPrev = lightbox?.querySelector("[data-lightbox-prev]");
const lightboxNext = lightbox?.querySelector("[data-lightbox-next]");
const lightboxCloseButtons = lightbox?.querySelectorAll("[data-lightbox-close]");

let activeLightboxImages = [];
let activeLightboxIndex = 0;
let activeExpandButton = null;

const renderLightbox = () => {
  if (!lightboxImage || !lightboxCaption || !lightboxCounter || !activeLightboxImages.length) {
    return;
  }

  const currentImage = activeLightboxImages[activeLightboxIndex];

  if (!currentImage) {
    return;
  }

  lightboxImage.src = currentImage.src;
  lightboxImage.alt = currentImage.alt;
  lightboxCaption.textContent = currentImage.alt;
  lightboxCounter.textContent = `${activeLightboxIndex + 1} / ${activeLightboxImages.length}`;
};

const changeLightboxImage = (direction) => {
  if (!activeLightboxImages.length) {
    return;
  }

  activeLightboxIndex =
    (activeLightboxIndex + direction + activeLightboxImages.length) % activeLightboxImages.length;

  renderLightbox();
};

const closeLightbox = () => {
  if (!lightbox || lightbox.hidden) {
    return;
  }

  lightbox.hidden = true;
  lightbox.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";

  if (activeExpandButton) {
    activeExpandButton.focus();
  }
};

const openLightbox = (images, startIndex, triggerButton) => {
  if (!lightbox || !lightboxImage || !images.length) {
    return;
  }

  activeLightboxImages = images;
  activeLightboxIndex = startIndex;
  activeExpandButton = triggerButton;

  renderLightbox();
  lightbox.hidden = false;
  lightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  lightboxCloseButtons?.[1]?.focus();
};

if (lightbox) {
  lightboxPrev?.addEventListener("click", () => {
    changeLightboxImage(-1);
  });

  lightboxNext?.addEventListener("click", () => {
    changeLightboxImage(1);
  });

  lightboxCloseButtons?.forEach((button) => {
    button.addEventListener("click", closeLightbox);
  });

  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden) {
      return;
    }

    if (event.key === "Escape") {
      closeLightbox();
      return;
    }

    if (event.key === "ArrowLeft") {
      changeLightboxImage(-1);
      return;
    }

    if (event.key === "ArrowRight") {
      changeLightboxImage(1);
    }
  });
}

document.querySelectorAll("[data-carousel]").forEach((carousel) => {
  const track = carousel.querySelector("[data-carousel-track]");
  const prev = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");
  const expand = carousel.querySelector("[data-carousel-expand]");

  if (!track || !prev || !next) {
    return;
  }

  const images = Array.from(track.querySelectorAll("img"));
  const step = () => track.clientWidth;

  prev.addEventListener("click", () => {
    track.scrollBy({ left: -step(), behavior: "smooth" });
  });

  next.addEventListener("click", () => {
    track.scrollBy({ left: step(), behavior: "smooth" });
  });

  expand?.addEventListener("click", () => {
    openLightbox(images, getCarouselIndex(track), expand);
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
