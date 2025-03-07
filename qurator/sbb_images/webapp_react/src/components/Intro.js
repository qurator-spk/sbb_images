import React from "react";
import "../styles/Intro.css";

const Intro = () => {
  return (
    <div className="intro-text">
      <h2>Welcome to the Stabi Image Search (Beta)</h2>
      <p>
        This is an AI-based image search tool which allows you to search for
        images inside documents from 
        the&nbsp;<a href="https://digital.staatsbibliothek-berlin.de/" target="_blank">Digitized 
        Collections</a> of 
        the&nbsp;<a href="https://staatsbibliothek-berlin.de/" target="_blank">Berlin
        State Library (SBB)</a>. You can start your search either by using an
        image of your choice (drag and drop in the designated area or upload), describing the image you are looking for, using a document’s
        unique identifier (PPN) to find the images inside a specific work, or by
        exploring our random image selection below. All the search results will
        be images. The underlying technology 
        is&nbsp;<a href="https://github.com/qurator-spk/sbb_images" target="_blank">
        open source</a>  and actively being
        developed by SBB in 
        the&nbsp;<a href="https://github.com/qurator-spk/sbb_images" target="_blank">
        Mensch.Maschine.Kultur</a>  project. <br/>
        <br/>
        <strong>The documents from the Digitized Collections of SBB cover the period of time 
        until 1945. Therefore, all results will stop at 1945.</strong>
      </p>
    </div>
  );
};

export default Intro;