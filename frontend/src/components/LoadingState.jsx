function LoadingState({
  title = "Searching database",
  message = "Ranking startup descriptions with in-browser vector search.",
}) {
  return (
    <section className="loading-state">
      <div className="loading-spinner"></div>

      <div>
        <h3>{title}</h3>

        <p>{message}</p>
      </div>
    </section>
  );
}

export default LoadingState;
