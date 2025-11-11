import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface GoogleAddressSearchProps {
  value?: string;
  onChange: (address: string, placeDetails?: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function GoogleAddressSearch({
  value = "",
  onChange,
  placeholder = "Start typing an address...",
  disabled = false,
  className,
  "data-testid": dataTestId,
}: GoogleAddressSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      setError("Google Maps API key not configured");
      return;
    }

    // Load Google Maps script manually
    const loadGoogleMaps = async () => {
      try {
        // Check if already loaded
        if (window.google?.maps?.places) {
          setIsLoaded(true);
          return;
        }

        // Create callback function for Google Maps to call when ready
        const callbackName = `initGoogleMaps_${Date.now()}`;
        (window as any)[callbackName] = () => {
          // Wait a bit for places library to be available
          const checkPlaces = setInterval(() => {
            if (window.google?.maps?.places) {
              clearInterval(checkPlaces);
              setIsLoaded(true);
              delete (window as any)[callbackName];
            }
          }, 50);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkPlaces);
            if (!window.google?.maps?.places) {
              setError("Failed to load Google Maps Places");
            }
          }, 5000);
        };

        // Create and load the script
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
        script.async = true;
        script.defer = true;
        
        script.onerror = () => {
          setError("Failed to load Google Maps");
          delete (window as any)[callbackName];
        };
        
        document.head.appendChild(script);
      } catch (err) {
        console.error("Failed to load Google Maps:", err);
        setError("Failed to load Google Maps");
      }
    };

    loadGoogleMaps();
  }, []);

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "za" },
      fields: ["address_components", "formatted_address", "geometry", "name"],
      types: ["address"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      
      if (!place.formatted_address) {
        return;
      }

      onChange(place.formatted_address, place);
    });

    autocompleteRef.current = autocomplete;

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isLoaded, onChange]);

  if (error) {
    return (
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        data-testid={dataTestId}
      />
    );
  }

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled || !isLoaded}
      className={className}
      data-testid={dataTestId}
    />
  );
}
