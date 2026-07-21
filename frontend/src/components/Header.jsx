import qdrantRedLogo from "../assets/qdrant-brandmark-red.png";
import qdrantWhiteLogo from "../assets/qdrant-brandmark-white.png";

function Header({ theme, setTheme, onOpenHowItWorks }) {
  function toggleTheme() {
    if (theme === "light") {
      setTheme("dark");
    } else {
      setTheme("light");
    }
  }

  const logo = theme === "dark" ? qdrantWhiteLogo : qdrantRedLogo;

  return (
    <header className="header">
      <div className="brand">
        <img src={logo} alt="Qdrant" className="brand-logo" />

        <span>Qdrant</span>
      </div>

      <nav className="nav">
        <button className="how-button" onClick={onOpenHowItWorks}>
          How it works
        </button>

        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === "light" ? "Dark" : "Light"}
        </button>
      </nav>
    </header>
  );
}

export default Header;
