$(document).ready( function() {

		$("#the-image").change(function(){

		    let fileInput = $('#the-image')[0]
            let file = fileInput.files[0];

            let reader = new FileReader();

		    reader.onload =
		        function (e) {
		            $('#img-upload').attr('src', e.target.result);
		            $('#search-results').html("");
		        };

            reader.readAsDataURL(file);

            let formData = new FormData();
            formData.append('file', file);

            $.ajax(
                {
                    url:  "similar",
                    data: formData,
                    type: 'POST',
                    enctype: "multipart/form-data",
                    processData: false,
                    contentType: false,
                    cache: false,
                    success:
                        function(results) {

                            let result_html = ""

                            $.each(results,
                                function(index, result_id) {
                                       result_html +=
                                        '<img class="img-fluid fit-image" src="image/' + result_id + '"/>';
                                });

                            $('#search-results').html(result_html);
                        },
                    error:
                        function(error) {
                            console.log(error);
                        }
                }
            );
		});
	});