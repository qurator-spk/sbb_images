import React from "react";

export const helpTexts = {
  image: (
    <div className="help-content">
      <ol>
        <li>
          Drag and drop or upload an image (JPEG, PNG) of your choice to find similar 
          images within the Stabi Digitized Collections. The image upload 
          automatically triggers the search, there is no button to click afterwards. 
          Results will start appearing after a few seconds.
        </li>
        <li>
          The query image will appear with a blue frame. If you move the
          margins of the frame in any direction, you can define a specific
          region of the image that will become the basis for new queries,
          narrowing down your search to specific parts of the initial image
          (e.g., a ship, a person and so on).
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
          To see the document containing the shown image, click on "View in
          Digitized Collections". This takes you to the document in the Stabi
          Digitized Collections.
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
          But it’s not mandatory to be very specific - if all you have is, for example, “red squirrel”, you can start with that. 
          After a short delay, the results will start appearing.
          {/* Currently we only support text queries in the English language. Other 
          languages will be added later, but right now please use English only. */}
        </li>
        <li>
          The description search returns images ordered according to how well they 
          match the description.
        </li>
        <li>
          Clicking the “Search Similar Images” button in one of the results cards 
          starts a new search, with the chosen image as the new query.
        </li> 
        <li> 
          To see the document containing the shown image, click on 
          “View in Digitized Collections”. 
          This takes you to the document in the Stabi Digitized Collections.
        </li>
      </ol>
    </div>
  ),
  ppn: (
    <div className="help-content">
      <ol>
        <li>
          Enter the PPN of a specific document from the Stabi Digitized Collections in 
          the input field. Only the digits are needed. (The PPN - Pica Production Number - is 
          a unique document identifier used at the Berlin State Library. You can use it to 
          find a specific document in the collection. 
          You can read more about it <a href="https://github.com/elektrobohemian/StabiHacks/blob/master/ppn-howto.md" target="_blank"
                  rel="noopener noreferrer">on this page</a>.)

        </li>
        <li>
          After a short delay, the results will start appearing one by one.
        </li>
        <li>
          The PPN search returns all the images that were detected within that 
          particular document’s pages by an AI model, together with the name of the 
          document and a link to it in the Digitized Collections.
        </li>
        <li>
          Clicking the “Search Similar Images” button in one of the results cards 
          starts a new search, with the chosen image as the new query.
        </li>
      </ol>
    </div>
  ),
};

