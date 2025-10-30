import React from "react";
import "../styles/Intro.css";

const Intro = () => {
  return (
    <div className="intro-text">
      
       <h1>Welcome to the Stabi Image Search (Beta)</h1> 

      <div className="highlighted-note">This is an AI-based search tool that allows 
        you to search for images within documents from the <a href="https://digital.staatsbibliothek-berlin.de/" target="_blank">Stabi Digitized 
        Collections</a>, which roughly cover the period up to 1945.  
        For more details on how it works, <strong>click the orange help button below</strong> and read
        the <a href="/about">About page</a>.
      </div>
        
    </div>
  );
};

export default Intro;