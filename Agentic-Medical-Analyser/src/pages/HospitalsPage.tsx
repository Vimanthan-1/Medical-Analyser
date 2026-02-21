import { useEffect, useState } from 'react';
import { MapPin, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NearbyHospitals } from '@/components/NearbyHospitals';
import { TriageResult } from '@/lib/types';
import { nearestHospital } from '@/lib/api';

export default function HospitalsPage() {
  const [dept, setDept] = useState<string | undefined>();
  const [nearest, setNearest] = useState<{ name: string; distance: number; mapsUrl?: string } | null>(null);
  const [nearestLoading, setNearestLoading] = useState(false);
  const [nearestError, setNearestError] = useState<string | null>(null);

  useEffect(() => {
    const r = sessionStorage.getItem('triageResult');
    if (r) {
      const result: TriageResult = JSON.parse(r);
      setDept(result.department);
    }
  }, []);

  async function findNearest() {
    setNearestLoading(true);
    setNearestError(null);
    setNearest(null);

    try {
      // Request geolocation with a generous timeout
      const getPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 15000,
          enableHighAccuracy: true,
          maximumAge: 0,
        });
      });

      const pos = await getPosition();
      const data = await nearestHospital(pos.coords.latitude, pos.coords.longitude);

      // Backend returns a friendly name string when it fails — detect and surface it
      const isError =
        !data.name ||
        data.name.startsWith("No hospital") ||
        data.name.startsWith("Map service error") ||
        data.name.startsWith("Error");

      if (isError) {
        throw new Error(data.name || "No hospital found nearby");
      }

      setNearest({
        name: data.name,
        distance: data.distance_km ?? 0,
        mapsUrl: data.maps_url ?? undefined,
      });
    } catch (err: unknown) {
      console.error("Nearest hospital error:", err);
      let msg = "Could not get location or find a nearby hospital.";
      if (err instanceof GeolocationPositionError) {
        if (err.code === 1) msg = "Location access denied. Please allow location in your browser.";
        else if (err.code === 2) msg = "Location unavailable. Check your device GPS or network.";
        else if (err.code === 3) msg = "Location request timed out. Try again.";
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setNearestError(msg);
    } finally {
      setNearestLoading(false);
    }
  }

  return (
    <div className="py-4 max-w-3xl mx-auto space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display text-lg font-bold text-foreground mb-2">Nearest Hospital (Live)</h3>
        <p className="text-sm text-muted-foreground mb-4">Get the closest hospital using your location</p>
        <Button
          onClick={() => findNearest()}
          disabled={nearestLoading}
          className="gap-2 gradient-primary text-primary-foreground border-0"
        >
          {nearestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {nearestLoading ? "Finding..." : "Use my location"}
        </Button>
        {nearest && (
          <div className="mt-4 p-4 rounded-xl bg-muted/50">
            <p className="font-semibold text-foreground">{nearest.name}</p>
            <p className="text-sm text-muted-foreground">{nearest.distance.toFixed(1)} km away</p>
            {nearest.mapsUrl && (
              <a
                href={nearest.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open in Google Maps
              </a>
            )}
          </div>
        )}
        {nearestError && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-destructive">{nearestError}</p>
            <button
              onClick={() => findNearest()}
              className="text-xs text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
      <NearbyHospitals recommendedDepartment={dept as any} />
    </div>
  );
}
