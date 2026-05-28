import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type CarouselSlide, listCarouselSlidesPublic } from "@/services/carousel.service";

const AUTOPLAY_MS = 4500;

export const HomeCarousel = () => {
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void listCarouselSlidesPublic().then((data) => {
      setSlides(data);
      setLoaded(true);
    });
  }, []);

  const go = useCallback(
    (idx: number) => {
      if (!slides.length) return;
      setCurrent(((idx % slides.length) + slides.length) % slides.length);
    },
    [slides.length]
  );

  // Autoplay
  useEffect(() => {
    if (slides.length <= 1) return;
    timerRef.current = setTimeout(() => go(current + 1), AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, go, slides.length]);

  if (!loaded || slides.length === 0) return null;

  const slide = slides[current];
  if (!slide) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gray-900" style={{ aspectRatio: "16/6" }}>
      {/* Slides */}
      {slides.map((s, idx) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-700 ${idx === current ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <img
            src={s.imageUrl}
            alt={s.title ?? ""}
            className="h-full w-full object-cover"
            loading={idx === 0 ? "eager" : "lazy"}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        </div>
      ))}

      {/* Text overlay */}
      {(slide.title || slide.subtitle) && (
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          {slide.title && (
            <h2 className="font-heading text-2xl font-bold drop-shadow-md sm:text-3xl">
              {slide.title}
            </h2>
          )}
          {slide.subtitle && (
            <p className="mt-1 text-sm text-white/80 drop-shadow sm:text-base">
              {slide.subtitle}
            </p>
          )}
          {slide.linkUrl && (
            <a
              href={slide.linkUrl}
              className="mt-3 inline-block rounded-lg bg-white/20 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/30"
            >
              Learn more →
            </a>
          )}
        </div>
      )}

      {/* Prev / Next buttons */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(current - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm hover:bg-black/50"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(current + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm hover:bg-black/50"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-4 right-6 flex gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => go(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === current ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
