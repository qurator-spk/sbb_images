function setup_search_by_text(configuration, update_search_results, global_push_state) {

    let that = null;

    let text_search_mode = null;
    let search_text = "";

    function find_similar(onSuccess, onError) {
        let request =
            {
                success: onSuccess,
                error: onError
            };

        if (text_search_mode === "desc") {
            request['url'] = "similar-by-text/"+ configuration.getActive();
            request['data'] = JSON.stringify({ "text" : $("#search-for").val() });
        }
        else if (text_search_mode === "filename") {
            request['url'] = "similar-by-filename/"+ configuration.getActive();
            request['data'] = JSON.stringify({ "filename" : $("#search-for").val() });
        }
        else if (text_search_mode === "iconclass") {
            request['url'] = "similar-by-iconclass/"+ configuration.getActive();
            request['data'] = JSON.stringify({ "iconclass_label" : $("#search-for").val() });
        }
        else if (text_search_mode === "tag") {
            request['url'] = "similar-by-tag/"+ configuration.getActive();
            request['data'] = JSON.stringify({ "tag" : $("#search-for").val() });
        }

        request['type'] = "POST";
        request['contentType'] = "application/json";

        $.ajax(request);
    };

    function update() {
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
                text_search_mode = text_search_mode_;

                if (new_state) global_push_state();
            },
        setSearchText :
            function (search_text_, new_state=true) {
                search_text = search_text_;

                if (new_state) global_push_state();
            },

        update: update
    };


    $("#search-select-description").click(
        function() {
            $("#search-select-button").html($(this).html());
            that.setSearchMode("desc");
        }
    );

    $("#search-select-filename").click(
        function() {
            $("#search-select-button").html($(this).html());
            that.setSearchMode("filename");
        }
    );

    $("#search-select-iconclass").click(
        function() {
            $("#search-select-button").html($(this).html());
            that.setSearchMode("iconclass");
        }
    );

    $("#search-select-tag").click(
        function() {
            $("#search-select-button").html($(this).html());
            that.setSearchMode("tag");
        }
    );

    let update_counter=0;
    function search() {
        $('#search-results').html("");
        $("#search-text-info-group").addClass("d-none");
        $("#search-text-info-group").removeClass("alert");
        $("#search-text-info-group").removeClass("alert-danger");

        update_counter++;

        (function(counter_at_request, search_text_at_request) {
            if (search_text_at_request === "") return;

            find_similar(
                function(result) {
                    if (update_counter > counter_at_request) return;

                    update_search_results(result);

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
                    $("#search-text-info-group").removeClass("d-none");
                    $("#search-text-info-group").addClass("alert");
                    $("#search-text-info-group").addClass("alert-danger");
                    $("#search-text-info").html("Invalid iconclass label.");
                }
            );
        })(update_counter, $("#search-for").val());
    }

    let search_timeout=null;

    $("#search-for").on("keyup",
        function(e) {

            if (search_timeout !== null) clearTimeout(search_timeout);

            search_timeout = setTimeout(
                function() {
                    search();
                }, 750);
        }
    );

    that.popState();

    return that;
}
