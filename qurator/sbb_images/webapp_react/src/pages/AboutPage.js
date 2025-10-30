import React from "react";
import Header from "../components/Header";
import "../styles/AboutPage.css";

const AboutPage = () => {
  return (
    <div className="about-page">
      <Header />
      <div className="about-content">
        <h1>About This Project</h1>
        
        <div className="intro-section">
          <p>
            This AI-based image similarity search tool enables you to search for
            images within the{" "}
            <a
              href="https://digital.staatsbibliothek-berlin.de/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Berlin State Library (Stabi)'s Digitized Collections
            </a>
            . <strong>All documents in the collections date back to 1945 or earlier,
            therefore all the search results will also stop at 1945.</strong>
          </p>
        </div>

        <div className="methods-section">
          <p>There are three different types of search:</p>

          <div className="methods-grid">
            <div className="method-card">
              <div className="method-header">
                <i className="method-icon fa-regular fa-image"></i>
                <h3>Image Search</h3>
              </div>
              <div className="method-content">
                By using an image of your choice or one from the selection on the landing page, 
                you can start an image similarity search. This type of search finds images 
                similar to the one you used and shows them from the most to the least similar.
                The image used as a query appears on the results page 
                with <strong>a blue frame - the cropper frame, see the example below</strong>, which you can drag to look for specific 
                parts of the image.  
              </div>
            </div>
            
            <div className="method-card">
              <div className="method-header">
                <i className="method-icon fa-solid fa-pen-to-square"></i>
                <h3> Description Search</h3>
              </div>
              <div className="method-content">
                You can describe the content of an image you have in mind using German, English, 
                and several other languages, which you can 
                find <a href="https://github.com/FreddeFrallan/Multilingual-CLIP/blob/main/translation/data/fine_tune_languages.csv" target="_blank"
            rel="noopener noreferrer">listed here</a>. 
                <strong>This is a search through the content of the images, not metadata.</strong>
                The results will be, as for the image search, shown from the one that 
                most closely matches your description to the least matching.
              </div>
            </div>
            
            <div className="method-card">
              <div className="method-header">
                <i className="method-icon fa-solid fa-hashtag"></i>
                <h3>PPN Search</h3>
              </div>
              <div className="method-content">
                PPNs are unique document identifiers used at the Berlin State Library (
                <a href="https://github.com/elektrobohemian/StabiHacks/blob/master/ppn-howto.md" target="_blank"
                rel="noopener noreferrer">you can read more about them here</a>). If you know 
                the PPN of a specific document, you can use it to find and display all the images it contains. 
                They will be shown in the same order as they appear in the document, starting from images 
                found on the first page and continuing to the last page. 
              </div>
            </div>
          </div>
        </div>

        <div className="cropper-example-section">
          <h3>Using the Cropper Frame</h3>
          
          <div className="cropper-images">
            <div className="cropper-image-container">
              <img src="/images/cropper.png" alt="Cropper frame on full image" />
            </div>
            
            <div className="cropper-image-container">
              <img src="/images/cropper2.png" alt="Cropper frame selecting specific area" />
            </div>
          </div>
          
          <p className="cropper-explanation">
            When using an image to start your search, this image will appear on the results page with a blue frame 
            around it. You can drag that frame to select a specific area of the image. This will start a new search 
            which will find images similar to only that cropped portion.
          </p>
        </div>

        <div className="important-note">
          <h3>Important</h3>
          <p>
            Due to the nature of this tool,{" "}
            <strong>
              no image or description search will return an error or have zero results
            </strong>
            . However, sometimes the results may not be very accurate - while
            the displayed images may not look very much like the one used as a
            query or match the description you provided, they will be{" "}
            <em>the most similar ones found in the database</em>. Therefore,
            we ask you to exercise caution and in case the results seem off,
            start a different search or try a more detailed description. It
            may be that the database doesn't contain any images similar to the
            one you are looking for, or it may be that your description could
            use more detail (it is better to use longer descriptions rather than single
            words) {/* - think about those school exercises asking you to describe
            an image and be as specific as you can in a search bar) */}.
          </p>
        </div>

        <div className="technology-section">
          <p>
            The software used for this image similarity search is still a work
            in progress and is actively being developed by Stabi Berlin in the{" "}
            <strong>Mensch.Maschine.Kultur project</strong>. If you would like
            to know more about our group and our other projects, the Berlin
            State Library, or see the codes (and maybe use them yourself), check
            the links below.
          </p>
        </div>

        <div className="links-section">
            <a href="https://mmk.sbb.berlin/" target="_blank"
              rel="noopener noreferrer" className="link-card">
              <i className="fa-solid fa-flask link-icon"></i>
              <div className="link-content">
                <strong>The Project - Mensch.Maschine.Kultur</strong>
              </div>
            </a>
            <a href="https://github.com/qurator-spk/sbb_images" target="_blank"
              rel="noopener noreferrer" className="link-card">
              <i className="fa-brands fa-github link-icon"></i>
              <div className="link-content">
                <strong>Github</strong>
              </div>
            </a>
            <a href="https://staatsbibliothek-berlin.de/" target="_blank"
              rel="noopener noreferrer" className="link-card">
              <i className="fa-solid fa-building-columns link-icon"></i>
              <div className="link-content">
                <strong>Staatsbibliothek zu Berlin</strong>
              </div>
            </a>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;