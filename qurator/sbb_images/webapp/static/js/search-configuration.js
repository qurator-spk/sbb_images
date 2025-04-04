function setup_configuration(gconf, configuration_updated, global_push_state) {
    let that = {};

    let conf_map = {};
    let model_map = {};
    let active_conf = null;
    let default_model_conf ={};
    let datasets = new Set();

    let default_data_conf = null;
    let showSettings=false;

    $.each(gconf["CONFIGURATION"],
        function(conf_name, conf) {
            conf_map[[conf["DATA_CONF"], conf["MODEL_CONF"]]] = conf_name;
            model_map[conf["DATA_CONF"]] = [];
            datasets.add(conf["DATA_CONF"])

            if ((default_data_conf === null) ||
                (("DEFAULT" in conf) && (conf['DEFAULT']))) {
                default_data_conf = conf["DATA_CONF"];
            }
        }
    );

    $.each(gconf["CONFIGURATION"],
        function(conf_name, conf) {
            model_map[conf["DATA_CONF"]].push(conf["MODEL_CONF"]);

            if ((conf['DEFAULT']) || !(conf["DATA_CONF"] in default_model_conf)) {
                default_model_conf[conf["DATA_CONF"]] = conf["MODEL_CONF"];
            }
        }
    );

    let dataset_select_html="";

    if ("__MENU__" in gconf["DATA_CONFIGURATION"]) {
        gconf["DATA_CONFIGURATION"]["__MENU__"].forEach(
            function(data_conf) {
                try {
                    let friendly_name = gconf["DATA_CONFIGURATION"][data_conf]["FRIENDLY_NAME"];

                    dataset_select_html += `<option value="${data_conf}"> ${friendly_name} </option>`;
                }
                catch {
                    console.log("Error processing data_conf: " + data_conf);
                }
            }
        );
     }
     else {
        datasets.forEach(
            function(data_conf) {
                try {
                    let friendly_name = gconf["DATA_CONFIGURATION"][data_conf]["FRIENDLY_NAME"];

                    dataset_select_html += `<option value="${data_conf}"> ${friendly_name} </option>`;
                }
                catch {
                    console.log("Error processing data_conf: " + data_conf);
                }
            }
        );
    }

    $("#dataset-select").html(dataset_select_html);

    function updateModelSelect() {
        let data_conf = gconf["CONFIGURATION"][active_conf]["DATA_CONF"];
        let model_conf = gconf["CONFIGURATION"][active_conf]["MODEL_CONF"];

        let model_select_html = "";

        $.each(model_map[data_conf],
            function(index, model_conf) {
                let friendly_name = gconf["MODEL_CONFIGURATION"][model_conf]["FRIENDLY_NAME"];

                model_select_html += `<option value="${model_conf}"> ${friendly_name} </option>`;
            }
        );

        $("#model-select").html(model_select_html);

        $("#dataset-select").val(gconf["CONFIGURATION"][active_conf]["DATA_CONF"]);
        $("#model-select").val(gconf["CONFIGURATION"][active_conf]["MODEL_CONF"]);

        $("#dataset-description").html(gconf["DATA_CONFIGURATION"][data_conf]["DESCRIPTION"]);
        $("#model-description").html(gconf["MODEL_CONFIGURATION"][model_conf]["DESCRIPTION"]);
    }

    $("#dataset-select").on('change',
        function(event) {
            let data_conf = event.target.value;

            let prev_data_conf = gconf["CONFIGURATION"][active_conf]["DATA_CONF"];

            if (prev_data_conf === data_conf) return;

            let model_conf = $("#model-select")[0].value;

            if (!([data_conf, model_conf] in conf_map)) {

                model_conf = default_model_conf[data_conf]

                showWarning("Model " +  $("#model-select")[0].value + " not available for dataset "  + data_conf + ". " +
                    "Switch to model " + model_conf + ".");
            }

            that.setActiveConf(conf_map[[data_conf, model_conf]]);

            configuration_updated();
        }
    );

    $("#model-select").on('change',
        function(event) {
            let model_conf = event.target.value;
            let data_conf = gconf["CONFIGURATION"][active_conf]["DATA_CONF"];

            that.setActiveConf(conf_map[[data_conf, model_conf]]);

            configuration_updated();
        }
    );

    $("#settingsCollapse").on('hidden.bs.collapse',
        function(e) {
            showSettings=false;
            let url = new URL(window.location);
            url.searchParams.set("showSettings", showSettings);
            history.pushState(null, '', url);
        }
    );
//
    $("#settingsCollapse").on('show.bs.collapse',
        function(e) {
            showSettings=true;
            let url = new URL(window.location);
            url.searchParams.set("showSettings", showSettings);
            history.pushState(null, '', url);
        }
    );

    function showWarning(msg) {
        $("#settings-info-group").removeClass("d-none");
        $("#settings-info").addClass("alert");
        $("#settings-info").addClass("alert-danger");
        $("#settings-info").html(msg);
    }

    function clearWarning() {
        $("#settings-info-group").addClass("d-none");
        $("#settings-info").removeClass("alert");
        $("#settings-info").removeClass("alert-danger");
        $("#settings-info").html("");
    }

    that = {
        pushState:
            function(url_params, state) {
                let data_conf = gconf["CONFIGURATION"][active_conf]["DATA_CONF"];
                let model_conf = gconf["CONFIGURATION"][active_conf]["MODEL_CONF"];

                url_params.set("data_conf", data_conf);
                url_params.set("model_conf", model_conf);
                url_params.set("showSettings", showSettings);

                state.active_conf = active_conf;
            },
        popState:
            function (event=null) {
                if (event !== null) {
                    if (event.state == null) return;
                    if (!("active_conf" in event.state)) return;

                    that.setActiveConf(event.state.active_conf, false);
                }
                else {
                    let url_params = new URLSearchParams(window.location.search);

                    if ((url_params.has("data_conf")) && (url_params.has("model_conf"))) {
                        active_conf = conf_map[[url_params.get("data_conf") , url_params.get("model_conf")]];
                    }
                    else {
                        active_conf = conf_map[[default_data_conf, default_model_conf[default_data_conf]]];
                    }

                    if (url_params.has("showSettings")) {
                        showSettings=(url_params.get("showSettings") == "true");

                        $("#settingsCollapse").collapse({"toggle": showSettings,
                                                        "parent": $("#settings-accordion")});
                    }
                }
            },

        setActiveConf:
            function(conf, new_state=true) {
                that.clearWarning();

                active_conf = conf;

                updateModelSelect();

                if (new_state) global_push_state();
            },
        getActive:
            function() { return active_conf },
        getDataConf:
            function() { return gconf["CONFIGURATION"][active_conf]["DATA_CONF"]; },
        getModelConf:
            function() { return gconf["CONFIGURATION"][active_conf]["MODEL_CONF"]; },
        acceptsText:
            function() {
                return gconf["MODEL_CONFIGURATION"][that.getModelConf()]["ACCEPTS_TEXT"];
            },
        acceptsIconclass:
            function() {
                return gconf["MODEL_CONFIGURATION"][that.getModelConf()]["ACCEPTS_ICONCLASS"];
            },
        update: updateModelSelect,

        showWarning : showWarning,

        clearWarning : clearWarning
    };

    that.popState();

    return that;
};