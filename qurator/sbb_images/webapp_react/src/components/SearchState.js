

const loadNextBatchSearchSimilar = async (pos, imageId, cropCoordinates) => {

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

export const sanitizePPN = (ppn) => {
    if (ppn.startsWith("ppn") || ppn.startsWith("PPN") || ppn.startsWith("pPn") || ppn.startsWith("Ppn") || ppn.startsWith("pPN")) return ppn.substring(3);
    else return ppn;
}

const loadNextBatchPPN = async (pos, ppn) => {
    try {
      const response = await fetch("api/ppn/DIGISAM/PPN" + sanitizePPN(ppn) +"/"+ pos + "/100");

      if (!response.ok) {
        throw new Error();
      }
      const result = await response.json();
      result.type = 'ppn';
      result.ppn = ppn;

      //if (!result.ids || result.ids.length === 0) {
      //  throw new Error();
      //}

      return result;
    }
    catch {
      throw Error("The PPN you entered does not exist in our collection or is not a PPN. Check your input and try again.");
    }
};

const loadNextBatchSearchImage = async (pos, imgUrl, cropCoordinates) => {

    const hasCrop = cropCoordinates.x !== -1;

    const { x, y, width, height } = hasCrop ? cropCoordinates : { x: -1, y: -1, width: -1, height: -1 };

    let response=null;

    if (imgUrl) {
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

export const makeSearchState = (state=null) => {

    let setImgUrlWithID = null;
    let setImgUrlWithFormData = null;
    let setDescription = null;
    let setPPN = null;

    let loadNextBatch = async (pos) => {
        console.log("loadNextBatch dummy!!!: ", pos);

        return { type: 'no', ids: []};
    };

    const add_functions = (state) => {
        state['serialized'] = { ...state};

        state['setImgUrlWithID'] = setImgUrlWithID;
        state['setImgUrlWithFormData'] = setImgUrlWithFormData;
        state['setDescription'] = setDescription;
        state['setPPN'] = setPPN;
        state['loadNextBatch'] = loadNextBatch;

        console.log("Link: ", state.link);

        return state;
    }

    setImgUrlWithID = (imgUrl, img_id) => {

        loadNextBatch =
        (pos, cropCoordinates) => {
            return loadNextBatchSearchSimilar(pos, img_id, cropCoordinates);
        };

        return add_functions({
            imgUrl : imgUrl,
            img_id : img_id,
            description : '',
            ppn : '',
            type: 'image',
            link: window.location.protocol + "//" + window.location.host + "/searchfor?img_id=" + encodeURIComponent(img_id)
        });
    },

    setImgUrlWithFormData = (imgUrl) => {

        loadNextBatch =
        (pos, cropCoordinates) => {
            return loadNextBatchSearchImage(pos, imgUrl, cropCoordinates);
        };

        return add_functions({
            imgUrl : imgUrl,
            description : '',
            ppn : '',
            type: 'image',
            link: ''
        });
    },

    setDescription = (description) => {

        loadNextBatch =
        (pos, cropCoordinates) => {
            return loadNextBatchDescription(pos, description);
        };

        return add_functions({
            description : description,
            ppn : '',
            type: 'description',
            link: window.location.protocol + "//" + window.location.host + "/searchfor?description=" + encodeURIComponent(description)
        });
    },

    setPPN = (ppn) => {

        loadNextBatch =
        (pos, cropCoordinates) => {
            return loadNextBatchPPN(pos, ppn);
        };

        return add_functions({
            ppn : ppn,
            description : '',
            type: 'ppn',
            link: window.location.protocol + "//" + window.location.host + "/searchfor?ppn=" + encodeURIComponent(ppn)
        });
    }

    if (state) {
        if (('imgUrl' in state) && ('img_id' in state)) {
            return setImgUrlWithID(state.imgUrl, state.img_id);
        }
        else if ('imgUrl' in state) {

            return setImgUrlWithFormData(state.imgUrl);
        }
        else if (('description' in state) && (state.description.length > 0)) {
            return setDescription(state.description);
        }
        else if (('ppn' in state) && (state.ppn.length > 0)) {
            return setPPN(state.ppn);
        }
    }

    return add_functions({
        description: '',
        ppn: '',
        type: 'no'
    });
};
