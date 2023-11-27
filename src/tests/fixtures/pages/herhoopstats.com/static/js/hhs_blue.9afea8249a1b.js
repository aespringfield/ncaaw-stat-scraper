// Javascript functions for "Blue" page_stat
$('.show_multiyear_percentiles').click(function (event) {

	// Don't follow the link
	event.preventDefault();

    console.log("Clicked Show Multiyear Percentiles")
	// Log the clicked element in the console
	//console.log(event.target);

    // d-none hides the element
    $('.multiyear_stat_percentile').removeClass("d-none")
    $('.multiyear_stat_rank').addClass("d-none")

});

$('.show_multiyear_ranks').click(function (event) {

	// Don't follow the link
	event.preventDefault();

    console.log("Clicked Show Multiyear Ranks")
	// Log the clicked element in the console
	//console.log(event.target);

    // d-none hides the element
    $('.multiyear_stat_rank').removeClass("d-none")
    $('.multiyear_stat_percentile').addClass("d-none")

});

$('.show_multiyear_no_ranks_percentiles').click(function (event) {

	// Don't follow the link
	event.preventDefault();

    console.log("Clicked Show No Multiyear Ranks or Percentiles")
	// Log the clicked element in the console
	//console.log(event.target);

    // d-none hides the element
    $('.multiyear_stat_no_rank_ile').removeClass("d-none")
    $('.multiyear_stat_rank').addClass("d-none")
    $('.multiyear_stat_percentile').addClass("d-none")

});


// Javascript functions for "Blue" page_stat
$('.show_singleyear_percentiles').click(function (event) {

	// Don't follow the link
	event.preventDefault();

    console.log("Clicked Show Single Year Percentiles")
	// Log the clicked element in the console
	//console.log(event.target);

    // d-none hides the element
    $('.singleyear_stat_ile').removeClass("d-none")
    $('.singleyear_stat_rank').addClass("d-none")

});

$('.show_singleyear_ranks').click(function (event) {

	// Don't follow the link
	event.preventDefault();

    console.log("Clicked Show Single Year Ranks")
	// Log the clicked element in the console
	//console.log(event.target);

    // d-none hides the element
    $('.singleyear_stat_rank').removeClass("d-none")
    $('.singleyear_stat_ile').addClass("d-none")

});


// Initialize tooltip, set boundary to window to allow "top" placement to work
$(function () {
  $('[data-toggle="tooltip"]').tooltip({ boundary: 'window' })
})

// Initialize popovers, set boundary to window to allow "top" placement to work
$(function () {
  $('[data-toggle="popover"]').popover({ boundary: 'window' })
})


$('.team_season_selectpicker').on('change', function(){
    var selected = $(this).val();

    console.log($(this).val())

    window.location.href = selected

});

$('.player_season_selectpicker').on('change', function(){
    var selected = $(this).val();

    console.log($(this).val())

    window.location.href = selected

});

$('.season_selectpicker').on('change', function(){
    var selected = $(this).val();

    console.log($(this).val())

    window.location.href = selected

});

$('.wnba_research_choose_page_selectpicker').on('change', function(){
    var selected = $(this).val();

    console.log($(this).val())

    window.location.href = '/stats/wnba/research/' + selected

});

$('.wnba_charts_choose_page_selectpicker').on('change', function(){
    var selected = $(this).val();

    console.log($(this).val())

    window.location.href = '/stats/wnba/charts/' + selected

});

$('.ncaa_charts_choose_page_selectpicker').on('change', function(){
    var selected = $(this).val();

    console.log($(this).val())

    window.location.href = '/stats/ncaa/charts/' + selected

});

$('.ncaa_research_choose_page_selectpicker').on('change', function(){
    var selected = $(this).val();

    console.log($(this).val())

    window.location.href = '/stats/ncaa/research/' + selected

});

// Define function to show pronunciation icon as playing
function pronounce_icon_playing(iconid) {
  $('#'+iconid).addClass("bi-volume-up")
  $('#'+iconid).removeClass("bi-volume-up-fill")
}

// Define function to restore pronunciation icon to not playing
function pronounce_icon_not_playing(iconid) {
  $('#'+iconid).addClass("bi-volume-up-fill")
  $('#'+iconid).removeClass("bi-volume-up")
}

// Define function to toggle if playing audio of name pronunciation is on or off
function toggle_play_player_name_pronunciation(player_name_js,unique_number) {
  var theaudio = document.getElementById(player_name_js + "-pronounce-name-audio-" + unique_number);
  if (theaudio.paused) {
    // Audio is off, Will be turning it on

    // Turn everyone else off, even if playing
    // console.log($("span[id*='pronounce-name-icon']"))
    $("span[id*='pronounce-name-icon']").each(function() {
      // console.log($(this));

      // Extract the identifying elements for this player's audio
      other_player_name = $(this).attr('player_name');
      other_number = $(this).attr('random_number');

      other_audio = document.getElementById(other_player_name + "-pronounce-name-audio-" + other_number);
      other_audio.pause()
      pronounce_icon_not_playing(other_player_name + "-pronounce-name-icon-" + other_number)
    });


    theaudio.play();
    pronounce_icon_playing(player_name_js + "-pronounce-name-icon-" + unique_number)
  } else {
    theaudio.pause();
    pronounce_icon_not_playing(player_name_js + "-pronounce-name-icon-" + unique_number)
  }
}
