import { useState } from "react";

function StartupCard({ startup, onFindSimilar }) {
  const name = startup.name;
  const city = startup.city;
  // Support both the raw dataset fields and the backend's renamed payload.
  const description = startup.description || startup.document || "";
  const images = startup.images || startup.logo_url || "";
  const link = startup.link || startup.homepage_url || "";
  const hasWebsite = link && link !== "nan" && !link.includes("example.com");
  const [logoOk, setLogoOk] = useState(Boolean(images));

  return (
    <article className="result-card">
      <div className="result-logo">
        {logoOk ? (
          <img src={images} alt={name} onError={() => setLogoOk(false)} />
        ) : (
          <span>{(name || "?").charAt(0)}</span>
        )}
      </div>

      <div className="result-main">
        <div className="result-tags">
          {city && <span>{city}</span>}
        </div>

        <h3>{name}</h3>

        <p dangerouslySetInnerHTML={{ __html: sanitize(description) }} />
      </div>

      <div className="result-meta">
        {onFindSimilar && (
          <button
            className="similar-button"
            onClick={() => onFindSimilar(description)}
          >
            Find similar
          </button>
        )}
        {hasWebsite && (
          <a href={link} target="_blank" rel="noreferrer">
            Website
          </a>
        )}
      </div>
    </article>
  );
}

// Minimal tag stripper (payload descriptions may contain markup).
function sanitize(text = "") {
  const stripped = String(text).replace(/<[^>]*>/g, "");
  return stripped.length > 220 ? stripped.slice(0, 200) + "…" : stripped;
}

export default StartupCard;
