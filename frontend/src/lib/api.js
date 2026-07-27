// Talks to the original qdrant_demo backend: GET /api/search?q=&neural=.
// neural=true -> semantic vector search; neural=false -> full-text search.
// The backend serves this frontend, so the call is same-origin.
//
// Set VITE_MOCK=1 in dev (no backend) to preview the styling with sample data.
const USE_MOCK = import.meta.env.VITE_MOCK === "1";

export async function search(query, neural = true) {
  if (USE_MOCK) return mockSearch(query, neural);

  const res = await fetch(
    `api/search?q=${encodeURIComponent(query)}&neural=${neural}`,
  );
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
  return data.result || [];
}

/* ------------------------------- dev mock -------------------------------- */

const MOCK = [
  { name: "Qdrant", city: "Berlin", description: "Open-source vector database and similarity search engine for the next generation of AI applications.", images: "", link: "https://qdrant.tech" },
  { name: "Deepset", city: "Berlin", description: "Building the leading open-source framework for production-ready NLP and semantic search systems.", images: "", link: "https://example.com" },
  { name: "LayerAI", city: "San Francisco", description: "Developer platform for training, versioning and deploying machine-learning models at scale.", images: "", link: "https://example.com" },
  { name: "VectorWorks", city: "London", description: "Real-time recommendation infrastructure powered by approximate nearest-neighbor search.", images: "", link: "https://example.com" },
  { name: "Semantify", city: "Amsterdam", description: "Neural search API that lets product teams add meaning-based search in a few lines of code.", images: "", link: "https://example.com" },
];

function mockSearch(query, neural) {
  const tag = neural ? " " : " ";
  return Promise.resolve(MOCK.map((m) => ({ ...m, description: m.description + tag })));
}
