function HowItWorksModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="how-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p>How it works</p>
            <h2>Startup search powered by Qdrant</h2>
          </div>
          {/* An SVG rather than a × glyph: the character's ink sits on the
              font's math axis, above the middle of its line box, so centering
              the text still left it visibly high in the circle. */}
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M7 7l10 10M17 7L7 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="modal-content">
          <div className="pipeline">
            <div className="pipeline-node">
              <span>1</span>
              <strong>Data</strong>
              <p>Company profiles from Crunchbase (name, description, location).</p>
            </div>

            <div className="pipeline-arrow">→</div>

            <div className="pipeline-node">
              <span>2</span>
              <strong>Embeddings</strong>
              <p>Each profile is turned into a vector with mxbai-embed-large-v1.</p>
            </div>

            <div className="pipeline-arrow">→</div>

            <div className="pipeline-node">
              <span>3</span>
              <strong>Qdrant</strong>
              <p>Vectors are stored and searched in a Qdrant collection.</p>
            </div>

            <div className="pipeline-arrow">→</div>

            <div className="pipeline-node">
              <span>4</span>
              <strong>Results</strong>
              <p>The closest companies are ranked and returned.</p>
            </div>
          </div>

          <div className="how-section">
            <h3>Search modes</h3>
            <div className="mode-grid">
              <div className="mode-card">
                <span>Semantic</span>
                <p>
                  Finds companies by meaning. “food delivery” surfaces relevant
                  startups even when they don’t use those exact words.
                </p>
              </div>
              <div className="mode-card">
                <span>Keyword</span>
                <p>
                  Classic full-text match. Returns companies whose descriptions
                  contain your exact terms.
                </p>
              </div>
              <div className="mode-card">
                <span>Find similar</span>
                <p>
                  Uses a company’s own vector to pull up the most similar
                  companies in the dataset.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HowItWorksModal;
