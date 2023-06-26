(function() {

function makeAnnotator() {

    function postit(url, data, onSuccess, onError=null) {

        if (onError === null) {
            onError =
                function(error) {
                        console.log(error);
                };
        }

        $.ajax({
                url:  url,
                data: JSON.stringify(data),
                type: 'POST',
                contentType: "application/json",
                success: onSuccess,
                error: onError
            }
        );
    }

    let is_active=true; // Browser-Tab active or not
    let anno=null;
    let viewer=null;
    let zoom_anno=null;

    let access_manager=null;

    let last_read_time="";
    let write_permit_id="";
    let write_permit="";
    let renew_permit_timeout=null;
    let img_url = null;



    function add_annotation(annotation, onSuccess) {
        postit("add-annotation", { "annotation": annotation, "url" : img_url }, onSuccess);
    }

    function update_annotation(annotation, onSuccess) {
        postit("update-annotation",  { "annotation": annotation, 'write_permit': write_permit }, onSuccess);
    }

    function delete_annotation(anno_id, onSuccess) {
        postit("delete-annotation", { "anno_id": anno_id, 'write_permit': write_permit }, onSuccess);
    }

    function add_url(img_url, description, onSuccess) {
        postit ("add-url-pattern", { "url_pattern" : img_url, 'description': description }, onSuccess);
    }

    function change_url(img_url, description, onSuccess) {
        postit ("change-url-pattern", { "url_pattern" : img_url, 'description': description }, onSuccess);
    }

    function delete_url(img_url, onSuccess) {
        postit ("delete-url-pattern", { "url_pattern" : img_url}, onSuccess);
    }

     function clear_editor() {
        last_read_time="";

        if (anno != null) {
            anno.destroy();
            anno = null;

            $('#toolbar').html("");
        }

        if (viewer != null) {
            viewer.destroy();
            viewer = null;
            $("#zoom").html("");
        }

        $('#annotations-list').html("");

        $("#configuration").addClass("d-none");
        $("#data-export").addClass("d-none");
        $("#editor").addClass("d-none");
        $("#search-result-list-collapse").collapse('hide');
     }

    function annotation_setup(img_url) {
        $("#editor").removeClass("d-none");

        anno = OpenSeadragon.Annotorious(viewer,
        {
          locale: 'auto',
          allowEmpty: true,
          readyOnly: true,
          drawOnSingleClick: true
        });

        Annotorious.BetterPolygon(anno);

        if (access_manager.hasUser()) {
            Annotorious.Toolbar(anno, $('#toolbar')[0]);
        }

        anno.setDrawingTool("polygon");

        anno.on('createAnnotation',
            function(annotation, overrideId) {
                //console.log('createAnnotation',annotation);
                add_annotation(annotation,
                    function() {
                        update_annotation_list();
                    }
                );
                access_manager.restoreReadOnlyState();

                selectUser(access_manager.getUser());
            }
        );

        anno.on('deleteAnnotation',
            function(annotation) {
                //console.log('deleteAnnotation',annotation);
                delete_annotation(annotation['id'],
                    function() {
                        write_permit="";
                        write_permit_id="";

                        if (anno===null) return;

                        anno.removeAnnotation(annotation['id']);

                        $(`#anno-item-${annotation['id'].slice(1)}`).remove();
                    }
                );
                access_manager.restoreReadOnlyState();
            }
        );

        anno.on('updateAnnotation',
            function(annotation, previous) {
                //console.log('updateAnnotation',annotation, previous);
                update_annotation(annotation,
                    function() {
                        write_permit="";
                        write_permit_id="";
                        update_annotation_list();
                    }
                );
                access_manager.restoreReadOnlyState();
            }
        );

        anno.on('clickAnnotation',
            function(annotation, element) {
                //console.log('clickAnnotation',annotation);

                if (!("id" in annotation)) return;

                get_write_permit(annotation["id"]);
            }
        );

        /*anno.on('startSelection',
            function(e) {
                console.log('startSelection',e);
            }
        );*/

        anno.on('selectAnnotation',
            function(annotation, element) {
                if (!("id" in annotation)) return;

                get_write_permit(annotation["id"]);
                //console.log('selectAnnotation',annotation);
            }
        );

        anno.on('cancelSelected',
            function(selection) {
                //console.log('cancelSelected', selection);

                release_write_permit();

                refresh(selection);
            }
        );

        anno.on('mouseEnterAnnotation',
            function(annotation, element) {
                //console.log('mouseEnterAnnotation', annotation);
            }
        );

        anno.on('mouseLeaveAnnotation',
            function(annotation, element) {
                //console.log('mouseLeaveAnnotation', annotation);
            }
        );

        access_manager.determineReadOnlyState();

        let interval_update = null
        interval_update =
            function() {
                if (anno===null) return;

                if (is_active) update_annotation_list();

                if (anno===null) return;

                intervall_update = setTimeout(interval_update, 5000);
            };

        interval_update();

        update_annotation_list();
    }

    function refresh(selection) {

        if (selection === null) return;

        if (selection === undefined) return;

        let id = selection["id"];

        $(`[data-id="${id}"]`).addClass("d-none");
        (function(_id) {
            setTimeout(
                function() {
                    $(`[data-id="${_id}"]`).removeClass("d-none");
                }, 250);
        })(id);
    }


    function get_write_permit(anno_id) {

        if (anno_id === write_permit_id) return;
        if (write_permit !== "") release_write_permit();

        write_permit_id=anno_id;

        postit('get-write-permit', {'anno_id': anno_id, 'last_read_time': last_read_time },
            function(result) {
                write_permit = result['write_permit'];
                write_permit_id = result['write_permit_id'];

                (function (permit_state) {
                    let renew_permit = null
                    renew_permit =
                        function() {
                            if (write_permit != permit_state) return;

                            postit('renew-write-permit', {'write_permit': write_permit},
                                function() {
                                    renew_permit_timeout = setTimeout(renew_permit, 30000);
                                }
                            );
                        };

                    renew_permit_timeout = setTimeout(renew_permit, 30000);

                })(write_permit);
            },
            function(error) {
                anno.readOnly=true;
                write_permit_id="";

                //console.log("anno.readOnly", anno.readOnly, write_permit_id);
            }
        );
    }

    function release_write_permit() {

            //console.log("release_write_permit");

            access_manager.restoreReadOnlyState();

            if (write_permit === "") return;

            postit('release-write-permit', { 'write_permit': write_permit},
                function() {
                    //console.log("release-write-permit success");
                },
                function() {
                    //console.log("release-write-permit error");
                }
            );

            write_permit = "";
            write_permit_id = "";
        }

    function annotation_url_submit(new_state=true) {

        let url_params = new URLSearchParams(window.location.search);

        img_url = $("#annotation-url").val();

        if ((img_url !== url_params.get('image', "")) && (new_state)){
            url_params.set('image', encodeURIComponent(img_url));

            let url = window.location.href.split('?')[0]

            history.pushState({'img_url': img_url},  "", url + "?" + url_params.toString());
        }

        $("#search-result-list-collapse").collapse('hide');

        clear_editor();

        viewer = OpenSeadragon({
          id: "zoom",
          prefixUrl: "openseadragon/images/",
          tileSources: {
            type: "image",
            url: img_url,
          }
        });

        $("#image-view").attr("src", img_url);
    }

    function selectUser(user) {
        if ((anno !== null) && (anno.getSelected() !== undefined)){

            anno.cancelSelected();

            (function(user) {
            setTimeout(
                function(){
                    release_write_permit();

                    selectUser(user);
                }, 250);
            })(user);

            return;
        }
        else if ((anno === null) && (user !== "all")) {
            selectUser("all");
            return;
        }

        if (user === "all") {
            $("#selected-user").html("All users");

            $(".anno-item").removeClass("d-none");
            $(".a9s-annotation").addClass("d-none");
            $("#selected-user").attr("show_user", "all");

            setTimeout(
               function() {
                   $(".a9s-annotation").removeClass("d-none");
               }, 250
            );
            return;
        }

        $("#selected-user").html(user);
        $("#selected-user").attr("show_user", user);

        $(".anno-item").addClass("d-none");
        $(".a9s-annotation").addClass("d-none");

        (function(user) {
            setTimeout(
               function() {
                   $(`[user='${user}']`).removeClass("d-none");
               }, 250
            );
        })(user);
    }

    function update_annotation_list() {
        function render_list(result) {

            if (anno === null) return;

            (function(read_time, annotations_update) {

                last_read_time = read_time;

                $.each(annotations_update,
                    function(index, anno_info) {

                        let anno_id = anno_info['anno_id'].slice(1);

                        if (!('annotation' in anno_info)) {
                            anno.removeAnnotation(anno_info['anno_id']);

                            $(`#anno-item-${anno_id}`).remove();
                        }
                        else {
                            //console.log(anno_info['read_only']);
                            anno.addAnnotation(anno_info['annotation'], anno_info['read_only']);

                            (function(anno_id, user) {
                                setTimeout(
                                    function() {
                                        $(`[data-id="#${anno_id}"]`).attr("user", user);

                                        if (($("#selected-user").attr("show_user") !== "all") &&
                                            ($("#selected-user").attr("show_user") !== user)) {
                                            $(`[data-id="#${anno_id}"]`).addClass("d-none");
                                        }
                                    }, 250);
                            })(anno_id, anno_info["user"]);

                            if ($(`#anno-item-${anno_id}`).length > 0) return;

                            let annotation_html=`
                                <li class="list-group-item list-group-item-action text-left anno-item"
                                    id="anno-item-${anno_id}">
                                    <small>
                                    ID: <span class="mr-2">${anno_id}</span>
                                    <br>
                                    User: <span class="mr-2">${anno_info['user']}</span>
                                    </small>
                                </li>
                            `;

                            $('#annotations-list').append(annotation_html);

                            (function(_anno, _anno_id, anno_user, selection) {

                                $(`#anno-item-${_anno_id}`).on('click',
                                    function(e) {
                                        refresh(selection);

                                        anno.panTo("#" + _anno_id);

                                        setTimeout(
                                            function() {
                                                //console.log('_anno.selectAnnotation:' + anno_id);

                                                _anno.selectAnnotation("#" + _anno_id);

                                                get_write_permit("#" + _anno_id);
                                            }, 400);

                                        e.preventDefault();
                                    }
                                );

                                $(`#anno-item-${_anno_id}`).attr("user", anno_user);

                            })(anno, anno_id, anno_info["user"], anno.getSelected());

                            if (($("#selected-user").attr("show_user") !== "all") &&
                                ($("#selected-user").attr("show_user") !== anno_info["user"])) {
                                $(`#anno-item-${anno_id}`).addClass("d-none");
                            }

                            if ($(`#select-user-${anno_info["user"]}`).length > 0) return;

                            let select_user_html = `
                                 <a class="dropdown-item" id="select-user-${anno_info['user']}"
                                    data-toggle="tooltip" title="" data-original-title="">
                                    Select user ${anno_info["user"]}
                                </a>
                            `;

                            $("#user-select-dropdown").append(select_user_html);

                            (function(anno_info){
                                $(`#select-user-${anno_info['user']}`).click(
                                    function(e) {
                                        selectUser(anno_info['user']);

                                        e.preventDefault();
                                    }
                                );
                            })(anno_info);
                        }
                    }
                );


             })(result['read_time'], result['annotations']);
        }

        if (!access_manager.hasUser()) {
            if (anno === null) return;

            anno.clearAnnotations();
            last_read_time="";
            $('#annotations-list').html("");
        }
        else {
            let post_data =  { "url" : img_url };

            if (last_read_time.length > 0) post_data['last_read_time'] = last_read_time;

            postit("get-annotations", post_data, render_list);
        }
    }

    function showConfiguration() {
        $("#search-result-list-collapse").collapse('hide');
        $('#editor').addClass('d-none');
        $('#url-selection').addClass('d-none');
        $('#data-export').addClass('d-none');

        $('#configuration').removeClass('d-none');

        render_target_list();
    }

    function showDataExport() {
        $("#search-result-list-collapse").collapse('hide');
        $('#editor').addClass('d-none');
        $('#url-selection').addClass('d-none');
        $('#configuration').addClass('d-none');
        $('#data-export').removeClass('d-none');

        render_export_list();
    }

    function render_export_list() {
        postit("get-annotated-urls", {},
            function(results) {
                $('#export-url-list').html("");

                if (results.length==0) {
                    $('#export-url-list').html(`<li><span></span></li>`);
                    return;
                }

                let export_url_list_html="";

                $.each(results,
                    function(index, result) {

                        let user_badges_html=`<div class="d-flex">`;

                        $.each(result.users,
                            function(user_index, user) {
                                user_badges_html +=
                                    `<span class="d-flex badge badge-pill badge-light badge-primary">
                                         <span class="align-self-center"> ${user} </span>
                                         <input class="export-select align-self-center ml-2"
                                        type="checkbox" id="export-select-${index}-${user_index}"/>
                                     </span>`;
                            }
                        );

                        user_badges_html +="</div>";

                        let description_html = "";
                        if (result.description.length > 0) {
                            description_html = `<span class="align-self-center ml-3">[${result.description}] </span>`;
                        }


                        let item_html=`
                            <li class="d-flex list-group-item list-group-item-action text-left justify-content-between"
                                id="export-item-${index}">
                                <div>
                                <small>
                                <span class="align-self-center">${result.url}</span>
                                ${description_html}
                                </small>
                                </div>
                                ${user_badges_html}
                            </li>
                        `;

                        export_url_list_html += item_html;
                    }
                );

                $('#export-url-list').html(export_url_list_html);

                $.each(results,
                    function(index, result) {
                        $.each(result.users,
                            function(user_index, user) {
                                $(`#export-select-${index}-${user_index}`).data("url", result.url);
                                $(`#export-select-${index}-${user_index}`).data("user", user);
                            });
                    }
                );
            }
        );
    }

    function showEditor() {
        $('#url-selection').removeClass('d-none');

        if ($("#image-view").attr('src').length > 0)
            $('#editor').removeClass('d-none');

        $('#configuration').addClass('d-none');
        $('#data-export').addClass('d-none');

        //clear_editor();
        annotation_url_submit();
    }

    function render_target_list() {
        postit("get-url-patterns", {},
            function(results) {
                $('#url-list').html("");

                if (results.length==0) {
                    $('#url-list').html(`<li><span></span></li>`);
                    return;
                }

                let url_list_html="";
                let pattern_part=false;

                $.each(results,
                    function(index, result) {
                        let description_html="";
                        let font_modifier="";
                        let list_group_item_context="";

                        if (result.description.length > 0) {
                            description_html = `<span>[${result.description}]</span>`;
                        }

                        if ((pattern_part) && (!result.url_pattern.includes("*"))) {
                                 url_list_html += `<div class="dropdown-divider"></div>`;
                        }

                        pattern_part = result.url_pattern.includes("*");

                        if (pattern_part) {
                            font_modifier = "font-italic";
                            list_group_item_context = "list-group-item-dark";
                        }

                        let item_html=`
                            <li class="list-group-item list-group-item-action ${list_group_item_context} text-left" id="target-item-${index}">
                                <small>
                                <span class="mr-2 ${font_modifier}">${result.url_pattern}</span>
                                ${description_html}
                                </small>
                            </li>
                        `;

                        url_list_html += item_html;
                    }
                );

                $('#url-list').html(url_list_html);

                $.each(results,
                    function(index, result) {
                        $("#target-item-"+ index).click(
                            function() {
                                $("#conf-url").val(result.url_pattern);
                                $("#conf-description").val(result.description);

                                $("#add-url").prop('disabled', true);
                                $("#change-url").prop('disabled', false);
                                $("#delete-url").prop('disabled', false);
                            }
                        );
                    }
                );
            }
        );
    }

    function AccessManager() {
        let read_only_state=true;

        let basic_auth = BasicAuth('#auth-area');

        (function(enable_login, enable_logout) {

        basic_auth.enable_logout =
            function() {

                let logout_html=`
                    <div class="alert alert-success mb-3">
                        <span class="mr-1"> [${basic_auth.user()}] </span>
                        <div class="btn-group">
                          <button type="button" class="btn btn-sm btn-secondary" id="logout">Logout</button>
                          <button type="button" class="btn btn-sm btn-secondary dropdown-toggle dropdown-toggle-split"
                                data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            <!--<span class="sr-only">Toggle Dropdown</span>-->
                          </button>
                          <div class="dropdown-menu text-left">
                            <button class="dropdown-item" id="configure-dropdown">Configure</button>
                            <button class="dropdown-item" id="data-export-dropdown">Data Export</button>
                          </div>
                        </div>
                    </div>
                    `;

                $.get("isadmin")
                    .done(
                        function(result) {
                            if (result.isadmin) {
                                enable_logout(logout_html);

                                $('#configure-dropdown').click(showConfiguration);
                                $('#data-export-dropdown').click(showDataExport);
                            }
                            else enable_logout();
                        });

                if (anno === null) return;

                anno.setAuthInfo({
                    id: basic_auth.getUser(),
                    displayName: basic_auth.getUser()
                });

                Annotorious.Toolbar(anno, $('#toolbar')[0]);

                determine_read_only_state();
                update_annotation_list();
            }

        basic_auth.enable_login =
            function() {
                enable_login();

                $("#action").val("annotate");
                $("#add-action").prop("disabled", true);

                if (anno === null) return;

                anno.clearAuthInfo();

                $('#toolbar').html("");

                determine_read_only_state();
                update_annotation_list();
            };

        })(basic_auth.enable_login, basic_auth.enable_logout);

        function determine_read_only_state() {
            if (anno === null) return;

            read_only_state = true;

            if (basic_auth.getUser() != null) {
                anno.setAuthInfo({
                  id: basic_auth.getUser(),
                  displayName: basic_auth.getUser()
                });

                read_only_state=false;
            }

            anno.readOnly=read_only_state;
        }

        let that =
        {
            hasUser: function() {  return (basic_auth.getUser() != null) },

            determineReadOnlyState: determine_read_only_state,

            restoreReadOnlyState:
                function() {
                    anno.readOnly = read_only_state;
                },
            getUser: function() { return basic_auth.getUser(); }
        };

        basic_auth.getUser();

        return that;
    }

    let search_url = "";

    function update_suggestions(success) {

        if ($("#annotation-url").val() === search_url) return;

        search_url = $("#annotation-url").val();

        if (search_url.includes("*")) {
            $('#edit-button').prop('disabled', true);
        }

        (function(last_search_url) {
            postit('suggestions', {'url': search_url},
                function(suggestions) {

                    if (last_search_url !== search_url) return;

                    let suggestions_html="";
                    let pattern_part=false;

                    $.each(suggestions,
                       function(index, item){

                            let description_html="";
                            let font_modifier="";
                            let list_group_item_context="";

                            if ((pattern_part) && (!item.url_pattern.includes("*"))) {
                                 suggestions_html += `<div class="dropdown-divider"></div>`;
                            }

                            pattern_part = item.url_pattern.includes("*");

                            if (pattern_part) {
                                font_modifier = "font-italic";
                                list_group_item_context = "list-group-item-dark";
                            }

                            if (item.description.length > 0)
                                description_html = `
                                    <span class=""> [ ${item.description} ]</span>
                                `;

                            suggestions_html += `
                                <li class="list-group-item list-group-item-action ${list_group_item_context}" id="search-result-${index}">
                                    <small>
                                    <span class="mr-2 ${font_modifier}"> ${item.url_pattern} </span> ${description_html}
                                    </small>
                                </li>`;
                        });

                    if (last_search_url != search_url) return;

                    $('#search-result-list').html(suggestions_html);
                    $('#editor').addClass("d-none");

                    $.each(suggestions,
                        function(index, item) {
                            $("#search-result-"+ index).click(
                                function() {
                                    search_url = item.url_pattern;

                                    $("#annotation-url").val(item.url_pattern);
                                    $('#search-result-list').html("");

                                    if (item.url_pattern.includes("*")) {
                                        $('#edit-button').prop('disabled', true);
                                        clear_editor();
                                        return;
                                    }

                                    postit('match-url', {'url': $("#annotation-url").val()},
                                        function() {

                                            if ($("#annotation-url").val().includes("*")) {
                                                $('#edit-button').prop('disabled', true);
                                                return;
                                            }

                                            $('#edit-button').prop('disabled', false);
                                            annotation_url_submit();
                                        },
                                        function() {
                                            $('#edit-button').prop('disabled', true);
                                        }
                                    );
                                }
                            );
                        }
                    );

                    $("#search-result-list-collapse").collapse('show');
                    //console.log(suggestions);

                    success();
                }
            );
        })(search_url);
    }

    let suggestion_timeout=null;

    function init() {
        $("#annotation-url").on('input',
            function() {
                $("#search-result-list-collapse").collapse('hide');

                postit('match-url', {'url': $("#annotation-url").val()},
                    function() {
                        if ($("#annotation-url").val().includes("*")) {
                            $('#edit-button').prop('disabled', true);
                            return;
                        }

                        $('#edit-button').prop('disabled', false);
                    },
                    function() {
                        $('#edit-button').prop('disabled', true);
                    }
                );

                if (suggestion_timeout !== null) clearTimeout(suggestion_timeout);

                suggestion_timeout = setTimeout(
                    function() {
                        update_suggestions(function(){});
                    }, 500);
            }
        );

        $("#search-result-list-collapse").collapse();

        $("#annotation-url").click(
            function() {
                $("#search-result-list-collapse").collapse('toggle');
            }
        );

        $("#edit-form").submit(
            function(evt) {
                evt.preventDefault();
                annotation_url_submit();
            }
        );

        $("#configure-form").submit(
            function(evt) {
                evt.preventDefault();
            }
        );

        access_manager = AccessManager();

        $("#image-view").on("load",
            function() {
                if (!access_manager.hasUser()) return;

                postit('match-url', {'url': $("#image-view").attr('src')},
                    function() {
                        annotation_setup($("#image-view").attr('src'));
                    }
                );
            }
        );

        $("#image-view").on("error",
            function(evt) {
                clear_editor();
            }
        );

        $("#select-all-users").click(
            function(e) {

                selectUser("all");

                e.preventDefault();
            }
        );

        $(".back-to-editor").click(showEditor);

        $("#add-url").click(
            function() {
                let url = $("#conf-url").val();
                let description = $("#conf-description").val();

                if (url.length < 5) return;

                add_url(url, description,
                    function() {
                        render_target_list();

                        $("#conf-url").val("");
                        $("#conf-description").val("");

                        $("#add-url").prop('disabled', true);
                        $("#change-url").prop('disabled', true);
                        $("#delete-url").prop('disabled', true);
                    }
                );
            }
        );

        $("#change-url").click(
            function() {
                let url = $("#conf-url").val();
                let description = $("#conf-description").val();

                if (url.length < 7) return;

                change_url(url, description,
                    function() {
                        render_target_list();

                        $("#conf-url").val("");
                        $("#conf-description").val("");

                        $("#add-url").prop('disabled', true);
                        $("#change-url").prop('disabled', true);
                        $("#delete-url").prop('disabled', true);
                    }
                );
            }
        );

        $("#delete-url").click(
            function() {
                let url = $("#conf-url").val();
                let description = $("#conf-description").val();

                delete_url(url,
                    function() {
                        render_target_list();

                        $("#conf-url").val("");
                        $("#conf-description").val("");

                        $("#add-url").prop('disabled', true);
                        $("#change-url").prop('disabled', true);
                        $("#delete-url").prop('disabled', true);
                    }
                );
            }
        );

        $("#conf-url").on('input',
           function() {
               postit('has-url-pattern', {'url_pattern': $("#conf-url").val()},
                   function() {
                       $("#add-url").prop('disabled', true);
                       $("#change-url").prop('disabled', false);
                       $("#delete-url").prop('disabled', false);
                   },
                   function() {
                       $("#add-url").prop('disabled', false);
                       $("#change-url").prop('disabled', true);
                       $("#delete-url").prop('disabled', true);
                   }
               );
           }
        );

        function get_export_selection() {
            selected_urls = {};

            $('.export-select:checkbox:checked').each(
                function() {
                    let url = $(this).data("url");
                    let user = $(this).data("user");

                    if (!(url in selected_urls)) {
                        selected_urls[url] = [];
                    }

                    selected_urls[url].push(user);
                });

            return selected_urls;
        }


        $("#json-export").click(
           function() {

               selected_urls = get_export_selection();

               postit('data-export',{'export_type': 'json', 'selection': selected_urls},
                   function(result) {
                       openSaveFileDialog(
                           JSON.stringify(result['data'], null, 2), result['filename'], 'text/plain');
                   }
               );
           }
        );

        $("#xml-export").click(
           function() {
               selected_urls = get_export_selection();

               postit('data-export',{'export_type': 'xml', 'selection': selected_urls},
                   function(response, status, xhr) {
                       content_disp = xhr.getResponseHeader('Content-Disposition');
                       openSaveFileDialog(response, content_disp.match(/.*filename=(.*)$/)[1]);
                   }
               );
           }
        );

        $("#sql-export").click(
           function() {
               selected_urls = get_export_selection();

               postit('data-export',{'export_type': 'sqlite', 'selection': selected_urls},
                   function(response, status, xhr) {
                       content_disp = xhr.getResponseHeader('Content-Disposition');
                       openSaveFileDialog(response, content_disp.match(/.*filename=(.*)$/)[1]);
                   }
               );
           }
        );

        $("#export-select-all").click(
           function() {
              $(".export-select").prop("checked", true);
           }
        );

        $("#export-select-none").click(
           function() {
              $(".export-select").prop("checked", false);
           }
        );

        let url_params = new URLSearchParams(window.location.search);

        if (url_params.has('image')) {
            postit('match-url', {'url': decodeURIComponent(url_params.get('image'))},
                function() {
                    $("#annotation-url").val(decodeURIComponent(url_params.get('image')));

                    annotation_url_submit();
                });
        }

        window.addEventListener('popstate',
            function(event) {

                postit('match-url', {'url': decodeURIComponent(url_params.get('image'))},
                    function() {
                        $("#annotation-url").val(event.state.img_url);

                        annotation_url_submit(false);
                    });
            }
        );
    }

    function openSaveFileDialog (data, filename, mimetype) {

        if (!data) return;

        let blob = data.constructor !== Blob
          ? new Blob([data], {type: mimetype || 'application/octet-stream'})
          : data ;

        if (navigator.msSaveBlob) {
          navigator.msSaveBlob(blob, filename);
          return;
        }

        let lnk = document.createElement('a'),
            url = window.URL,
            objectURL;

        if (mimetype) {
          lnk.type = mimetype;
        }

        lnk.download = filename || 'untitled';
        lnk.href = objectURL = url.createObjectURL(blob);
        lnk.dispatchEvent(new MouseEvent('click'));
        setTimeout(url.revokeObjectURL.bind(url, objectURL));
    }

    let that =
        {
            init: function() { init(); },

            setActive:
                function (active) {
                    is_active = active;
                }
        };

    return that;
}

$(document).ready(
    function() {

        let annotator = makeAnnotator();

        annotator.init();

        $(window).focus(
            function() {
                annotator.setActive(true);
            }
        );

        $(window).blur(
            function() {
                annotator.setActive(false);
            }
        );
    }
);

})();