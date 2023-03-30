function setup_search_collapse (configuration, configuration_updated, save_state) {

    let that = null;

    let search_mode = null;

    let collapse_triggered_by_update=false;
    let collapse_state="undefined";

    function update() {

        if (collapse_state === search_mode) return;

        collapse_state = search_mode;

        collapse_triggered_by_update=true; // prevents error during popstate

        if (search_mode === "image") {
            if (configuration.acceptsText()) {
                $("#description-card").removeClass("d-none");

            }
            else {
                $("#description-card").addClass("d-none");
            }

            $("#imgCollapse").collapse("show");
            $("#descCollapse").collapse("hide");
        }
        else if (search_mode === "text") {

            if (configuration.acceptsText()) {
                $("#description-card").removeClass("d-none");

                $("#descCollapse").collapse("show");
                $("#imgCollapse").collapse("hide");

            }
            else {
                $("#description-card").addClass("d-none");

                $("#imgCollapse").collapse("show");
                $("#descCollapse").collapse("hide");
            }
        }
    }

    that = {
        pushState:
            function(url_params, state) {

                url_params.set('search_mode', search_mode);

                state.search_mode = search_mode;
            },
        popState:
            function update(event=null) {

                if ((event !== null) && (event.state !== null)) {
                    search_mode = event.state.search_mode;
                }
                else {
                    let url_params = new URLSearchParams(window.location.search);

                    if (url_params.has('search_mode')) {
                        search_mode = url_params.get('search_mode');
                    }
                    else {
                        search_mode = "image";
                    }
                }
            },
        setSearchMode :
            function (search_mode_, new_state=true) {
                search_mode = search_mode_;

                if (new_state) save_state();
            },
        getSearchMode : function() { return search_mode; },
        update: update
    };


    $("#imgCollapse").on("shown.bs.collapse",
        function() {
            if (search_mode === "image") return;

            that.setSearchMode("image", !collapse_triggered_by_update);

            $("#search-results").html("");
            configuration_updated();

            collapse_triggered_by_update=false; // prevents error during popstate
        });

    $("#descCollapse").on("shown.bs.collapse",
        function() {
            if (search_mode === "text") return;

            that.setSearchMode("text", !collapse_triggered_by_update);

            $("#search-results").html("");

            configuration_updated();

            collapse_triggered_by_update=false; // prevents error during popstate
        });

    that.popState();

    return that;
}

function search_setup (gconf){

    let configuration = null;
    let search_collapse = null;
    let search_by_image = null;
    let search_by_text = null;
    let search_result_list = null;


    function global_push_state() {
        let url_params = new URLSearchParams(window.location.search);
        let url = window.location.href.split('?')[0];

        let state = { };
        configuration.pushState(url_params, state);
        search_collapse.pushState(url_params, state);

        search_by_image.pushState(url_params, state);
        search_by_text.pushState(url_params, state);

        history.pushState(state,  "",url + "?" + url_params.toString());
    };

    function image_search(search_id, search_id_from) {
        search_by_image.setSearchId(search_id, search_id_from);
        search_by_image.update();
    }

    function update_search_results(ids) {
        search_result_list.update(ids);

        $('[data-toggle="tooltip"]').tooltip();
    }

    function configuration_updated() {

        configuration.update();
        search_collapse.update();

        if (search_collapse.getSearchMode() === "image") {
            search_by_image.update();
        }
        else if (search_collapse.getSearchMode() === "text") {
            search_by_text.update();
        }
    }

    configuration = setup_configuration(gconf, configuration_updated, global_push_state);

    search_collapse = setup_search_collapse(configuration, configuration_updated, global_push_state);

    search_result_list = setup_search_result_list(configuration, image_search);

    search_by_image = setup_search_by_image(configuration, update_search_results, global_push_state);

    search_by_text = setup_search_by_text(configuration, update_search_results, global_push_state);

    window.addEventListener('popstate',
            function(event) {
                //console.log(event);
                configuration.popState(event);
                search_collapse.popState(event);
                search_by_image.popState(event);
                search_by_text.popState(event);

                configuration_updated();
            }
        );

    configuration_updated();
}

$(document).ready(
    function() {
        $.get("configuration").done(search_setup);
     });