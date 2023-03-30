function setup_search_by_text(configuration, update_search_results, global_push_state) {

    let that = null;

    let text_search_mode = null;
    let search_text = "";

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

        if ($("#search-for").val() !== search_text) {
            $("search-for").val(search_text);
        }
    }

    that = {
        pushState:
            function(url_params, state) {

                url_params.set('text_search_mode', text_search_mode);
                url_params.set('search_text', search_text);


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
                        search_text = url_params.get('search_text');
                    }
                    else {
                        text_search_mode = "desc";
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

    function search() {
        if ($("#search-for").val() === search_text) return;

        search_text = $("#search-for").val();

        console.log(search_text);
    }

    let search_timeout=null;

    $("#search-for").on("keyup",
        function(e) {

            if (search_timeout !== null) clearTimeout(search_timeout);

            search_timeout = setTimeout(
                function() {
                    search();
                }, 500);
        }
    );

    that.popState();

    return that;
}
