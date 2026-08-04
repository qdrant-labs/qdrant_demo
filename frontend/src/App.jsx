import { useEffect, useState } from "react";

import "./App.css";

import Header from "./components/Header";
import Footer from "./components/Footer";
import LoadingState from "./components/LoadingState";
import StartupCard from "./components/StartupCard";
import HowItWorksModal from "./components/HowItWorksModal";

import { search, getStats } from "./lib/api";

const EXAMPLES = ["machine learning platform", "food delivery", "developer tools", "healthcare"];
const MODES = [
  { id: "semantic", label: "Semantic" },
  { id: "keyword", label: "Keyword" },
  { id: "hybrid", label: "Hybrid" },
];

// Drop the org prefix so "mixedbread-ai/mxbai-embed-large-v1" reads as "mxbai-embed-large-v1".
const shortModel = (m) => (m ? m.split("/").pop() : m);

function App() {
  const [theme, setTheme] = useState("light");
  const [query, setQuery] = useState("machine learning platform");
  const [mode, setMode] = useState("hybrid");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [count, setCount] = useState(null); // live collection size, for the scale badge
  const [stats, setStats] = useState(null); // per-search stats: mode + model + latency
  const [error, setError] = useState(false); // the last search failed to reach the backend

  async function runSearch(q = query, m = mode) {
    const clean = q.trim();
    if (!clean) return;
    setLoading(true);
    setHasSearched(true);
    setError(false);
    try {
      const { results, stats } = await search(clean, m);
      setResults(results);
      setStats(stats);
    } catch (err) {
      console.error(err);
      setResults([]);
      setStats(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runSearch();
    getStats()
      .then((d) => setCount(typeof d.count === "number" ? d.count : null))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(event) {
    event.preventDefault();
    runSearch(query, mode);
  }

  function chooseMode(m) {
    setMode(m);
    runSearch(query, m);
  }

  function findSimilar(description) {
    // "Find similar" is inherently semantic, so switch to that mode and query by
    // the raw description text.
    setMode("semantic");
    setQuery(description.slice(0, 60));
    runSearch(description, "semantic");
  }

  return (
    <div className={`app ${theme}`}>
      <Header
        theme={theme}
        setTheme={setTheme}
        onOpenHowItWorks={() => setShowHowItWorks(true)}
      />

      <main className="page">
        <section className="search-panel">
          <div className="eyebrow">Vector Search Demo</div>

          <h1>Startup Search</h1>

          <p>
            Search {count ? count.toLocaleString() : "millions of"} startup
            profiles. Switch between semantic, keyword, and hybrid search to see
            how each one ranks.
          </p>

          <div className="controls-row">
            <div className="segmented">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  className={mode === m.id ? "active" : ""}
                  onClick={() => chooseMode(m.id)}
                  type="button"
                >
                  {m.label}
                </button>
              ))}
            </div>

            {count != null && (
              <div className="scale-badge" title={`${count.toLocaleString()} points`}>
                <span className="scale-dot" />
                {count.toLocaleString()} startups indexed in Qdrant
              </div>
            )}
          </div>

          <form className="search-box" onSubmit={onSubmit}>
            <span className="search-icon">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search startups by meaning…"
            />
            <button className="search-submit" type="submit" disabled={loading}>
              {loading ? "Searching" : "Search"}
            </button>
          </form>

          <div className="chips">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => { setQuery(ex); runSearch(ex, mode); }}>
                {ex}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <LoadingState />
        ) : results.length > 0 ? (
          <section className="results-section">
            <div className="results-header">
              <div>
                <span>Results</span>
                <p>{results.length} startups · {mode} search</p>
              </div>
            </div>

            {stats && (
              <div className="search-stats">
                <span className="stat-pill">mode: {stats.mode || mode}</span>
                {stats.embedding_model && (
                  <span className="stat-pill">model: {shortModel(stats.embedding_model)}</span>
                )}
                {typeof stats.latency_ms === "number" && (
                  <span className="stat-pill">{stats.latency_ms}ms</span>
                )}
              </div>
            )}
            <div className="results">
              {results.map((s, i) => (
                <StartupCard key={`${s.name}-${i}`} startup={s} onFindSimilar={findSimilar} />
              ))}
            </div>
          </section>
        ) : error ? (
          <section className="empty-state">
            <div className="empty-state-header">
              <span>Search failed</span>
              <h3>Couldn't reach the search service</h3>
              <p>Please try again in a moment.</p>
            </div>
          </section>
        ) : (
          hasSearched && (
            <section className="empty-state">
              <div className="empty-state-header">
                <span>No matches</span>
                <h3>Try a broader query</h3>
                <p>Switch modes or try one of the example searches above.</p>
              </div>
            </section>
          )
        )}
      </main>

      <Footer theme={theme} />

      {showHowItWorks && (
        <HowItWorksModal onClose={() => setShowHowItWorks(false)} />
      )}
    </div>
  );
}

export default App;
