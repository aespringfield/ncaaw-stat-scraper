$('.clickable-tr').on('click', function(){
    var myLink = $(this).attr('href');
    window.location.href = myLink;
});

$('.leaderboard_metric').on('change', function(){
    var selected = $(this).val();
    console.log('leaderboard_metric')
    console.log(selected)
    window.location.href = '/stats/leaderboard/team/' + selected + '/2018/ncaa-d1-natl'
});

$('.compare_team').on('change', function(){
    var e = document.getElementById('compare_team_end_year');
    var end_year = e.options[e.selectedIndex].value;

    var e = document.getElementById('compare_team_division');
    var division = e.options[e.selectedIndex].value;

    var e = document.getElementById('compare_team_team1');
    var team1 = e.options[e.selectedIndex].value;

    var e = document.getElementById('compare_team_team2');
    var team2 = e.options[e.selectedIndex].value;

    if ($(this).attr("id") == 'compare_team_division'){
        var href = '/stats/compare/ncaa/team/' + end_year + '/d' + division + '/'
    }
    else{
        var href = '/stats/compare/ncaa/team/' + end_year + '/d' + division + '/' + team1 + '/' + team2 + '/'
    }

    window.location.href = href
});


$('.lobos_look').on('change', function(){
    var e = document.getElementById('lobos_look_end_year');
    var end_year = e.options[e.selectedIndex].value;

    var e = document.getElementById('lobos_look_division');
    var division = e.options[e.selectedIndex].value;

    var e = document.getElementById('lobos_look_team1');
    var team1 = e.options[e.selectedIndex].value;

    var e = document.getElementById('lobos_look_team2');
    var team2 = e.options[e.selectedIndex].value;

    if ($(this).attr("id") == 'lobos_look_division'){
        var href = '/stats/lobos_look/ncaa/team/' + end_year + '/d' + division + '/'
    }
    else{
        var href = '/stats/lobos_look/ncaa/team/' + end_year + '/d' + division + '/' + team1 + '/' + team2 + '/'
    }

    window.location.href = href
});

$('.leaderboard').on('change', function(){
    var e = document.getElementById('leaderboard_metric');
    var metric = e.options[e.selectedIndex].value;

    var e = document.getElementById('leaderboard_player_team');
    var player_team = e.options[e.selectedIndex].value;

    var e = document.getElementById('leaderboard_natl_conf');
    var natl_conf = e.options[e.selectedIndex].value;

    var e = document.getElementById('leaderboard_season');
    var season = e.options[e.selectedIndex].value;

    var e = document.getElementById('leaderboard_division');
    var division = e.options[e.selectedIndex].value;

    if ($(this).attr("id") == 'leaderboard_division'){
        var href = '/stats/leaderboard/' + player_team + '/' + metric + '/' + season + '/ncaa-d' + division + '-natl'
    }
    else{
        var href = '/stats/leaderboard/' + player_team + '/' + metric + '/' + season + '/ncaa-d' + division + '-' + natl_conf
    }


    window.location.href = href

});


$('.selectpicker').on('change', function(){
    var selected = $(this).val();

    // Change the dropdowns to the right value
    $('.rank_or_pctile').val(selected);
    $('.rank_or_pctile').selectpicker('refresh')

    // Show the column that is selected
    if (selected == 'Natl %ile') {
        $('.natl_ile').removeClass("hidden")
        $('.natl_rank').addClass("hidden")
        $('.conf_rank').addClass("hidden")
        $('.conf_ile').addClass("hidden")

    } else if (selected == 'Natl Rank') {
        $('.natl_rank').removeClass("hidden")
        $('.natl_ile').addClass("hidden")
        $('.conf_rank').addClass("hidden")
        $('.conf_ile').addClass("hidden")
    } else if (selected == 'Conf Rank') {
        $('.conf_rank').removeClass("hidden")
        $('.natl_rank').addClass("hidden")
        $('.natl_ile').addClass("hidden")
        $('.conf_ile').addClass("hidden")
    } else if (selected == 'Conf %ile') {
        $('.conf_ile').removeClass("hidden")
        $('.natl_rank').addClass("hidden")
        $('.natl_ile').addClass("hidden")
        $('.conf_rank').addClass("hidden")
    }

});

$('a[data-toggle="tab"]').on('show.bs.tab', function (e) {
    // Make the correct tab of data visible
    var thisYear = e.target.text
    var oldYear = e.relatedTarget.text
    $('.' + oldYear).removeClass("active")
    $('.' + thisYear).addClass("active")

    // Make the correct pill visible, including handling "More"
    $('a[class="dropdown-toggle"]').parent().removeClass("active") // Always disable "More" initially
    // Always set the dropdowns to "More" initially
    var myDropdowns = $('a[class="dropdown-toggle"]');
    for (var i = 0; i < myDropdowns.length; i++) {
      myDropdowns[i].innerHTML = 'More<span class="caret">'
      }

    $('a[href="#' + oldYear + '"]').parent().removeClass("active")
    $('a[href="#' + thisYear + '"]').parent().addClass("active")

    // If we need to activate "More", go ahead and do so. Also change text to this year
    var parentParentClass = this.parentElement.parentElement.className
    if (parentParentClass == 'dropdown-menu') {
        // Make the "More" button active
        $('a[class="dropdown-toggle"]').parent().addClass("active")

        // Set "More" to the year chosen in the dropdown
        var myDropdowns = $('a[class="dropdown-toggle"]');
        for (var i = 0; i < myDropdowns.length; i++) {
          myDropdowns[i].innerHTML = thisYear + '<span class="caret">'
          }

    }

})

// $('a[data-toggle="tab"]').on('show.bs.tab', function (e) {
//     e.preventDefault()
//     console.log("show.bs.tab e.target.text " + e.target.text)
//     console.log("show.bs.tab e.relatedTarget.text " + e.relatedTarget.text)
//     $('.' + e.relatedTarget.text).hide('tab')
//
// })
//
// $(".nav-pills a").click(function(e){
//     e.preventDefault()
//     console.log("Clicked nav-pill link")
//     console.log("e.target.text " + e.target.text)
//     // $('.2017-18').addClass("active")
//     // $('.2018-19').addClass("hidden")
//     //$('.' + e.target.text).show('tab')
//     //$('.' + e.target.text).show('tab')
//
//     //console.log("e.relatedTarget.text" + e.relatedTarget.text)
// })

// $(".nav-pills a").click(function(e){
//     e.preventDefault()
//     console.log("Clicked nav-pill link")
//     console.log("Event")
//     console.log(e)
//     console.log("e.target.text")
//     console.log(e.target.text)
//     console.log("this")
//     console.log(this)
//     console.log("$(this)")
//     console.log($(this))
//     // This doesn't work. Think it's because no id
//     alert("About to show tab")
//     $(this).tab('show')
//     alert("Should be shown")
//
//
//
//     // $(this).tab('show');
// });

// $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
//     // NOTE: ACTUALLY TRIGGERS TWICE, BUT IT'S FAST ENOUGH.
//     // console.log(e)
//     // alert("Switching to tab " + e.target.text)
//
//     // Select tab by name
//     selected='.nav-pills a[href=".'+e.target.text+'"]'
//     // console.log("selected")
//     // console.log(selected)
//     $(selected).tab('show')
//
//
//     //e.target // newly activated tab
//     //e.relatedTarget // previous active tab
// })
