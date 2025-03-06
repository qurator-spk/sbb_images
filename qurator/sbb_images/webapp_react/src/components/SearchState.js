

const loadNextBatchSearchSimilar = async (pos, imageId, cropCoordinates) => {

//      console.log("loadNextBatch", cropCoordinates);

      const hasCrop = cropCoordinates.x !== -1;

      const { x, y, width, height } = hasCrop ? cropCoordinates : { x: -1, y: -1, width: -1, height: -1 };

      let response = null;

      if (hasCrop) {
        response = await fetch(
          `api/similar-by-image/DIGISAM-DEFAULT/${pos}/100/${x}/${y}/${width}/${height}?search_id=${imageId}&search_id_from=DIGISAM`
        );
      } else {
        response = await fetch(
          `api/similar-by-image/DIGISAM-DEFAULT/${pos}/100?search_id=${imageId}&search_id_from=DIGISAM`
        );
      }

      let result = await response.json();
      result.type = 'image';

      return result;
};

 let loadNextBatchDescription = async (pos, description) => {

    const params = { text: description };

    const response = await fetch(
      `api/similar-by-text/DIGISAM-DEFAULT/${pos}/100`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      }
    );

    let result = await response.json();
    result.type = 'description';

    return result;
};

const loadNextBatchPPN = async (pos, ppn) => {
    try {
      const response = await fetch("api/ppn/DIGISAM/PPN" + ppn);

      if (!response.ok) {
        throw new Error();
      }
      const result = await response.json();
      result.type = 'ppn';

      if (!result.ids || result.ids.length === 0) {
        throw new Error();
      }

      return result;
    }
    catch {
      throw Error("The PPN you entered does not exist in our collection or is not a PPN. Check your input and try again.");
    }
};

const loadNextBatchSearchImage = async (pos, imgUrl, formData, cropCoordinates) => {

    const hasCrop = cropCoordinates.x !== -1;

    const { x, y, width, height } = hasCrop ? cropCoordinates : { x: -1, y: -1, width: -1, height: -1 };

    let response=null;

    if (formData) {
        let fd = new FormData();
        fd.append("file", formData.get("file"));

        if (hasCrop) {
          response = await fetch(
            `api/similar-by-image/DIGISAM-DEFAULT/${pos}/100/${x}/${y}/${width}/${height}`,
            {
              method: "POST",
              body: fd,
            }
          );
        } else {
          response = await fetch(
            `api/similar-by-image/DIGISAM-DEFAULT/${pos}/100`,
            {
              method: "POST",
              body: fd,
            }
          );
        }
    }
    else if (imgUrl) {
       const imageResponse = await fetch(imgUrl);
       const imageBlob = await imageResponse.blob();
       let fd = new FormData();
       fd.append("file", imageBlob);

       if (hasCrop) {
         response = await fetch(
           `api/similar-by-image/DIGISAM-DEFAULT/${pos}/100/${x}/${y}/${width}/${height}`,
           {
             method: "POST",
             body: fd,
           }
         );
       }
       else {
         response = await fetch(
           `api/similar-by-image/DIGISAM-DEFAULT/${pos}/100`,
           {
             method: "POST",
             body: fd,
           }
         );
       }
    }
    else {
        return { type: "no", ids: [] };
    }

    let result = await response.json();

    result.type = 'image';

    return result;
}


export const makeSearchState = () => {

    console.log("makeSearchState");

    let setImgUrlWithID = null;
    let setImgUrlWithFormData = null;
    let setDescription = null;
    let setPPN = null;

    let loadNextBatch = async (pos) => {
        console.log("loadNextBatch dummy!!!: ", pos);

        return { type: 'no', ids: []};
    };

    const add_functions = (state) => {

        state['setImgUrlWithID'] = setImgUrlWithID;
        state['setImgUrlWithFormData'] = setImgUrlWithFormData;
        state['setDescription'] = setDescription;
        state['setPPN'] = setPPN;

        state['loadNextBatch'] = loadNextBatch;

        return state;
    }

    setImgUrlWithID = (imgUrl, img_id) => {

        loadNextBatch =
        (pos, cropCoordinates={ x: -1, y: -1, width: -1, height: -1 }) => {
            console.log("loadNextBatchSearchSimilar");
            return loadNextBatchSearchSimilar(pos, img_id, cropCoordinates);
        };

        console.log("setImgUrlWithID");

        return add_functions({
            imgUrl : imgUrl,
            img_id : img_id,
            description : '',
            ppn : '',
            type: 'image'
        });
    },

    setImgUrlWithFormData = (imgUrl, formData) => {

        loadNextBatch =
        (pos, cropCoordinates={ x: -1, y: -1, width: -1, height: -1 }) => {
            console.log("loadNextBatchImage");
            return loadNextBatchSearchImage(pos, imgUrl, formData, cropCoordinates);
        };

        console.log("setImgUrlWithFormData");

        return add_functions({
            imgUrl : imgUrl,
            formData : formData,
            description : '',
            ppn : '',
            type: 'image'
        });
    },

    setDescription = (description) => {

        loadNextBatch =
        (pos, cropCoordinates={ x: -1, y: -1, width: -1, height: -1 }) => {
            console.log("loadNextBatchSearchDescription");
            return loadNextBatchDescription(pos, description);
        };

        console.log("setDescription");

        return add_functions({
            description : description,
            ppn : '',
            imgUrl : '',
            type: 'description'
        });
    },

    setPPN = (ppn) => {

        loadNextBatch =
        (pos, cropCoordinates={ x: -1, y: -1, width: -1, height: -1 }) => {
            console.log("loadNextBatchPPN");
            return loadNextBatchPPN(pos, ppn);
        };

        console.log("setPPN");

        return add_functions({
            ppn : ppn,
            description : '',
            imgUrl : '',
            type: 'ppn'
        });
    }

    return add_functions({
        imgUrl: '',
        description: '',
        ppn: '',
        type: 'no'
    });
};
