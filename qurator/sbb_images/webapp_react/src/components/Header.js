import React from "react";
import { Link, useLocation } from "react-router-dom";
import Logo from "./Logo";
import "../styles/Header.css";

const Header = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === "/";
  const isAboutPage = location.pathname === "/about";

  return (
    <header>
      <div className="header-container">
        <div className="logo">
          <a
            href="https://staatsbibliothek-berlin.de/"
            target="_blank"
            rel="noopener noreferrer"
            className="logo-link"
            data-tooltip="Startseite der SBB"
          >
            <Logo className="logo-svg" />
          </a>
        </div>
        <nav className="header-nav">
          {isLandingPage ? (
            <span className="header-nav-item header-nav-item-current">Home</span>
          ) : (
            <Link to="/" className="header-nav-item">
              Home
            </Link>
          )}

          {isAboutPage ? (
            <span className="header-nav-item header-nav-item-current">About</span>
          ) : (
            <Link to="/about" className="header-nav-item">
              About
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
