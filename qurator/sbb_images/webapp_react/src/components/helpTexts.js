import React from "react";

export const helpTexts = {
  image: (
    <div className="help-content">
      <ol>
        <li>
          Drag and drop or upload an image (JPEG, PNG) of your choice to find similar 
          images within the Stabi Digitized Collections. The image upload 
          automatically triggers the search, there is no button to click afterwards.<br/> 
          After a short delay, the results will start appearing.
        </li>
        <li>
          The query image will appear with a blue frame. If you grab and move 
          the margins of the frame in any direction, you can define a specific 
          region of the image that will become the basis for new queries, narrowing 
          down your search to specific parts of the initial image (e.g., an object, 
          a person and so on).

        </li>
        <li>
          Results are ordered according to their similarity to the query image -
          the most similar images appear first and then in decreasing order
          towards the less similar images found in the database (the lower you
          scroll, the less relevant the results).
        </li>
        <li>
          Clicking the "Search Similar Images" button in one of the results
          cards starts a new search, with the chosen image as the new query.
        </li>
        <li>
          Clicking on 'View in Digitized Collections' opens the document page where 
          this image appears in the Stabi Digitized Collections.
        </li>
      </ol>
    </div>
  ),
  description: (
    <div className="help-content">
      <ol>
        <li>
          Describe the image content you are looking for with text. The more words 
          you use, the better the results. 
          But it’s not mandatory to be very specific - if all you have is, for example, “red squirrel”, 
          you can start with that.<br/>
          <strong>We recommend starting the search text with a capital letter and ending it with a point. 
          This changes the results, and so do spaces, typos, and any sign you put in the input 
          field. To repeat a search and get the same results the text must be absolutely 
          identical.</strong><br/>
          After a short delay, the results will start appearing.
        </li>
        <li>
          The description search returns images ordered according to how well they 
          match the description - the best matches will appear first, then in decreasing 
          order towards the less similar images found in the database (the lower you scroll, 
          the less relevant the results).
        </li>
        <li>
          Clicking the “Search Similar Images” button in one of the results cards 
          starts a new search, with the chosen image as the new query.
        </li> 
        <li> 
          Clicking on "View in Digitized Collections" opens the document page where 
          this image appears in the Stabi Digitized Collections.
        </li>
      </ol>
    </div>
  ),
  ppn: (
    <div className="help-content">
      <ol>
        <li>
          Enter the PPN of a specific document from the Stabi Digitized Collections in 
          the input field. You can enter only the number (like this: "77137920X"), or 
          use "PPN" before (like this: "PPN77137920X"), as you prefer.<br/> 
          The PPN - Pica Production Number - is 
          a unique document identifier used at the Berlin State Library. You can use it to 
          find a specific document in the collection. 
          You can read more about it <a href="https://github.com/elektrobohemian/StabiHacks/blob/master/ppn-howto.md" target="_blank"
                  rel="noopener noreferrer">on this page</a>.
          <br/>
          After a short delay, the results will start appearing one by one.
        </li>
        <li>
          The PPN search returns all the images that were detected within that 
          particular document’s pages by an AI model, together with a link to 
          the document in the Digitized Collections. The images are shown in the same order as 
          they appear in the document - starting from images found on the first page and 
          continuing to the last page.
        </li>
        <li>
          Clicking the “Search Similar Images” button in one of the results cards 
          starts a new search, with the chosen image as the new query.
        </li>
        <li> 
          Clicking on "View in Digitized Collections" opens the document page where 
          this image appears in the Stabi Digitized Collections.
        </li>
      </ol>
    </div>
  ),
};

