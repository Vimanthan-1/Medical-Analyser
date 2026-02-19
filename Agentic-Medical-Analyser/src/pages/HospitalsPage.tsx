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

  async function findNearest(retries = 1) {
    setNearestLoading(true);
    setNearestError(null);
    setNearest(null);

    try {
      // Helper to get position with longer timeout
      const getPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 14000, // Increased to 20s to allow time for permission prompt
          enableHighAccuracy: true
        });
      });

      const pos = await getPosition();
      const data = await nearestHospital(pos.coords.latitude, pos.coords.longitude);

      if (data.name === "Error contacting map service" || data.name === "No hospital found within 5km" || data.name === "No valid hospital data found") {
        throw new Error(data.name);
      }

      const dist = data.distance_km ?? data.distance ?? 0;
      setNearest({
        name: data.name,
        distance: dist,
        mapsUrl: data["Google Maps Link"] ?? data.maps_url,
      });
    } catch (err) {
      console.error("Nearest hospital error:", err);
      // Retry logic
      if (retries > 0) {
        console.log("Retrying nearest hospital search...");
        setTimeout(() => findNearest(retries - 1), 1000);
        return;
      }
      setNearestError(err instanceof Error ? err.message : "Could not get location or find hospital");
    } finally {
      if (retries === 0) setNearestLoading(false);
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
          <p className="mt-4 text-sm text-destructive">{nearestError}</p>
        )}
      </div>
      <NearbyHospitals recommendedDepartment={dept as any} />
    </div>
  );
}
