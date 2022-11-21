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

    let access_manager=null;

    let last_read_time="";
    let write_permit_id="";
    let write_permit="";
    let renew_permit_timeout=null;

    function add_annotation(annotation, onSuccess) {
        postit("add-annotation", { "annotation": annotation, "url" : $("#image-view").attr("src") }, onSuccess);
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

        $("#configuration").addClass("d-none");
        $("#data-export").addClass("d-none");
        $("#editor").addClass("d-none");
        $("#search-result-list-collapse").collapse('hide');
     }

    function annotation_setup(img_url) {
        clear_editor();

        $("#editor").removeClass("d-none");

        anno = Annotorious.init({
          image: 'image-view',
          locale: 'auto',
          allowEmpty: true,
          readyOnly: true
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
                get_write_permit(annotation);
            }
        );

        anno.on('selectAnnotation',
            function(annotation, element) {
                get_write_permit(annotation);
                //console.log('selectAnnotation',annotation);
            }
        );

        anno.on('cancelSelected',
            function(selection) {
                release_write_permit();
                //console.log('cancelSelected', selection);
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
    }

    function get_write_permit(annotation) {

        if (!('id' in annotation)) return;
        if (annotation['id'] === write_permit_id) return;
        if (write_permit !== "") release_write_permit();

        write_permit_id=annotation['id'];

        postit('get-write-permit', {'anno_id': annotation['id'], 'last_read_time': last_read_time },
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
            }
        );
    }

    function release_write_permit() {
            access_manager.restoreReadOnlyState();

            if (write_permit === "") return;

            postit('release-write-permit', { 'write_permit': write_permit},function() {});

            write_permit = "";
            write_permit_id = "";
        }

    function annotation_url_submit() {
        let img_url = $("#annotation-url").val();

        $("#search-result-list-collapse").collapse('hide');
        $("#image-view").attr("src", img_url);
    }

    function update_annotation_list() {
        function render_list(result) {

            let read_time = result['read_time'];
            let annotations_update = result['annotations'];

            if (anno === null) return;

            $.each(annotations_update,
                function(index, anno_info) {

                    if ('annotation' in anno_info)
                        anno.addAnnotation(anno_info['annotation'], result['read_only']);
                    else
                        anno.removeAnnotation(anno_info['anno_id']);
                }
            );

            last_read_time = read_time;
        }

        if (!access_manager.hasUser()) {
            if (anno === null) return;

            anno.clearAnnotations();
            last_read_time="";
        }
        else {
            let post_data =  { "url" : $("#image-view").attr("src") };

            if (last_read_time.length > 0) post_data['last_read_time'] = last_read_time;

            postit("get-annotations", post_data, render_list);
        }
    }

    function showConfiguration() {
        $('#editor').addClass('d-none');
        $('#url-selection').addClass('d-none');
        $('#configuration').removeClass('d-none');

        render_target_list();
    }

    function showEditor() {
        $('#url-selection').removeClass('d-none');
        if ($("#image-view").attr('src').length > 0) $('#editor').removeClass('d-none');

        $('#configuration').addClass('d-none');
        $('#data-export').addClass('d-none');
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

                $.each(results,
                    function(index, result) {
                        let description_html=""

                        if (result.description.length > 0) {
                            description_html = `<span>[${result.description}]</span>`;
                        }

                        let item_html=`
                            <button class="list-group-item list-group-item-action text-left" id="target-item-${index}">
                                <span class="mr-2">${result.url_pattern}</span>
                                ${description_html}
                            </button>
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
                          <div class="dropdown-menu text-center">
                            <button class="dropdown-item" id="configure">Configure</button>
                            <button class="dropdown-item" id="data-export-dropdown" disabled>Data Export</button>
                          </div>
                        </div>
                    </div>
                    `;

                $.get("isadmin")
                    .done(
                        function(result) {
                            if (result.isadmin) {
                                enable_logout(logout_html);

                                $('#configure').click(showConfiguration);
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
                }
        };

        basic_auth.getUser();

        return that;
    }

    let search_url = "";
    let suggestions_html = "";

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

                    suggestions_html="";
                    $.each(suggestions,
                       function(index, item){

                            let description_html="";

                            if (item.description.length > 0)
                                description_html = `<span> [ ${item.description} ]</span>`;

                            suggestions_html += `
                                <button class="list-group-item list-group-item-action text-left" id="search-result-${index}">
                                    <span class="mr-2"> ${item.url_pattern} </span> ${description_html}
                                </button>`;
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
                    console.log(suggestions);

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

        $("#edit-form").submit(annotation_url_submit);

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
            function() {
                clear_editor();
            }
        );

        $(".back-to-editor").click(showEditor);

        $("#add-url").click(
            function() {
                let url = $("#conf-url").val();
                let description = $("#conf-description").val();

                if (url.length < 7) return;

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

                if (url.length < 7) return;

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