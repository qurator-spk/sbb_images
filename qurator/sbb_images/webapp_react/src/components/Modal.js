import React from 'react';
import './Modal.css'; 

const Modal = ({ type, closeModal }) => {
  // Define the content based on the type of search
  let content;
  switch (type) {
    case 'image':
      content = (
        <div>
          <h2>How to search by image</h2>
          <p>Upload an image (JPEG, PNG) of your choice to find similar images within the Stabi Digitized Collections. The image upload automatically triggers the search, there is no button to click afterwards. Results will start appearing after a few seconds.
The uploaded image will appear with a blue frame. If you move the margins of the frame in any direction, you can define a specific region of the image that will become the basis for new queries, narrowing down your search to specific parts of the initial image (e.g., a ship, a person and so on).
Results are ordered according to their similarity to the query image - the most similar images appear first and then in decreasing order towards the less similar images found in the database (the lower you scroll, the less relevant the results).
Clicking the “Search similar images” button in one of the results cards starts a new search, with the chosen image as the new query.
To see the document containing the shown image, click on “View in Digitized Collections”. This takes you to the document in the Stabi Digitized Collections.
To find out more about the different types of search and to see a short demo,</p>
        </div>
      );
      break;
    case 'text':
      content = (
        <div>
          <h2>Description Search Info</h2>
          <p>Information about text search...</p>
        </div>
      );
      break;
    case 'number':
      content = (
        <div>
          <h2>PPN Search Info</h2>
          <p>Information about PPN search...</p>
        </div>
      );
      break;
    default:
      content = (
        <div>
          <h2>Modal Content</h2>
          <p>This is the default content of the modal.</p>
        </div>
      );
  }

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={closeModal}>X</button>
        {content}
      </div>
    </div>
  );
};

export default Modal;
