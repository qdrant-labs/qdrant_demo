function StartupCard({ startup, onFindSimilar }) {
  const { name, city, description, images, link } = startup;
  const hasWebsite = link && link !== "nan" && !link.includes("example.com");

  return (
    <article className="result-card">
      <div className="result-logo">
        {images ? (
          <img src={images} alt={name} />
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
