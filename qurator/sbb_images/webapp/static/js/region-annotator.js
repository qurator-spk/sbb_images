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

    let anno=null;
    let read_only_state=true;

    let basic_auth=null;

    let annotations=null;

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

        $("#editor").removeClass("d-none");

        anno = Annotorious.init({
          image: 'image-view',
          locale: 'auto',
          allowEmpty: true,
          readyOnly: true
        });

        Annotorious.BetterPolygon(anno);

        if (basic_auth.getUser() != null) {

            Annotorious.Toolbar(anno, $('#toolbar')[0]);
        }

        anno.setDrawingTool("polygon");

        anno.on('createAnnotation',
            function(annotation, overrideId) {
                add_annotation(annotation,
                    function() {
                        update_annotation_list();
                    }
                );
            }
        );

        anno.on('deleteAnnotation',
            function(annotation) {
                delete_annotation(annotation['id'],
                    function() {
                        write_permit="";
                        write_permit_id="";
                        update_annotation_list();
                    }
                );
            }
        );

        anno.on('updateAnnotation',
            function(annotation, previous) {
                update_annotation(annotation,
                    function() {
                        write_permit="";
                        write_permit_id="";
                        update_annotation_list();
                    }
                );
            }
        );

        anno.on('clickAnnotation',
            function(annotation, element) {
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
            }
        );

        anno.on('mouseLeaveAnnotation',
            function(annotation, element) {
            }
        );

        update_read_only_state();
        update_annotation_list();
    }

    function get_write_permit(annotation) {

        console.log(annotation['id'])

        if (!('id' in annotation)) return;
        if (annotation['id'] === write_permit_id) return;
        if (write_permit !== "") release_write_permit();

        write_permit_id=annotation['id'];

        postit('get-write-permit', {'anno_id': annotation['id'] },
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

//    function update_single_annotation_view(anno_id) {
//        let post_data = { "anno_id": anno_id };
//
//        $.ajax({
//                url:  "get-annotation",
//                data: JSON.stringify(post_data),
//                type: 'POST',
//                contentType: "application/json",
//                success:
//                    function(result) {
//                        $.each(results,
//                            function(index, result) {
//                                //anno.addAnnotation(result['annotation'], result['read_only']);
//                            }
//                        );
//                    },
//                error:
//                    function(error) {
//                        console.log(error);
//                    }
//            }
//        );
//    }

    function update_read_only_state() {
        if (anno === null) return;

        anno.readOnly = true;

        if (basic_auth.getUser() != null) {
            anno.setAuthInfo({
              id: basic_auth.getUser(),
              displayName: basic_auth.getUser()
            });

            anno.readOnly=false;
        }

        read_only_state = anno.readOnly;
    }

    function update_annotation_list() {

        function render_list(results) {

            if (anno === null) return;

            anno.clearAnnotations();

            $.each(results,
                function(index, result) {
                    anno.addAnnotation(result['annotation'], result['read_only']);
                }
            );
        }

        if (basic_auth.getUser() === null) {
            if (anno === null) return;

            anno.clearAnnotations();
        }
        else {
            let post_data =  { "url" : $("#image-view").attr("src"), 'since': -1 }

            postit("get-annotations", post_data, render_list);
        }
    }

    function update_admin_state() {
        $.get("isadmin",
            function(result) {
                if (result.isadmin) {
                    $("#add-action").prop("disabled", false);
                }
            }
        );
    }

    function init() {
        $("#annotation-url").on('input', annotation_url_input);

        $("#annotation-url").on('keydown',
            function(e) {
                if (e.keyCode === 13) annotation_url_submit();
            }
        );

        basic_auth = BasicAuth('#auth-area');

        (function(enable_login, enable_logout) {

        basic_auth.enable_logout =
            function() {
                enable_logout();

                update_admin_state();

                if (anno === null) return;

                anno.setAuthInfo({
                    id: basic_auth.getUser(),
                    displayName: basic_auth.getUser()
                });

                Annotorious.Toolbar(anno, $('#toolbar')[0]);

                update_read_only_state();
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

                update_read_only_state();
                update_annotation_list();
            };

        })(basic_auth.enable_login, basic_auth.enable_logout);

        if (basic_auth.getUser() != null) {
            update_admin_state();
        }

        $("#image-view").on("load",
            function() {
                postit('has-url', {'url': $("#image-view").attr('src')},
                    function() {
                        annotation_setup($("#image-view").attr('src'));
                    }
                );
            }
        );
    }

    let that =
        {
            init: function() { init(); }
        };

    return that;
}

$(document).ready(
    function() {
        let annotator = makeAnnotator();

        annotator.init();
    }
);

})();