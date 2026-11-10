"use client";

import jsVectorMap from "jsvectormap";
import { useEffect } from "react";
 
import  '@/components/maps/brasil'

export default function Map() {
  useEffect(() => {
    new jsVectorMap({
      map: 'brasil',
      selector: '#mapOne',
      zoomOnScroll: false,
      markers: [],
      lines: [],
      markerStyle: {
        initial: { fill: "#3b82f6" },
        selected: { fill: "#ff5050" }
      },
      markerLabelStyle: {
        initial: {
          fontFamily: "`Sego UI`, sans-serif",
          fontSize: 13
        }
      },
      lineStyle: {
        strokeDasharray: '6 3 6',
        animation: true,
        curvature: -0.5,
      },
    });
  }, []);

  return (
    <div className="h-[422px]">
      <div id="mapOne" className="mapOne map-btn" />
    </div>
  );
}
