import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { makeSearchState } from "../components/SearchState";

const SearchFor = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const img_id = params.get('img_id');
        const description = params.get('description');
        const ppn = params.get('ppn');

        let state = null;

        if (img_id != null) {
            state = makeSearchState().setImgUrlWithID("", img_id);
        }
        else if (description != null) {
            state = makeSearchState().setDescription(description);
        }
        else if (ppn != null) {
            state = makeSearchState().setPPN(ppn);
        }

        if (state != null) {
            navigate("/search-results", {
                state: {
                    searchState: state.serialized,
                }
              });
        }
    },[]);
}

export default SearchFor;