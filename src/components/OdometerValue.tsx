import { useEffect, useState, useRef } from "react";

interface OdometerValueProps {
  value: number;
  duration?: number;
}

export function OdometerValue({ value, duration = 1000 }: OdometerValueProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    if (startValue === endValue) return;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      const currentValue = startValue + (endValue - startValue) * easeOutQuart;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  // STRICT FORMATTING: 1.234,56
  // Force dot as thousands separator
  let formattedValue = displayValue.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Verify and fix if system locale didn't use dots for thousands
  if (displayValue >= 1000 && !formattedValue.includes(".")) {
    // Replace non-numeric, non-comma characters with dots (usually spaces)
    // Or just re-format manually if locale support is spotty
    const parts = formattedValue.split(",");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    formattedValue = parts.join(",");
  }
  
  // Double check: if it still has spaces instead of dots
  formattedValue = formattedValue.replace(/\s/g, ".");

  return <span className="tabular-nums">{formattedValue}</span>;
}