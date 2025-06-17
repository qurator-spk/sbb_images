import React from "react";
import "../styles/Intro.css";

const Intro = () => {
  return (
    <div className="intro-text">
      <h2>Welcome to the Stabi Image Search (Beta)</h2>
      <p>
        This is an <strong>AI-based</strong> image search tool that allows you to search for
        images inside documents from 
        the&nbsp;<a href="https://digital.staatsbibliothek-berlin.de/" target="_blank">Digitized 
        Collections</a> of 
        the&nbsp;<a href="https://staatsbibliothek-berlin.de/" target="_blank">Berlin
        State Library (Stabi)</a>. 
      </p>
      <p>  
        You can start your search either by using an
        image of your choice (drag and drop in the designated area, upload or paste), describing the image you are looking for, using a document’s
        unique identifier (PPN) to find the images inside a specific work, or by
        exploring our random image selection below. All search results will
        be images. 
      </p>  
      <p>
        The underlying technology 
        is&nbsp;<a href="https://github.com/qurator-spk/sbb_images" target="_blank">
        open source</a>  and actively being
        developed by Stabi in 
        the&nbsp;<a href="https://mmk.sbb.berlin/" target="_blank">
        Mensch.Maschine.Kultur</a>  project. <br/>
        <br/>
      </p>

     {/*  <div className="highlighted-note">The tool searches inside the documents from the Digitized Collections of SBB, 
          which cover the period of time until 1945. 
          Therefore, all results will stop at 1945.
      </div> */}

      <div className="highlighted-note">This tool only searches for images within documents from the 
        Stabi Digitized Collections, which roughly cover the period up to 1945. 
        {/* Consequently, all search results will end at 1945 and include no recent images. */}
      </div>
        
    </div>
  );
};

export default Intro;