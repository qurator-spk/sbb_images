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

    let is_active=true;
    let anno=null;
    let update_timeout=null;

    let access_manager=null;

    let last_read_time="";

    let write_permit="";
    let write_permit_id="";
    let renew_permit_timeout=null;

    function annotation_url_input() {
        console.log("annotation_url_input");
    }

    function add_annotation(annotation, onSuccess) {
        postit("add-annotation", { "annotation": annotation, "url" : $("#image-view").attr("src") }, onSuccess);
    }

    function update_annotation(annotation, onSuccess) {
        postit("update-annotation",  { "annotation": annotation, 'write_permit': write_permit }, onSuccess);
    }

    function delete_annotation(anno_id, onSuccess) {
        postit("delete-annotation", { "anno_id": anno_id, 'write_permit': write_permit }, onSuccess);
    }

    function add_url(img_url, onSuccess) {
        postit ("add-url", { "url" : img_url }, onSuccess);
    }

    function annotation_setup(img_url) {

        if (anno != null) {
            anno.destroy();

            $('#toolbar').html("");
        }

        $("#configuration").addClass("d-none");
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

        if (update_timeout !== null) clearTimeout(update_timeout);

        let interval_update = null
        interval_update =
            function() {
                if (anno==null) return;

                if (is_active) update_annotation_list();

                intervall_update = setTimeout(interval_update, 5000);
            };

        interval_update();
    }

    function get_write_permit(annotation) {

        //console.log(annotation['id'])

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

        if ($("#action").val() === "add") {
            add_url(img_url,
                function() {
                    $("#action").val("annotate")
                }
            );
        }
        else {
            $("#image-view").attr("src", img_url);
        }
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
        console.log("showConfiguration");

        $('#editor').addClass('d-none');
        $('#url-selection').addClass('d-none');
        $('#configuration').removeClass('d-none');
    }

    function applyConfiguration() {
        $('#url-selection').removeClass('d-none');
        $('#configuration').addClass('d-none');
    }

    function showUrlSection() {
        $('#url-selection').removeClass('d-none');
        $('#configuration').addClass('d-none');
    }

    function AccessManager() {
        let read_only_state=true;

        let basic_auth = BasicAuth('#auth-area');

        (function(enable_login, enable_logout) {

        basic_auth.enable_logout =
            function() {

                let logout_html=`
                    <div class="alert alert-success mb-3">
                        <span> [${basic_auth.user()}] </span>
                        <div class="btn-group ml-2">
                          <button type="button" class="btn btn-secondary" id="logout">Logout</button>
                          <button type="button" class="btn btn-secondary dropdown-toggle dropdown-toggle-split"
                                data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            <span class="sr-only">Toggle Dropdown</span>
                          </button>
                          <div class="dropdown-menu">
                            <button class="dropdown-item" id="configure">Configure</button>
                          </div>
                        </div>
                    </div>
                    `;

                $.get("isadmin")
                    .done(
                        function(result) {
                            if (result.isadmin) {
                                enable_logout(logout_html);

                                $('#configure').click(
                                    function() {
                                        showConfiguration();
                                    }
                                );
                            }
                            else {
                                enable_logout();
                            }
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

    function init() {
        $("#annotation-url").on('input', annotation_url_input);

        $("#annotation-url").on('keydown',
            function(e) {
                if (e.keyCode === 13) annotation_url_submit();
            }
        );

        access_manager = AccessManager();

        $("#image-view").on("load",
            function() {
                if (!access_manager.hasUser()) return;

                postit('has-url', {'url': $("#image-view").attr('src')},
                    function() {
                        annotation_setup($("#image-view").attr('src'));
                    }
                );
            }
        );

        $("#apply-conf").click(applyConfiguration);
        $("#cancel-conf").click(showUrlSection);
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