import React from "react";
import Header from "../components/Header";
import SearchSimilarImages from "../components/SearchSimilarImages";
import "../styles/AboutPage.css";
import { useNavigate } from "react-router-dom";
import { makeSearchState } from "../components/SearchState";

const AboutPage = () => {
  // Making the card functional
  const navigate = useNavigate();
  const [searchState, setSearchState] = React.useState(makeSearchState());

  const updateResults = (next_state) => {
    try {
      navigate("/search-results", {
        state: {
          activeTab: "image",
          searchState: next_state.serialized,
        }
      });
    } catch(error) {
      console.log("Failed to navigate:", error.message);
      setSearchState(next_state);
    }
  };

  const exampleCard = {
    src: "api/image/DIGISAM/257062",
    title: "Kupfer-Sammlung besonders zu F. P. Wilmsens Handbuch der ...",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN766734536&PHYSID=PHYS_0049",
  };

  return (
    <div className="about-page">
      <Header />
      <div className="about-content">
        {/* <div className="page-title"> */}
          <h2>About This Project</h2>
        {/* </div> */}
        
  {/* <div className="text-container">  */}
        <div className="main-text">
          <p>
            This AI-based image similarity search tool enables you to search for
            images within the{" "}
            <a
              href="https://digital.staatsbibliothek-berlin.de/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Berlin State Library (SBB)'s Digitized Collections
            </a>
            . <strong>All documents in the collections date back to 1945 or earlier,
            therefore all the search results will also stop at 1945.</strong>
          </p>

          <div className="list-with-example">
            <div className="list-content">
              <p>There are three different ways to start a search:</p>
              <ul>
                <li>
                  {" "}
                  <strong>
                    Using an image - drag and drop or upload an image of your choice, 
                    or click on one of the examples
                  </strong>{" "}
                  on our homepage. Results will be shown from the most to
                  the least similar ones.<br/>
                  Starting a search by uploading an image and by clicking the "Search Similar Images" 
                  in one of the cards will lead to different results, even if the 
                  query image is the same.
                </li>
                <li>
                  {" "}
                  <strong>
                    Describe the image you have in mind, using the Description
                    Tab
                  </strong>
                  . The results will be, as before, shown from the one that
                  most closely matches your description to the least matching.
                </li>
                <li>
                  {" "}
                  <strong>
                    Look for a specific document using its PPN number
                  </strong>{" "}
                  (if you are not familiar with PPNs{" "}
                  <a href="https://github.com/elektrobohemian/StabiHacks/blob/master/ppn-howto.md" target="_blank"
                  rel="noopener noreferrer">you can read more about them here</a>). This will
                  find and display all the images found inside the document, shown in the same order as 
                  they appear - starting from images found on the first page and 
                  continuing to the last page. 
                  {/* You can then start a new search by clicking on the "Search Similar
                  Images" button that appears under every image (see the example on the right). */}
                </li>
              </ul>
            </div>

            <div className="example-section">
              <div className="image-card">
                <div className="image-container">
                  <img
                    src={exampleCard.src}
                    alt={exampleCard.title}
                    className="card-image"
                  />
                </div>
                <a
                  href={exampleCard.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="title-wrapper">{exampleCard.title}</div>
                </a>
                <SearchSimilarImages
                  /* imageId={exampleCard.src.split("/").pop()}
                  isFromResults={false} */
                  searchState={searchState}
                  setSearchState={setSearchState}
                  imageId={exampleCard.src.split("/").pop()}
                  updateResults={updateResults}
                />
              </div>
              <p className="example-caption">
                Click on the "Search Similar Images" button and you will get <br/>images similar to the one in the card above.
              </p>
            </div>
          </div>

          <div className="notice">
            <h3>IMPORTANT NOTE!</h3>
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
              words - think about those school exercises asking you to describe
              an image and be as specific as you can in a search bar).
            </p>
          </div>

          <p>
            The software used for this image similarity search is still a work
            in progress and is actively being developed by SBB in the{" "}
            <strong>Mensch.Maschine.Kultur project</strong>. If you would like
            to know more about our group and our other projects, the Berlin
            State Library, or see the codes (and maybe use them yourself), check
            the links below.
          </p>

          <div className="links">
            <a href="https://mmk.sbb.berlin/" target="_blank"
              rel="noopener noreferrer" className="link">
              The Project - Mensch.Maschine.Kultur
            </a>
            <a href="https://github.com/qurator-spk/sbb_images" target="_blank"
              rel="noopener noreferrer" className="link">
              Github
            </a>
            <a href="https://staatsbibliothek-berlin.de/" target="_blank"
              rel="noopener noreferrer" className="link">
              Staatsbibliothek zu Berlin
            </a>
          </div>
        </div>
{/* </div> */}
      </div>
    </div>
  );
};

export default AboutPage;