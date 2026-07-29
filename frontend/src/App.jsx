import { useEffect, useState } from "react";

import "./App.css";

import Header from "./components/Header";
import Footer from "./components/Footer";
import LoadingState from "./components/LoadingState";
import StartupCard from "./components/StartupCard";
import HowItWorksModal from "./components/HowItWorksModal";

import { search, getStats } from "./lib/api";

const EXAMPLES = ["machine learning platform", "food delivery", "developer tools", "healthcare"];

function App() {
  const [theme, setTheme] = useState("light");
  const [query, setQuery] = useState("machine learning platform");
  const [neural, setNeural] = useState(true);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [count, setCount] = useState(null); // live collection size, for the scale badge

  async function runSearch(q = query, useNeural = neural) {
    const clean = q.trim();
    if (!clean) return;
    setLoading(true);
    setHasSearched(true);
    try {
      setResults(await search(clean, useNeural));
    } catch (err) {
      console.error(err);
      setResults([]);
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
    runSearch(query, neural);
  }

  function setMode(useNeural) {
    setNeural(useNeural);
    runSearch(query, useNeural);
  }

  function findSimilar(description) {
    // "Find similar" is inherently semantic — switch to neural and query by the
    // raw description text.
    setNeural(true);
    setQuery(description.slice(0, 60));
    runSearch(description, true);
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
            profiles by meaning. Toggle between semantic (neural) search and
            classic keyword search to see the difference.
          </p>

          {count != null && (
            <div className="scale-badge" title={`${count.toLocaleString()} points`}>
              <span className="scale-dot" />
              {count.toLocaleString()} startups indexed in Qdrant
            </div>
          )}

          <div className="segmented">
            <button
              className={neural ? "active" : ""}
              onClick={() => setMode(true)}
              type="button"
            >
              Semantic
            </button>
            <button
              className={!neural ? "active" : ""}
              onClick={() => setMode(false)}
              type="button"
            >
              Keyword
            </button>
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
              <button key={ex} type="button" onClick={() => { setQuery(ex); runSearch(ex, neural); }}>
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
                <p>{results.length} startups · {neural ? "semantic" : "keyword"} search</p>
              </div>
            </div>
            <div className="results">
              {results.map((s, i) => (
                <StartupCard key={`${s.name}-${i}`} startup={s} onFindSimilar={findSimilar} />
              ))}
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
