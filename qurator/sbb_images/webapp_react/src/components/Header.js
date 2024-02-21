import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo'
import './Header.css';

const Header = () => {
  console.log('Header component rendered');
  return (
    <header>
    {/* <div class="container"> */}

    
      <div>
        <img src="/images/MMK.svg" alt="LogoMMK" />
        {/* <Logo /> */}
      </div>
      <nav>
        <Link to="/help">Help</Link>
        <a href="https://github.com/qurator-spk/sbb_images" target="_blank" rel="noopener noreferrer">
          Github
        </a>
      </nav>

      {/* </div> */}
    </header>
  );
};

export default Header;
