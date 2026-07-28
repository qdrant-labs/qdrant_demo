import { useState } from "react";

function StartupCard({ startup, onFindSimilar }) {
  const name = startup.name;
  const city = startup.city;
  // Support both the raw dataset fields and the backend's renamed payload.
  const description = startup.description || startup.document || "";
  // Keyword search returns a separate `highlight` field with <b> around matches.
  const displayHtml = highlightHtml(startup.highlight || description);
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

        <p dangerouslySetInnerHTML={{ __html: displayHtml }} />
      </div>

      <div className="result-meta">
        {typeof startup.score === "number" && (
          <span className="score">Match {startup.score.toFixed(3)}</span>
        )}
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

// Escape all HTML, then re-allow only the <b> tags the backend uses to mark
// keyword matches. Keeps highlighting (bold) while preventing HTML injection.
function highlightHtml(text = "") {
  const escaped = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/&lt;b&gt;/g, "<b>")
    .replace(/&lt;\/b&gt;/g, "</b>");
}

export default StartupCard;
