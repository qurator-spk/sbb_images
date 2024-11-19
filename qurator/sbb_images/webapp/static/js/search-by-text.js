function setup_search_by_text(configuration, update_search_results, global_push_state) {

    let that = null;

    let text_search_mode = null;
    let search_text = "";

    let search_pos = 0;

    let spinner_html =
        `
        <div class="col text-center">
                <div class="d-flex justify-content-center mt-5">
                    <div class="spinner-border align-center mt-5" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                 </div>
        </div>`;

    function find_similar(onSuccess, onError) {
        let request =
            {
                success: onSuccess,
                error: onError
            };

        if (text_search_mode === "desc") {
            request['url'] = "similar-by-text/"+ configuration.getActive() + "/" + search_pos + "/100";
            request['data'] = JSON.stringify({ "text" : $("#search-for").val() });
        }
        else if (text_search_mode === "filename") {
            request['url'] = "similar-by-filename/"+ configuration.getActive() + "/" + search_pos + "/100";
            request['data'] = JSON.stringify({ "pattern" : $("#search-for").val() });
        }
        else if (text_search_mode === "iconclass") {
            request['url'] = "similar-by-iconclass/"+ configuration.getActive() + "/" + search_pos + "/100";
            request['data'] = JSON.stringify({ "iconclass_label" : $("#search-for").val() });
        }
        else if (text_search_mode === "tag") {
            request['url'] = "similar-by-tag/"+ configuration.getActive() + "/" + search_pos + "/100";
            request['data'] = JSON.stringify({ "tag" : $("#search-for").val() });
        }

        request['type'] = "POST";
        request['contentType'] = "application/json";

        $.ajax(request);
    };

    function setupInterface() {
        if (configuration.acceptsText() && configuration.acceptsIconclass()) {
            let drop_down_html = `
                <a class="dropdown-item" id="search-select-filename"
                    data-toggle="tooltip"
                    title="Search for images solely based on their filename. Accepts wildcards. Search for *123* finds any file in the selected dataset that has 123 in its filename.">
                    Filename
                </a>
                <a class="dropdown-item" id="search-select-tag"
                    data-toggle="tooltip"
                    title="Search for images solely based on their handcrafted labels. For instance 46C2 finds any image in the selected dataset that has a handcrafted label with prefix 46C2.">
                    Tag
                </a>
                <a class="dropdown-item" id="search-select-description"
                    data-toggle="tooltip"
                    title="Search for images solely based on text-to-image similarity implemented by selected model. Does not use any handcrafted labels. Enter a textual description of your search.">
                    Description
                </a>
                <a class="dropdown-item" id="search-select-iconclass"
                    data-toggle="tooltip"
                    title="Search for images solely based on text-to-image similarity implemented by selected model. Does not use any handcrafted labels. Enter a valid iconclass-label to be automatically translated into a textual description for search.">
                    Iconclass
                </a>
            `;

            $("#search-dropdown").html(drop_down_html);

            $("#search-select-description").click(
                function() {
                    $("#search-select-button").html($(this).html());
                    that.setSearchMode("desc");

                    search();
                }
            );

            $("#search-select-filename").click(
                function() {
                    $("#search-select-button").html($(this).html());
                    that.setSearchMode("filename");

                    search();
                }
            );

            $("#search-select-iconclass").click(
                function() {
                    $("#search-select-button").html($(this).html());
                    that.setSearchMode("iconclass");

                    search();
                }
            );

            $("#search-select-tag").click(
                function() {
                    $("#search-select-button").html($(this).html());
                    that.setSearchMode("tag");

                    search();
                }
            );
        }
        else if (configuration.acceptsText()) {
            let drop_down_html = `
                <a class="dropdown-item" id="search-select-filename"
                    data-toggle="tooltip"
                    title="Search for images solely based on their filename. Accepts wildcards. Search for *123* finds any file in the selected dataset that has 123 in its filename.">
                    Filename
                </a>
                <a class="dropdown-item" id="search-select-tag"
                    data-toggle="tooltip"
                    title="Search for images solely based on their handcrafted labels. For instance 'XXX' finds any image in the selected dataset that has a handcrafted label with prefix 'XXX'.">
                    Tag
                </a>
                <a class="dropdown-item" id="search-select-description"
                    data-toggle="tooltip"
                    title="Search for images solely based on text-to-image similarity implemented by selected model. Does not use any handcrafted labels. Enter a textual description of your search.">
                    Description
                </a>
            `;

            $("#search-dropdown").html(drop_down_html);

            $("#search-select-description").click(
                function() {
                    $("#search-select-button").html($(this).html());
                    that.setSearchMode("desc");

                    search();
                }
            );

            $("#search-select-filename").click(
                function() {
                    $("#search-select-button").html($(this).html());
                    that.setSearchMode("filename");

                    search();
                }
            );

            $("#search-select-tag").click(
                function() {
                    $("#search-select-button").html($(this).html());
                    that.setSearchMode("tag");

                    search();
                }
            );
        }
        else {
            let drop_down_html = `
                <a class="dropdown-item" id="search-select-filename">Filename</a>
                <a class="dropdown-item" id="search-select-tag">Tag</a>
            `;

            $("#search-dropdown").html(drop_down_html);

            $("#search-select-tag").click(
                function() {
                    $("#search-select-button").html($(this).html());
                    that.setSearchMode("tag");

                    search();
                }
            );

            $("#search-select-filename").click(
                function() {
                    $("#search-select-button").html($(this).html());
                    that.setSearchMode("filename");

                    search();
                }
            );
        }
    }

    function update() {

        search_pos = 0;

        setupInterface();

        let active_html = "";

        if (text_search_mode == "desc") {
            active_html = $("#search-select-description").html();
        }
        else if (text_search_mode == "filename") {
            active_html = $("#search-select-filename").html();
        }
        else if (text_search_mode == "iconclass") {
            active_html = $("#search-select-iconclass").html();
        }
        else if (text_search_mode == "tag") {
            active_html = $("#search-select-tag").html();
        }

        if ($("#search-select-button").html() !== active_html) {
            $("#search-select-button").html(active_html);
        }

        $("#search-for").val(search_text);

        search();
    }

    that = {
        pushState:
            function(url_params, state) {

                if (    (!configuration.acceptsText())
                    && ((text_search_mode==="desc") || (text_search_mode==="iconclass"))) {

                    text_search_mode = "tag";

                    configuration.showWarning("Current model does not support search by description or iconclass. " +
                    "Disabled search modes 'by Description' and 'by Iconclass'.");
                }
                url_params.set('text_search_mode', text_search_mode);
                url_params.set('search_text', encodeURIComponent(search_text));

                state.text_search_mode = text_search_mode;
                state.search_text = search_text;
            },
        popState:
            function(event=null) {
                if (event !== null) {
                    if (event.state === null) return;

                    text_search_mode = event.state.text_search_mode;
                    search_text = event.state.search_text;
                }
                else {
                    let url_params = new URLSearchParams(window.location.search);

                    if (url_params.has('text_search_mode')) {
                        text_search_mode = url_params.get('text_search_mode');
                    }
                    else {
                        text_search_mode = "desc";
                    }

                    if (url_params.has('search_text')) {
                        search_text = decodeURIComponent(url_params.get('search_text'));
                    }
                    else {
                        search_text="";
                    }
                }
            },
        setSearchMode :
            function (text_search_mode_, new_state=true) {
                search_pos = 0;

                text_search_mode = text_search_mode_;

                if (new_state) global_push_state();
            },
        setSearchText :
            function (search_text_, new_state=true) {
                search_text = search_text_;

                if (new_state) global_push_state();
            },
        nextBatch:
            function() {
                search_pos += 100;
                search();
            },
        update: update
    };


    let search_counter=0;
    function search() {
        if (search_pos == 0) {
            $("#tag-controls").addClass("d-none");
            $('#search-results').html(spinner_html);

            batches = [ search_pos ];

            search_counter++;
        }
        else {
            if (batches.length > 0) {
                batches.push(search_pos);
                return;
            }
            batches.push(search_pos);
        }

        $("#search-text-info-group").addClass("d-none");
        $("#search-text-info-group").removeClass("alert");
        $("#search-text-info-group").removeClass("alert-danger");


        while (batches.length > 0)
        (function(counter_at_request, search_text_at_request, from_pos) {
            if (search_text_at_request === "") {
                $("#tag-controls").addClass("d-none");
                $('#search-results').html("");
                return;
            }

            find_similar(
                function(result) {

                    if (search_counter > counter_at_request) return;

                    update_search_results(result, from_pos==0);

                    that.setSearchText(search_text_at_request, search_text_at_request!==search_text);

                    if ("info" in result) {
                        $("#search-text-info-group").removeClass("d-none");
                        $("#search-text-info").html(result["info"]);
                    }
                    else {
                        $("#search-text-info-group").addClass("d-none");
                    }
                },
                function(error) {
                    $("#tag-controls").addClass("d-none");
                    $("#search-results").html("");
                    $("#search-text-info-group").removeClass("d-none");
                    $("#search-text-info-group").addClass("alert");
                    $("#search-text-info-group").addClass("alert-danger");

                    if (text_search_mode === "iconclass") {
                        $("#search-text-info").html("Invalid iconclass label.");
                    }
                    else {
                        $("#search-text-info").html(error);
                    }
                }
            );
        })(search_counter, $("#search-for").val(), batches.shift());
    }

    let search_timeout=null;

    $("#search-for").on("keyup",
        function(e) {

            if ($("#search-for").val() === search_text) return;

            if (search_timeout !== null) clearTimeout(search_timeout);

            search_timeout = setTimeout(
                function() {
                    search_pos = 0;
                    search();
                }, 750);
        }
    );

    that.popState();

    setupInterface();

    return that;
}
