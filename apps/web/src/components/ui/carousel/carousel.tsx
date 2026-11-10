"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useCarousel } from "./hooks/use-carousel";
import { CarouselContent } from "./CarouselContent";
import { CarouselItem } from "./CarouselItem";
import { CarouselDots } from "./CarouselDots";
import { CarouselArrows } from "./CarouselArrows";
import { CarouselThumbs } from "./CarouselThumbs";

export interface CarouselProps {
  slides: React.ReactNode[];
  options?: {
    loop?: boolean;
    autoplay?: boolean;
    autoplayDelay?: number;
    slidesToShow?: number;
    slidesToScroll?: number;
    align?: 'start' | 'center' | 'end';
    containScroll?: 'trimSnaps' | 'keepSnaps';
  };
  showDots?: boolean;
  showArrows?: boolean;
  showThumbs?: boolean;
  thumbs?: string[];
  className?: string;
  slideClassName?: string;
  onInit?: (api: any) => void;
}

const Carousel = React.forwardRef<
  HTMLDivElement,
  CarouselProps
>(({
  slides,
  options = {},
  showDots = false,
  showArrows = true,
  showThumbs = false,
  thumbs = [],
  className,
  slideClassName,
  onInit,
  ...props
}, ref) => {
  const {
    emblaRef,
    emblaApi,
    scrollPrev,
    scrollNext,
    scrollTo,
    canScrollPrev,
    canScrollNext,
    selectedIndex,
    scrollSnaps,
  } = useCarousel({
    options: {
      loop: options.loop || false,
      align: options.align || 'center',
      containScroll: options.containScroll,
      slidesToScroll: options.slidesToScroll || 1,
      ...options,
    },
    autoplay: options.autoplay || false,
    autoplayDelay: options.autoplayDelay || 3000,
  });

  React.useEffect(() => {
    if (emblaApi && onInit) {
      onInit(emblaApi);
    }
  }, [emblaApi, onInit]);

  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      {...props}
    >
      <div ref={emblaRef} className="overflow-hidden">
        <CarouselContent>
          {slides.map((slide, index) => (
            <CarouselItem
              key={index}
              className={slideClassName}
              slidesToShow={options.slidesToShow}
            >
              {slide}
            </CarouselItem>
          ))}
        </CarouselContent>
      </div>

      {showArrows && (
        <CarouselArrows
          onPrev={scrollPrev}
          onNext={scrollNext}
          canScrollPrev={canScrollPrev}
          canScrollNext={canScrollNext}
        />
      )}

      {showDots && (
        <CarouselDots
          scrollSnaps={scrollSnaps}
          selectedIndex={selectedIndex}
          onDotClick={scrollTo}
        />
      )}

      {showThumbs && thumbs.length > 0 && (
        <CarouselThumbs
          thumbs={thumbs}
          selectedIndex={selectedIndex}
          onThumbClick={scrollTo}
        />
      )}
    </div>
  );
});

Carousel.displayName = "Carousel";

export { Carousel };