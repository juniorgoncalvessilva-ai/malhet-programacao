"use client";

import { Carousel } from "@/components/ui/carousel";
import { Button } from "@/components/ui/Button";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useState } from "react";
import { useTranslations } from 'next-intl';
import { cn } from "@/lib/utils";

// Dados de exemplo
const imageSlides = [
  { src: "/images/carousel/image1.jpg", alt: "Imagem 1", thumb: "/images/carousel/thumb1.jpg" },
  { src: "/images/carousel/image2.jpg", alt: "Imagem 2", thumb: "/images/carousel/thumb2.jpg" },
  { src: "/images/carousel/image3.jpg", alt: "Imagem 3", thumb: "/images/carousel/thumb3.jpg" },
  { src: "/images/carousel/image4.jpg", alt: "Imagem 4", thumb: "/images/carousel/thumb4.jpg" },
  { src: "/images/carousel/image5.jpg", alt: "Imagem 5", thumb: "/images/carousel/thumb5.jpg" },
];

const testimonials = [
  {
    text: "Este produto mudou completamente nossa forma de trabalhar.",
    author: "João Silva",
    role: "CEO, TechCorp",
    avatar: "/images/avatars/avatar1.jpg"
  },
  {
    text: "Interface intuitiva e funcionalidades incríveis.",
    author: "Maria Santos", 
    role: "Designer, Creative Studio",
    avatar: "/images/avatars/avatar2.jpg"
  },
  {
    text: "Suporte excepcional e produto de alta qualidade.",
    author: "Pedro Costa",
    role: "Developer, StartupXYZ", 
    avatar: "/images/avatars/avatar3.jpg"
  },
];

export default function CarouselsPage() {
  const [controlledApi, setControlledApi] = useState<any>();
  const t = useTranslations('UIElements');
  const tCarousel = useTranslations('Carousel');

  // Slides básicos
  const basicSlides = Array.from({ length: 5 }, (_, i) => (
    <div
      key={i}
      className="h-64 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center text-white text-2xl font-bold"
    >
      {tCarousel('slideNumber', { number: i + 1 })}
    </div>
  ));

  // Slides de produtos
  const productSlides = Array.from({ length: 8 }, (_, i) => (
    <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border">
      <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
      <h4 className="font-semibold text-dark dark:text-white">{tCarousel('product', { number: i + 1 })}</h4>
      <p className="text-sm text-gray-500 dark:text-gray-400">{tCarousel('productDescription')}</p>
      <div className="mt-2 text-lg font-bold text-primary">{tCarousel('price', { price: (i + 1) * 99 })}</div>
    </div>
  ));

  // Slides de imagens
  const imageSlideElements = imageSlides.map((img, i) => (
    <div key={i} className="relative h-80 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10"></div>
      <div className="absolute bottom-4 left-4 z-20 text-white">
        <h3 className="text-xl font-bold">{img.alt}</h3>
        <p className="text-sm opacity-90">{tCarousel('imageDescription', { number: i + 1 })}</p>
      </div>
      {/* Placeholder - em produção, usar img real */}
      <div className={cn(
        "w-full h-full bg-gradient-to-br",
        i % 5 === 0 && "from-blue-400 to-purple-500",
        i % 5 === 1 && "from-green-400 to-blue-500",
        i % 5 === 2 && "from-purple-400 to-pink-500",
        i % 5 === 3 && "from-yellow-400 to-orange-500",
        i % 5 === 4 && "from-pink-400 to-red-500"
      )}></div>
    </div>
  ));

  // Slides de depoimentos
  const testimonialSlides = testimonials.map((testimonial, i) => (
    <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border text-center">
      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4"></div>
      <blockquote className="text-lg text-gray-700 dark:text-gray-300 mb-4">
        &ldquo;{testimonial.text}&rdquo;
      </blockquote>
      <div>
        <div className="font-semibold text-dark dark:text-white">{testimonial.author}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{testimonial.role}</div>
      </div>
    </div>
  ));

  return (
    <>
      <Breadcrumb pageName={t('carousels')} />

      <div className="space-y-8">
        
        {/* Carousel Básico */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('basicCarousel')}
          </h3>
          
          <Carousel
            slides={basicSlides}
            showArrows={true}
            showDots={true}
          />
        </div>

        {/* Carousel com Autoplay */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('withAutoplay')}
          </h3>
          
          <Carousel
            slides={imageSlideElements}
            options={{
              loop: true,
              autoplay: true,
              autoplayDelay: 4000
            }}
            showArrows={true}
            showDots={true}
          />
        </div>

        {/* Carousel Múltiplos Slides */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('multipleSlides')}
          </h3>
          
          <Carousel
            slides={productSlides}
            options={{
              slidesToShow: 4,
              slidesToScroll: 2,
              align: 'start'
            }}
            showArrows={true}
            showDots={true}
            slideClassName="px-2"
          />
        </div>

        {/* Carousel de Depoimentos */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('testimonials')}
          </h3>
          
          <Carousel
            slides={testimonialSlides}
            options={{
              loop: true,
              autoplay: true,
              autoplayDelay: 6000,
              align: 'center'
            }}
            showDots={true}
            showArrows={false}
          />
        </div>

        {/* Carousel com Thumbs */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('withThumbs')}
          </h3>
          
          <Carousel
            slides={imageSlideElements}
            options={{ loop: true }}
            showThumbs={true}
            thumbs={imageSlides.map(img => img.thumb)}
            showArrows={true}
          />
        </div>

        {/* Carousel Controlado */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('controlled')}
          </h3>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                size="small"
                onClick={() => controlledApi?.scrollPrev()}
                label={tCarousel('previous')}
              />
              <Button
                size="small"
                onClick={() => controlledApi?.scrollNext()}
                label={tCarousel('next')}
              />
              <Button
                size="small"
                variant="outlinePrimary"
                onClick={() => controlledApi?.scrollTo(0)}
                label={tCarousel('first')}
              />
            </div>

            <Carousel
              slides={basicSlides}
              onInit={setControlledApi}
              showDots={true}
            />
          </div>
        </div>

        {/* Configurações Responsivas */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('responsive')}
          </h3>
          
          <p className="mb-4 text-gray-600 dark:text-gray-400">
            {tCarousel('responsiveDescription')}
            <br />
            {tCarousel('responsiveMobile')}
            <br />
            {tCarousel('responsiveTablet')}
            <br />
            {tCarousel('responsiveDesktop')}
          </p>
          
          <div className="carousel-responsive">
            <Carousel
              slides={productSlides}
              options={{
                slidesToShow: 1, // Padrão mobile
                align: 'start'
              }}
              showArrows={true}
              showDots={true}
              className="carousel-responsive"
              slideClassName="px-2"
            />
          </div>
        </div>

        {/* Código de Exemplo */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('codeExample')}
          </h3>
          
          <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <pre className="text-sm text-gray-800 dark:text-gray-200">
{`// Carousel básico
<Carousel
  slides={slides}
  showArrows={true}
  showDots={true}
/>

// Carousel com configurações
<Carousel
  slides={slides}
  options={{
    loop: true,
    autoplay: true,
    autoplayDelay: 3000,
    slidesToShow: 3,
    align: 'start'
  }}
  showDots={true}
/>

// Carousel controlado
const [api, setApi] = useState();

<Carousel
  slides={slides}
  onInit={setApi}
/>

<button onClick={() => api?.scrollNext()}>
  Próximo
</button>`}
            </pre>
          </div>
        </div>

      </div>

      <style jsx>{`
        .carousel-responsive .embla__slide {
          flex: 0 0 100%;
        }
        
        @media (min-width: 768px) {
          .carousel-responsive .embla__slide {
            flex: 0 0 50%;
          }
        }
        
        @media (min-width: 1024px) {
          .carousel-responsive .embla__slide {
            flex: 0 0 33.333333%;
          }
        }
      `}</style>
    </>
  );
}