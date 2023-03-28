function search_setup (gconf){

    let configuration = null;
    let search_by_image = null;
    let search_result_list = null;

    function save_state() {
        let url_params = new URLSearchParams(window.location.search);
        let url = window.location.href.split('?')[0];

        let state = { };
        configuration.saveState(url_params, state);
        search_by_image.saveState(url_params, state);

        history.pushState(state,  "",url + "?" + url_params.toString());
    };

    function search(search_id, search_id_from) {
        search_by_image.setSearchId(search_id, search_id_from);
        search_by_image.update();
    }

    function update_search_results(ids) {
        search_result_list.update(ids);

        $('[data-toggle="tooltip"]').tooltip();
    }

    function configuration_updated() {
        search_by_image.update();
    }

    configuration = setup_configuration(gconf, configuration_updated, save_state);

    search_result_list = setup_search_result_list(configuration, search);

    search_by_image = setup_search_by_image(configuration, update_search_results, save_state);

    window.addEventListener('popstate',
            function(event) {
                configuration.update(event);
                search_by_image.update(event);
            }
        );

    search_by_image.update();
}

$(document).ready(
    function() {
        $.get("configuration").done(search_setup);
     });