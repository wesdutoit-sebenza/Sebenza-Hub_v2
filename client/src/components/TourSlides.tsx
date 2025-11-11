import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { tourSlides } from "@/data";

export default function TourSlides() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % tourSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + tourSlides.length) % tourSlides.length);
  };

  const slide = tourSlides[currentSlide];

  return (
    <div className="space-y-6">
      <div className="space-y-4" data-testid={`slide-${currentSlide}`}>
        <div className="aspect-video bg-gradient-to-br from-violet/10 via-cyan/10 to-transparent rounded-2xl flex items-center justify-center border">
          <p className="text-muted-foreground" data-testid="text-slide-placeholder">
            [Product Screenshot Placeholder]
          </p>
        </div>
        <h3 className="text-2xl font-serif font-semibold" data-testid="text-slide-title">
          {slide.title}
        </h3>
        <p className="text-muted-foreground" data-testid="text-slide-description">
          {slide.description}
        </p>
        <ul className="space-y-2">
          {slide.bullets.map((bullet, idx) => (
            <li key={idx} className="flex items-center gap-2" data-testid={`bullet-${currentSlide}-${idx}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-sm">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={prevSlide}
          disabled={currentSlide === 0}
          data-testid="button-slide-prev"
          aria-label="Previous slide"
        >
          <ChevronLeft size={20} />
        </Button>

        <div className="flex gap-2" data-testid="slide-indicators">
          {tourSlides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              data-testid={`indicator-${idx}`}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === currentSlide ? 'bg-primary' : 'bg-muted'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
              aria-current={idx === currentSlide}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={nextSlide}
          disabled={currentSlide === tourSlides.length - 1}
          data-testid="button-slide-next"
          aria-label="Next slide"
        >
          <ChevronRight size={20} />
        </Button>
      </div>
    </div>
  );
}
