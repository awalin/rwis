var colorScale = d3.scale.ordinal().domain(["all","2867", "2866"]).range(d3.scale.category10().range());
var pleft = $("#parent").offset().left;
var nformat = d3.format("3,.2g");
var bisectDate = d3.bisector(function(d) { return d.tstamp; }).left;
var xScale= d3.time.scale(),
interval = 15*60*1000,
xAxis = d3.svg.axis().ticks(15).tickSubdivide(true).orient("top"),// tickPaddin(10).tickSize(6,2,)   
populatedIDs = new Array(), // list of all stations for the current view, fixed size
selectedIDs = new Array(), // list of selected stations, value true or false, if all false, then no station is highlighted in time line, fixed size, indexed by station id
stationID,
stationColors,
xWidth, 
currenttime = new Date(),
enddate = +currenttime,
startdate,
aspectRatio,
oldExtent,
timelineDataAll = [],
yScale = [];
var format = d3.time.format("%Y-%m-%d %H:%M");
var parse = format.parse;
var length = 0;
var margin = {top:10, left:35, bottom:5, right:18},//the margin array for the main svg container
width,	
height = 800 - margin.top - margin.bottom;
var eachHeight = 70; //height of each timeline
var dragged = false;
var zoom = d3.behavior.zoom()
.scaleExtent([1,5])
.on("zoom", function(){                                      
	var tx = d3.select(".x.axis").call(xAxis)
	.selectAll("text") 
	.attr("transform", function(d, i){
		if(d.getHours()==0){
			return "translate(0, -6)" 
		}
	});     
	startdate = +(xScale.domain()[0]);//update start time, up to milliseconds
	function transform (){
		return "scale(" + d3.event.scale +", 1)";
	}
	d3.select("#parent")
	.selectAll(".line")
	.attr("transform", transform );

});

var line = d3.svg.line()
.interpolate("linear")
.x(function(d) { return xScale(d.tstamp); });



function getTimedData(start, end){
	var endp = new Date(end);
	var startp = new Date(start);	
	var parameters = {
			startTime: format(startp),
			stationID: stationID,
			endTime: format(endp),
			obs: observationTypes
	};
	parameters = JSON.stringify(parameters);

	$.ajaxSetup({    	
		crossDomain: false, // obviates need for sameOrigin test        
		beforeSend: function(xhr, settings) {
			if (!csrfSafeMethod(settings.type)) {
				xhr.setRequestHeader("X-CSRFToken", csrftoken);
			}
			$("#loading").html("Loading observations for the selected timeframe");
			$('#loading').show();
		},
		complete: function(){		
		}        
	});
	var deferred = [];	

	deferred.push($.ajax({
		type: 'POST',
		url: '/observe/',
		data: parameters, 
		cache: false,                
		success: function(data){			
			data.forEach(function(d, i){//for each station	
				parseDates(d.rows);				
				timelineDataAll["all"][""+d.type] = data[i];				
			});
		},
		error: function() {
			console.log('Error loading observations, database returned empty');
		}
	})//end of ajax call
	);	

	stationID.forEach(function(d){	//this should be for item in the stations array, then check if they are selected
		var stationId= ""+d;			
		if( selectedIDs[stationId]==true){		
			deferred.push(getStationData(d, start, end, false));			
		}else if(selectedIDs[stationId]==false){
			populatedIDs[stationId]=false;//no data for this timeframe			
		}		
	});			   					

	$.when.apply($, deferred).done(drawAfterDateChange); //redraw y-axis, and indv station is integrated inside drawing	
}


function drawAfterDateChange(){	
	prepXaxis();			
	xAxis.scale(xScale);	   				  	
	var tx = d3.select(".x.axis").call(xAxis);	

	$("#loading").fadeOut(300, function() { $(this).remove(); });
	drawLines(timelineDataAll, true, false);	
	
	renderTooltip();
}

//data to draw in first stage of animation
//redraw y axis
//rest of the data to draw after the animation 


//only draw individual stations
function drawLines(dataToDraw, redrawaxis, rest){	

	var dataToDraw = dataToDraw;		
	var keys = _.keys(selectedIDs);
	keys.reverse();
	
	d3.selectAll(".warning").remove();

	observationTypes.forEach(function(d, i){			
		// the axis is always global, though sometimes we may need to draw only part of the line

		var yMax = -Number.MIN_VALUE;
		var yMin = Number.MAX_VALUE;

		var type = d.observation_type;
		var id = "#chart-" + type;
//		var title = Stockpile.meta.obsType[d.title];

		var chart = d3.select("#frame-"+type);	
		d3.select(".x.axis").selectAll("text") 
		.attr("transform", function(d){
			if(d.getHours()==0){
				return "translate(0, -6)";}
		}); 

		if(timelineDataAll["all"][type].rows.length<=0){	
			
			d3.select(id).append("rect")
			.attr("class","nodata")
			.attr("width", xWidth)
			.attr("height", eachHeight)
			.attr("x", 0)
			.attr("y", -15);

			d3.select(id)			
			.append("text")
			.attr("class","warning")
			.attr("transform", "translate(" + margin.left + ","+margin.top+")")				
			.text("No data for this time frame");
			return;
		}else{ // data is not empty	
			keys.forEach(function(value){	
				var curr_station=value;					
				if( selectedIDs[curr_station]==true && populatedIDs[curr_station]==true){//visible and has data					
					var rows = timelineDataAll[curr_station][type].rows;//all data
					yMax= d3.max([yMax, d3.max( rows, function(d) { return d.metric_value; })]);
					yMin= d3.min([yMin, d3.min( rows, function(d) { return d.metric_value; })]);
				}				
			});

			var yScale = d3.scale.linear()
			.domain([yMin, yMax]).nice()
			.rangeRound([eachHeight, 0]).nice();
			var yAxis = d3.svg.axis().scale(yScale).ticks(6).orient("left");			

			// for each station or all, d = datatoDraw["all"] or datatToDraw["station"]			
			// the axis is always global, though sometimes we may need to draw only part of the line				
			if(rest==true) {		//draw remaining data and whole data with staged animation				
				var y = chart.select(".y.axis")
				.transition().duration(500)
				.call(yAxis);			

				y.each("end", function(){					
					var t = d3.select(id)
					.selectAll(".line") 			        
					.transition().duration(500).delay(400)
					.attr("d",function(d, i2){//i=type, i2= station serial or all, aka index of the line in this obs type	
						var station = keys[i2];
						line.y(function(d) { return yScale(d.metric_value); });		
						if(selectedIDs[station]==true)
							return line(dataToDraw[station][type].rows, function(d){ return xScale(d.tstamp) ;})
					} );			
					//now everything
					t.each("end", function(d,i2){
						var station = keys[i2];
						d3.select(this)
						.attr("d", function(d){
							line.y(function(d) { return yScale(d.metric_value); });	
							if(selectedIDs[station]==true){
								return line( timelineDataAll[station][type].rows, function(d){ return xScale( d.tstamp) ;});
							} 
						});
					});
				});//each of trans y

			}else { // calendar or on drag, drawing in one stage
				d3.select(id)
				.selectAll(".line")										
				.attr("d", function(d, i2){
					var station = keys[i2];
					line.y(function(d) { return yScale(d.metric_value); });	
					if(selectedIDs[station]==true){
						return line( timelineDataAll[station][type].rows, function(d){ return xScale( d.tstamp) ;});
					} 
				});

				if(redrawaxis==true){ //redraw axis			
					chart.select(".y.axis").transition().duration().delay().call(yAxis);				
				}			
			} // end of drag, calendar

		}//data not empty
	});//end of for each obs type
	
	
}




//preparing the extent of x- axis based on the query start and end date
function prepXaxis(){	
	var xMax = new Date(enddate);
	var xMin = new Date(startdate);		 
	xScale.domain([xMin, xMax]);	
}

//var position = 0;
//mouse drag behavior, drag may have to fetch more data if data of that time frame not available//

var drag = d3.behavior.drag()
//.origin(Object)
.on("dragend", getDataAfterDrag)
.on("drag", ondrag)
.on("dragstart", function() {
	
	disableTooltip();		
	dragged = true; // to prevent unnecessary db call in case of any random mouse click
//	position = 0;//should be the initial point of the svg            	 
	oldExtent = xScale.domain();
	d3.event.sourceEvent.stopPropagation(); // silence other listeners
});




function ondrag(){		
//	position += d3.event.dx;  	 
	disableTooltip();
	drawLines(timelineDataAll, false);	
}




function getDataAfterDrag(){
	
	if(dragged==false){
		return;		
	}
	dragged= false;
	var newExtent = xScale.domain(); // new domain of x scale 	
	if(newExtent[0] > oldExtent[0]){
		var dragright = true;
		var finish = newExtent[1];
		var begin = oldExtent[1];    	
	}else{
		var begin = newExtent[0];
		var finish = oldExtent[0];    
	}

	oldExtent = newExtent;
	startdate = +(newExtent[0]);//update prev week start time, upto milliseconds

	var remaining = [];
	keys = _.keys(populatedIDs);
	keys.reverse();

	//will need to work with that for all stations
	keys.forEach(function(d){		
		var curr_station = d;
		if(populatedIDs[curr_station]==false){
			return;
		}
		else{//populated==true			
			remaining[curr_station] = [];			
			var data= timelineDataAll[curr_station];			
			data.forEach(function(d){//for each type
				var r=[];		
				d.rows = d.rows.filter(function(d,i){
					if( (( (+d.tstamp) < (+newExtent[1]) ) && ( (+d.tstamp)> (+newExtent[0]) )) ){
						r.push(d);
						return true;
					} 
				});
				var values ={
						"rows":r,
						"type":d.type };	
				var otype= d.type;
				remaining[curr_station][otype] = values;// TODO: or just assign?
			});	
		}
	});	

	var xstart = xScale(new Date(begin));
	var xend = xScale(new Date(finish));
	var rwidth = xend-xstart-6;

	var left = xstart+margin.left+10;	
	var deferred = [];	
	var top = margin.top+20;

	var parameters = {
			startTime: format(begin),
			stationID: stationID,
			endTime:   format(finish),
			obs: observationTypes
	};
	parameters = JSON.stringify(parameters);

	$.ajaxSetup({    	
		crossDomain: false, // obviates need for sameOrigin test        
		beforeSend: function(xhr, settings) {        	
			if (!csrfSafeMethod(settings.type)) {
				xhr.setRequestHeader("X-CSRFToken", csrftoken);
			}
			//show multiple loading, one in each timeline
			d3.select("#parent").selectAll(".series")
			.insert("div", function(d,i){ return "#frame-"+i;})		// or append?	  
			.attr("class","load")
			.html("<span class='label'>Loading new observations</span>")
			.html("<span class='label'>Loading new observations</span>")
			.style("width", rwidth+"px")
			.style("height", eachHeight+"px")
			.style("left",left+"px" )
			.style("top", top+"px");
		},
		complete: function(){
//			$(".load").fadeOut(300, function() { $(this).remove(); });
		}        
	});

	deferred.push($.ajax({
		type: 'POST',
		url: '/observe/',
		data: parameters, 
		cache: false,                
		success: function(data){					
			data.forEach(function(d){//for each station	
				parseDates(d.rows);				
			});			
			populatedIDs["all"]= true;			
			mergeDataAfterDrag(data, "all");	
		},				
		error : function() {
			console.log('Error loading observations');
		}
	})
	);	
	stationID.forEach( function(d){	//this should be for item in the stations array, then check if they are selected
		var stationId= ""+d;			
		if(selectedIDs[stationId]==true || populatedIDs[stationId]==true){ // || firsttime[stationId]==false)
			deferred.push(getStationDataOnDrag(d, begin, finish, false));					
		}		
	});			

	$.when.apply($, deferred).then( function(){ 
		$(".load").fadeOut(300, function() { $(this).remove(); });
		drawLines(remaining, true, true);//redraw y-axis= true,with draw in two step=true	
	});
	

	d3.selectAll(".tipdiv").style("visibility","visible");	
	d3.selectAll(".tipcircle").attr("opacity",1);	
	d3.selectAll("#tipdate").style("visibility","visible");	
	d3.selectAll("#tipline").style("visibility","visible");	
	
	renderTooltip();
}



/***
 * before drawing the time series
 * prepare the x axis, date picker
 */
function prepCanvas(){

	makeCalendar();	
	
	$("#parent").sortable({ 
				axis: "y",
//				containment: "#timeline",
				placeholder: "ui-sortable-placeholder" ,
				cursor: "move",
				start: function( event, ui ) {				
						
					disableTooltip();
					
					$(".ui-sortable-placeholder").css({height:"100px"});
				},
				update: function( event, ui ) {	
					d3.selectAll(".tipdiv").style("visibility","visible");		
					d3.selectAll(".tipcircle").attr("opacity",1);					
					d3.select("#tipline").style("visibility","visible");
					
					renderTooltip();
				}
			});
	//resizing window
	$(window).on("resize", function(){
		$("#parent .svg-container").each(function(){			
			var parentWidth = $("#xAxis .series").width();
			var w = parentWidth;
			var h = w/aspectRatio;	
			d3.select(this).attr("width", w);
			d3.select(this).attr("height", h);	     
			//d3.select(this).attr( "viewBox","0 0 "+w+" "+ h+" ");  
		});

		$("#xAxis .svg-container").each(function(){
			var container = $(this).parent();
			var parentWidth = $("#xAxis .series").width();
			var w = parentWidth;	  	
			var h = Math.max(25,margin.top+margin.bottom);

			d3.select(this).attr("width", w);
			d3.select(this).attr("height", h);				
			d3.select(".x.axis").call(xAxis);
		});

	}).trigger("resize");

	createStationList();		

}



function drawIncidentTimeline() {

	//timeScale defined for mockup purposes
	var iconCenterShift = 35/2;
	var timeScale = d3.time.scale();
	timeScale.domain([new Date(startdate), new Date(enddate)]);
	timeScale.range([margin.left, $("#xAxis .series").width() - margin.right]);

	var parentWidth = $("#xAxis .series").width() + margin.left + margin.right;
	
	var svg = d3.select("#timeline-incident .series").append("svg:svg")
				.attr("viewBox","0 0 "+parentWidth+" 1")
				.attr("preserveAspectRatio", "none");

	svg.append("svg:line")
	    .attr("x1", margin.left)
	    .attr("x2", parentWidth - margin.right)
	    .attr("y1", 0.5)
	    .attr("y2", 0.5)
	    .attr("vector-effect", "non-scaling-stroke")
	    .attr("class", "axisLine");
	
	//add incident icon mockup
	d3.select("#timeline-incident .series").selectAll("a")
		.data(Stockpile.meta.inc)
		.enter()
		.append("a")
		.attr("class", function(d){ return "incident-icon " + d.type; })
		.style("top", "0px")
		.style("left", function(d){ return timeScale(d.tstamp) + "px"; })
		.on("click", function(d,i){ alert(d.type + " " + d.id + " clicked!"); });

		/*
	
	d3.select("#timeline-incident .series").append("a")
		.attr("class", "incident-icon accident")
		.style("top", "0px")
		.style("left", "50px")
		.on( "click", function(){ alert("accident clicked!" ); });

	d3.select("#timeline-incident .series").append("a")
		.attr("class", "incident-icon incident")
		.style("top", "0px")
		.style("left", "75px")
		.on( "click", function(){ alert("incident clicked!" ); });
	
	d3.select("#timeline-incident .series").append("a")
		.attr("class", "incident-icon vehicleOnFirePlus")
		.style("top", "0px")
		.style("left", "250px")
		.on( "click", function(){ alert("vehicleOnFire clicked!" ); });
	
	d3.select("#timeline-incident .series").append("a")
		.attr("class", "incident-icon accident")
		.style("top", "0px")
		.style("left", "300px")
		.on( "click", function(){ alert("accident clicked!" ); });
	
	d3.select("#timeline-incident .series").append("a")
		.attr("class", "incident-icon incident")
		.style("top", "0px")
		.style("left", "375px")
		.on( "click", function(){ alert("incident clicked!" ); });
	
	d3.select("#timeline-incident .series").append("a")
		.attr("class", "incident-icon congestion")
		.style("top", "0px")
		.style("left", "390px")
		.on( "click", function(){ alert("congestion clicked!" ); });
		
		*/
};

function drawXAxis(){

	var xaxis= d3.select("#xAxis .series");	
	var parentWidth = $("#xAxis .series").width();

	xWidth = parentWidth - margin.left -margin.right;		
	xScale.range([0, xWidth]);		
	oldExtent = xScale.domain();

	var h = Math.max(25, margin.top + margin.bottom);	

	xAxis.scale(xScale);	
	zoom.x(xScale); //setting the scale of the zoom level

	var shift = h-2;
	xaxis
	.append("svg:svg").attr("class","svg-container")
	.attr("width", parentWidth)
	.attr("height", h )     
	.attr("viewBox","0 0 "+parentWidth+" "+ h+" ")
	.attr("preserveAspectRatio", "none")
	.append("svg:g")
	.attr("transform", "translate(" + margin.left + "," + shift + ")")	      
	.attr("class", "x axis")
	.call(xAxis)
	.selectAll("text")  
	.attr("transform", function(d, i){
		if(d.getHours()==0){
			return "translate(0, -6)" 
		}
	});    

	//adding zoom behavior	
	xaxis.call(zoom);	
	xaxis.call(drag); 
}


function createStationList (){	

	$(".manager a").click(function(e){	//click or hover ?	
		
		var parent = $(this);
		var tabtitle = $(this).html();		
		
		$('#tabs').empty();//clear content
		
		$( "#tabs" ).position({
			of: parent,
			my: "left-5 top",
			at: "left top"
		});

		var tabdiv = $(document.createElement('div'));	
		tabdiv.attr('id','station_ids');	
		$('#tabs').append(tabdiv);	
		tabdiv.append($(document.createElement('ul')));	
		$('#station_ids ul').append($(document.createElement('li')));
		
		var divid="manager-"+tabtitle;
		
		var tabheader = $(document.createElement('div'));	
		stationColors['all'] = colorScale("all");
		tabheader.append(
				$(document.createElement('input'))
				.attr({	
					id: 'color-all',						
					name: 'colorpicker'
				})
				.data("station", "all")			//"all" should be parameterized
				.prop( "disabled", false)//enable by default
		);
		
		if(stationColors["all"]==null){
			stationColors["all"]=colorScale("all");			
		}

		tabheader.append(
				$(document.createElement('input'))
				.attr({
					id:    'hidden-all',	
					value:	stationColors['all'],						
					type:  'hidden'//make it a button, then toggle the class
				})	
				.data("station", "all")
		);
		var hdbtn=	$(document.createElement('button'))
		.attr({
			id:    'button-all',										
			type:  'button'//make it a button, then add class
		})		
		.data("station", "all")
		.addClass('on');
		
		
		hdbtn.append( $(document.createElement("span")).html(tabtitle) );
		tabheader.append(hdbtn);

		$("#station_ids ul li").append("<a href='#"+divid+"'></a>");
		$("#station_ids ul li a").append(tabheader);

		//just one tab
		tabdiv.append("<div id='"+divid+"'></div>");
		tabdiv.tabs();	

		$("#"+divid).append(
				$(document.createElement('div'))
				.attr({
					id:  'closeTabs'					
				})
				.addClass('ui-icon ui-icon-closethick')				
				.click(function(){
					var container =  tabdiv;			
					container.remove();					
				})		
		);

		stationID.forEach(function(d,i){		
			firsttime[""+d]=true;		
			var checkdiv = $(document.createElement('div'));
			checkdiv.append(
					$(document.createElement('input'))
					.attr({	
						id: 'color-'+d,						
						name: 'colorpicker'
					})
					.data("station", d)	
					.prop( "disabled", true)
			);
			checkdiv.append(
					$(document.createElement('input'))
					.attr({
						id:    'hidden-'+d,	
						value:	stationColors[d],						
						type:  'hidden'
					})
					.data("station", d)
			);
			
			var btn = $(document.createElement('button'))
						.attr({
							id:    'button-'+d,						
							type:  'button'//make it a button, then toggle the class
						})						
						.data("station", d);
			
			btn.append( $(document.createElement("span")).html(d) );
			checkdiv.append(btn);
			
			checkdiv.append(
					$(document.createElement('span'))
					.attr({
						id:    'desc-'+d
					})
					.text(Stockpile.getStation(d).description)
			);
			$("#"+divid).append(checkdiv);
		});

		$( "#station_ids input[name='colorpicker']" ).each(function(){
			var input = $(this);
			var myValue = "hidden-"+input.data("station");			
			input.addClass("color {slider:false, valueElement:'"+myValue+"'}");	
			input.addClass("colorPicker");	
		});		

		jscolor.init();

		$( "#station_ids input[type='hidden']" )
		.change(function(){
			var input = $(this);			
			var curr_station = ""+input.data("station");	
			var inputVal = $(this).val();				
			stationColors[curr_station]="#"+inputVal;	

			observationTypes.forEach(function(d){
				var type= d.observation_type;
				var id = "#chart-" + type;							
				var pathid ="#stp"+type+"-"+curr_station;
				d3.select(id)
				.select(pathid)
				.attr("stroke", stationColors[curr_station]);		
			});				
		});	

		$( "#station_ids input[name='colorpicker']" ).each(function(){
			var input = $(this);		
			input.addClass("colorPicker-disable");	
		});	

		$( "#station_ids button" ).each(function(){				
				var input = $(this);			
				var curr_station = ""+input.data("station");				
				if( selectedIDs[curr_station]==true){ 
					var picker = "#color-"+curr_station;
					$(picker).prop("disabled", false);//enable the color picker initially
					$(picker).removeClass("colorPicker-disable");//enable the color picker initially					
					input.addClass("on").removeClass("off");
				}else {
					input.addClass("off").removeClass("on");		
				}
		});		

		$( "#station_ids button" )		
		.click(
				function() {	//toggle button and visibility		
					var $input = $(this);
					var curr_station = ""+$input.data("station");	
					if($input.hasClass("on")) {							  
						$input.removeClass("on").addClass("off");						
						$("#color-"+curr_station).prop( "disabled", true );//disable color picker
						$("#color-"+curr_station).addClass("colorPicker-disable");						
						selectedIDs[curr_station]=false;						
						//make this.timeline invisible	
						observationTypes.forEach(function(d){
							var type= d.observation_type;
							var id = "#chart-" + type;	
							if(populatedIDs[curr_station]==true){//has data, so make invisible
								d3.select(id)
								.select("#stp"+type+"-"+curr_station)
								.attr("opacity", 0);	
							}		
						}); 	
					} else {//show them
						$input.removeClass("off").addClass("on");	
						selectedIDs[curr_station]=true;
						$("#color-"+curr_station).prop( "disabled", false );//enable color picker
						$("#color-"+curr_station).removeClass("colorPicker-disable");

						if(populatedIDs[curr_station]==false){
							getStationData(curr_station, startdate, enddate, true);	
							//or getStationDataOnDrag();
						}else{//already populated, make it visible
							observationTypes.forEach(function(d){
								var type= d.observation_type;
								var id = "#chart-" + type;	
								d3.select(id)
								.select("#stp"+type+"-"+curr_station)
								.attr("opacity", 1);	
							}
							);
						}
					}	        
				});
		e.stopPropagation();		
	});
}


/****************
 * sends ajax request to the view to call database *
 * gets data from the request, and passes to the drawing function *
 ****************/

function getTimelineData(station_id) {
	
	d3.select(".manager").html("");
	d3.select(".manager").append("div").append("span").html("<a>NWS</a>"); // will move to another function later
	
	d3.select(".manager").select("div").append("span").html(", <a>FDOTS</a>"); // will move to another function later
	
	d3.select("#analyzeContainer").style("visibility","visible");
	$('#loading').hide();	
	$("#date-form").hide();//initially hide, show if ivon is clicked
	//empty the containers in case something was drawn before
	$("#parent").html("");
	$("#xAxis .series").html("");	

	selectedIDs["all"]= true;
	populatedIDs["all"]=false;

	var station_id=new Array();
	station_id.push(2866); //station_id;
	station_id.push(2867);

	//this is all hardcoded now. need to change
	stationID = new Array();
	stationColors = new Array();
	station_id.forEach(function(d){
		stationID.push(d); 
		selectedIDs[""+d] = false;
		populatedIDs[""+d]=false;	
		stationColors[""+d]=colorScale(""+d);
	});

	stationColors["all"]=colorScale("all");

	var lines = _.keys(selectedIDs);
	lines.reverse();

	var currenttime = new Date(2013, 6, 15);
	enddate = +currenttime;
	startdate = (enddate-7*24*60*60*1000);//keep the globals in millisec
	var start = new Date(startdate);
	var parameters = {
			startTime: format(start),
			stationID: stationID,
			endTime:   format(currenttime),
			obs: observationTypes

	};
	parameters = JSON.stringify(parameters);

	d3.select("#timeline-axis").style("visibility","visible");
	prepXaxis();
	drawXAxis();//drawing the x axis before the data is loaded
	drawIncidentTimeline();	

	$.ajaxSetup({    	
		crossDomain: false, // obviates need for sameOrigin test        
		beforeSend: function(xhr, settings) {  

			if (!csrfSafeMethod(settings.type)) {
				xhr.setRequestHeader("X-CSRFToken", csrftoken);
			}
			$("#loading").html("Loading observations for all stations");
			$('#loading').show();
		},
		complete: function(){
			d3.select("#loading").transition().duration(300)
			.each('end', function(){
				$('#loading').hide();	
			});
		}        
	});  

	$.ajax({
		type : 'POST',
		url : '/observe/',
		data : parameters,
		contentType: 'application/json; charset=utf-8',
		cache : false,          
		success : function(data) {			
			timelineDataAll["all"]=[];	
			data.forEach(function(d,i){
				observationTypes.push({'observation_type':d.type});
				timelineDataAll["all"][""+d.type] = data[i]; 
			});	
			timelineDataAll["all"].forEach(function(d){		//each type			
				parseDates(d.rows);				
			});		

			populatedIDs["all"]= true;
			wrapUpDrawing();     
		},
		error : function() {
			$('#loading').hide();            
			console.log('Error loading observations');
		}
	});
}



function wrapUpDrawing(){	
	d3.select(".date-picker").style("visibility","visible");
	d3.select("#timeline").style("visibility","visible");
	prepCanvas();      
	drawTimeSeries(timelineDataAll["all"]);	
}




function drawTimeSeries(data){	
	
	var w = xWidth+margin.left+margin.right;
	var h = eachHeight+margin.top+margin.bottom;
	var svg = d3.select("#parent");
	aspectRatio = w/h;      
	
	
//	now draw each timeline     
	data.forEach(function(d,i){
		
		var timelineData = d.rows;		
		var title = Stockpile.meta.obsType[d.type];
		var pathid ="stp"+d.type+"-"+"all";		
		var type = d.type;
		
		yScale[type] = d3.scale.linear()
		.domain([-1000, 1000]).nice()
		.rangeRound([eachHeight, 0]).nice();
		//need to remove the previous timelines on arrival to the page

		var div1=svg.append("div").attr("class","series").attr("class", "ui-state-default");

		if(title.metric==null){
			var unit = metric="";
		}else {
			var unit = " ("+title.metric+")";
		}

		div1.append("div").attr("class","title")
		.html("<h4>"+title.description
				+ unit
				+"</h4>");
		//static elements       
		var id = "chart-"+d.type;		

		var g1= div1.append("div").attr("id","frame-"+type)	   
		.append("svg:svg")
		.attr("class","svg-container")
		.attr("width", w)
		.attr("height", h)
		.attr("viewBox","0 0 "+w+" "+ h+" ")
		.attr("preserveAspectRatio", "xMidYMid")			
		.append("g").attr("id",id)
		.attr("transform", "translate(" + margin.left + ","+margin.top+")");	 

		// Add the clip path.
		g1.append("svg:clipPath")
		.attr("id", "clip")
		.append("svg:rect")
		.attr("x", 0)
		.attr( "y", -15)
		.attr("width", xWidth)
		.attr("height", eachHeight+15);

		// Add the x-axis line
		g1.append("svg:rect")
		.attr("class","rect")
		.attr("x", 0)
		.attr( "y", eachHeight)
		.attr ("width", xWidth)
		.attr("height",0.5);

		// Add the y-axis line
		g1.append("svg:rect")
		.attr("class","rect")
		.attr("x", -2 )
		.attr( "y", 0)
		.attr ("width", 0.5 )
		.attr("height", eachHeight);
	
	  
		if(timelineData.length>0){ 
			var yMax = d3.max( timelineData, function(d) { return d.metric_value; });
			var yMin = d3.min( timelineData, function(d) { return d.metric_value; });	 

			// Add the y-axis.
			yScale[type].domain([yMin, yMax]).nice();
			
			//this part is for it to work in IE8 properly, shows black background
			g1.append("svg:rect")
			.attr("class","nodata")
			.attr("x",0)
			.attr("y", -15)
			.attr("width", w)
			.attr("height", h);

			var strokes = g1 				
			.append("svg:path")
			.attr("class","line")
			.attr("id",pathid)
			.attr("clip-path", "url(#clip)") // where should I actually add the clip path
			.attr("stroke", colorScale("all"))
			.attr("d", function( ){ 
				line.y(function(d) { return yScale[type](d.metric_value); });
				return line(timelineData,function(d){return xScale(d.tstamp);}) });
			
			d3.select("#chart-"+type)
				.append("circle")
				.attr("class","tipcircle")
				.attr("cx",0)
				.attr("cy",0)
				.attr("r",0)
				.attr("stroke", stationColors["all"])
				.attr("opacity", 0.001);

			var yAxis = d3.svg.axis().scale(yScale[type]).ticks(6).orient("left");

			g1.append("svg:g")
			.attr("class", "y axis")
			.attr("transform", "translate(-2, 0)")	      
			.call(yAxis); 
			
		} else {
			g1.append("rect")
			.attr("class","nodata")
			.attr("width", xWidth)
			.attr("height", eachHeight)			
			.attr("x", 0)
			.attr("y", -15);

			g1.append("text")
			.attr("class","warning")
			.attr("transform", "translate(" + margin.left + ","+margin.top+")")			
			.text("No data for this time frame");
		}
		
		d3.select("#frame-"+type)
		.append("div")
		.attr("class","tipdiv")
		.attr("id","tip-"+type)
		.style("visibility","hidden")				
		.html("");				
	});	
	
   var h = $("#parent").height();
	
	d3.select("#parent").append("hr")
	.attr("class","tooltipline")
	.attr("id","tipline")
	.attr("width",1)
	.attr("size", h)
	.style("height",h+"px")	
	.style("left","0px");	
	
	d3.select("#parent")
	.append("div")
	.attr("id","tipdate")	
	.html("");
	
   renderTooltip();
}



function disableTooltip(){
	
	d3.selectAll(".tipdiv").style("visibility", "hidden");	
	d3.selectAll(".tipcircle").attr("opacity",0.001);						
	d3.select("#tipline").style("visibility", "hidden");
	
	d3.selectAll(".nodata")
	.on("mousemove", function(){ return ;})
	.on("mouseover", function (){ return ;});
	
	
}

function renderTooltip(){//passed only the aggregated line

	
	d3.selectAll(".tipcircle").attr("opacity", 0.001);						
    d3.selectAll(".tipdiv").style("visibility","hidden");	
    
    
	d3.selectAll(".nodata")
	.on("mousemove", function(){			
		var eventthis = this;		
		var x0 = xScale.invert(d3.mouse(this)[0]);		
		var index = parseInt( (+x0-(+xScale.domain()[0])) /(interval));
		var tooltipdate =   +xScale.domain()[0]+(index*interval);
		x0 = new Date(tooltipdate);
		
		var x= d3.event.pageX-pleft;
		
		d3.select("#tipline")
		.style("left", x+"px" ); 
		
		d3.select("#tipdate")
		.style("left",  (d3.event.pageX)+"px" )
		.html(format(x0)); 	
		
		observationTypes.forEach(function(d){		//for each type			
			var type= d.observation_type;			
			
			if(timelineDataAll["all"][type].rows.length>0) {
				var dat= timelineDataAll["all"][type];
				
				var i = bisectDate(dat.rows, x0, 0, dat.rows.length-1);
				if(i<=1){ return;}
				var dp;
			    var d0 = dat.rows[i - 1];
			    var d1 = dat.rows[i];			    
			    if( (x0 - d0.tstamp) > (d1.tstamp - x0)  ){
			    	dp = d1;		    	
			    }else {
			    	dp = d0;
			    	i=i-1;
			    }
			    
			    if( Math.abs(dp.tstamp-x0)<= interval ){	
			    	
			    	
			    	if(Stockpile.meta.obsType[type].metric==null){
						var unit1 = "";
			    	}else {
						var unit1 = " ("+Stockpile.meta.obsType[type].metric+")";
			    	}			    	
			    	
			    	var yval = dp.metric_value;			    	
					var cy = yScale[type](yval);
					var cx = xScale(dp.tstamp);		
					
					d3.select("#chart-"+type)
					.select(".tipcircle")
					.attr("cx",cx)
					.attr("cy",cy)
					.attr("r", 4)
					.attr("stroke", stationColors["all"])
					.attr("opacity", 0.001);
					
					var html = nformat(yval)+""+unit1;
					
					stationID.forEach(function(d){	//this should be for item in the stations array, then check if they are selected
						var stationId= ""+d;			
						if( (selectedIDs[stationId]==true) && (populatedIDs[stationId]==true) ){							
							var dat2 = timelineDataAll[stationId][type];	
							i = bisectDate(dat2.rows, x0, 0, dat2.rows.length-1);
							if(i<=1){ return;}
						    d0 = dat2.rows[i - 1];
						    d1 = dat2.rows[i];			    
						    if( (x0 - d0.tstamp) > (d1.tstamp - x0)  ){
						    	dp = d1;		    	
						    }else {
						    	dp = d0;				    
						    }						    						    	
						    if( Math.abs(dp.tstamp-x0)<= interval ){
						    	html = html + "</br><span style='color:"+stationColors[stationId]+";'>"
						    				+nformat(dp.metric_value)
						    				+""+unit1+"</span>";
						    }
						}	
					});												
					
					d3.select("#tip-"+type)
							.style("left", x+"px")
							.style("top", 12+"px" )
							.html(html);						
						
					d3.selectAll(".tipcircle").attr("opacity", 1);			
				    d3.select("#tip-"+type).style("visibility","visible");	
				    
			    	
			    }else{
			    	d3.selectAll(".tipcircle").attr("opacity", 0.001);						
				    d3.selectAll(".tipdiv").style("visibility","hidden");			    	
			    }    
			 }else{ // no data
				 d3.selectAll(".tipcircle").attr("opacity", 0.001);	
				 d3.select("#tip-"+type).style("visibility","hidden");		 
			 }		
		});		
	})
	.on("mouseout", function(){
	})
	.on("mouseover",function(d){
		d3.select("#tipdate").style("visibility","visible");	
		d3.select("#tiplilne").style("visibility","visible");	
		
	});	
	
}


