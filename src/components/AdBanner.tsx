import { useEffect } from "react";

interface AdBannerProps {
  adClient?: string; // e.g. ca-pub-XXXXXXXXXXXXXXXX
  adSlot?: string;   // e.g. XXXXXXXXXX
}

export default function AdBanner({
  adClient = "ca-pub-placeholder",
  adSlot = "placeholder-slot"
}: AdBannerProps) {
  
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const adsbygoogle = (window as any).adsbygoogle || [];
        adsbygoogle.push({});
      }
    } catch (e) {
      // Safe catch if AdSense script is blocked by ad-blocker or not loaded
      console.warn("Google AdSense initialization skipped or blocked:", e);
    }
  }, []);

  return (
    <div className="adsense-banner-container">
      <div className="adsense-banner-wrapper">
        <span className="adsense-label">Advertisement</span>
        
        {/* Production Google AdSense Element */}
        <ins
          className="adsbygoogle"
          style={{ display: "block", width: "100%", height: "90px" }}
          data-ad-client={adClient}
          data-ad-slot={adSlot}
          data-ad-format="horizontal"
          data-full-width-responsive="true"
        />

        {/* Development Placeholder Banner */}
        {adClient === "ca-pub-placeholder" && (
          <div className="adsense-placeholder-card">
            <div className="placeholder-brand">Google AdSense Slot</div>
            <div className="placeholder-info">Leaderboard Banner (728 × 90)</div>
          </div>
        )}
      </div>
    </div>
  );
}
