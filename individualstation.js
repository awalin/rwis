var observationTypes=[];
var firsttime=[];

function getStationData(stationId, starttime, endtime, stationOnly){	//also pass the yScale
	var station = new Array();	
	station.push(stationId); //stationid;	
	var start = new Date(starttime);
	var end = new Date(endtime);

	var parameters = {
			startTime: format(start),
			stationID: station,
			endTime:   format(end),
			obs: observationTypes
	};
	parameters = JSON.stringify(parameters);
	var parameters = {
			startTime: format(start),
			stationID: station,
			endTime:   format(end),
			obs: observationTypes
	};
	parameters = JSON.stringify(parameters);

	$.ajaxSetup({    	
		crossDomain: false, // obviates need for sameOrigin test        
		beforeSend: function(xhr, settings) {  
			if (!csrfSafeMethod(settings.type)) {
				xhr.setRequestHeader("X-CSRFToken", csrftoken);
			}
			$("#loading").html("Loading observations for the selected stations");
			$('#loading').show();
		},
		complete: function(){ 			
			d3.select("#loading").transition().duration(300)
			.each('end', function(){
				$('#loading').hide();	
			});    	
		}        
	});  

	return $.ajax({
		type : 'POST',
		url : '/observe/',
		data : parameters,
		contentType: 'application/json; charset=utf-8',
		cache : false,          
		success : function(data) {
			timelineDataAll[""+stationId]=[];	
			data.forEach(function(d, i){//for each station	
				parseDates(d.rows);				
				timelineDataAll[""+stationId][""+d.type] = data[i];	
			});			

			populatedIDs[""+stationId]= true;
			if(stationOnly==true){
				drawStationOnly(stationId);
				if(firsttime[""+stationId]==true){
					firsttime[""+stationId]=false;					
				}
			}
		},
		error : function() {
			$('#loading').hide();   
			populatedIDs[""+stationId]= false;
			console.log('Error loading observations');
		}
	});
}


function getStationDataOnDrag(stationId, starttime, endtime){	//also pass the yScale
	var station = new Array();	
	station.push(stationId); //stationid;	
	var start = new Date(starttime);
	var end = new Date(endtime);

	var parameters = {
			startTime: format(start),
			stationID: station,
			endTime:   format(end),
			obs: observationTypes
	};
	parameters = JSON.stringify(parameters);

	$.ajaxSetup({    	
		crossDomain: false, // obviates need for sameOrigin test        
		beforeSend: function(xhr, settings) {  
			if (!csrfSafeMethod(settings.type)) {
				xhr.setRequestHeader("X-CSRFToken", csrftoken);
			}
//			$('#loading').show();
		},
		complete: function(){ 		
		}        
	});  

	return $.ajax({
		type : 'POST',
		url : '/observe/',
		data : parameters,
		contentType: 'application/json; charset=utf-8',
		cache : false,          
		success : function(data) {
//			console.log("success for "+ stationId);
//			parseDates(data);
			data.forEach(function(d){//for each station		
//				console.log(d.rows);
				parseDates(d.rows);				
			});		
//			console.log("query success drag with station "+stationId);
			mergeDataAfterDrag(data, stationId);			
			populatedIDs[""+stationId]= true;

		},
		error : function() {
			$('#loading').hide();   
			populatedIDs[""+stationId]= false;
			console.log('Error loading observations');
		}
	});
}


//draw only the stations
function drawStationOnly(stn){	//draw data from just one station, in each type
	
	var datastn =  timelineDataAll[""+stn];
	var keys=_.keys(selectedIDs);
	keys.reverse();	
	observationTypes.forEach(function(d){
		// the axis is always global, though sometimes we may need to draw only part of the line	
		var type= d.observation_type;
		var id = "#chart-" + type;
		var data = datastn[type].rows;
		
		var title = Stockpile.meta.obsType[type];
		if(title.metric==null){
			var unit = metric="";
		}else {
			var unit = " ("+title.metric+")";
		}
		var yMax = -Number.MIN_VALUE;
		var yMin = Number.MAX_VALUE;
//		console.log("first time in indiv points to draw = "+ data.length);
		if(timelineDataAll["all"][type].rows.length<=0){
			return;}		
		else{					
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
			var pathid ="stp"+type+"-"+stn;

			if(firsttime[""+stn]==true){
				d3.select(id)
				.insert("svg:path",".y.axis")
				.attr("class","line")
				.attr("id",pathid)
				.attr("clip-path", "url(#clip)")					
				.attr("d",function(){ 					
					line.y(function(d) { return yScale(d.metric_value); });					
					return line(data, function(d){ return xScale(d.tstamp) ;}) } )
				
			.attr("stroke", stationColors[""+stn])//change it to color from color picker
			.attr("opacity", 1);				
			}
			else{
				d3.select(id)
				.select("#"+pathid)	
				.attr("opacity", 1)	
				.attr("d",function(){ 					
					line.y(function(d) { return yScale(d.metric_value); });					
					return line(data, function(d){ return xScale(d.tstamp) ;}) } );					

			}
		}		
	});
	
	renderTooltip();
}


//some utility functions, will move to another file later

//parses the date-strings as java script date objects
function parseDates(data){ 
//	console.log(data);	
	var rows = data;
	if(rows.length<=0){return;}
	rows.forEach(function(d){
		d.tstamp = parse(d.tstamp);
//		console.log(d.tstamp);
	});		
}

function sortDates(dataToSortbyDate){
	var timelineData = dataToSortbyDate;
	timelineData.sort(function(a, b){
		return d3.ascending(a.tstamp, b.tstamp);
	});
}

function mergeDataAfterDrag(data, stationId){	
	data.forEach(function(d){		//for each obs type
		var rows =  d.rows;	   
		var type= d.type;
		if(rows.length>=0){
			rows.forEach(function(d){				
				timelineDataAll[stationId][type].rows.push(d);
			});
		}//if length gt zero
	});	

	timelineDataAll[stationId].forEach(function(data){//for each type		
		sortDates(data.rows);					
	});	

}

function makeCalendar(){	 
	
	$("#date-form").dialog({
//		dialogClass: "no-close",
		autoOpen: false,
		resizable: false,
		position:  [right, bottom],			 
		show: {
	        effect: "slide",
	        direction: 'right',
	        duration: 300
	      }
	});
	
	 var right = $(window).width() -( $(window).width() - $("#date-icon").offset().left + 402 ) ;
	 var bottom = $(window).height() - 240 -25;
	
	$("#date-form").dialog({
		position:  [right, bottom]
	});
	
	$('#date-form').dialog('widget').attr("id","datemodal");	
		

	$("#date-icon").click(function(){
		$( "#datePicker-end" ).datepicker({
			dateFormat: "yy-mm-dd",
			defaultDate: format(new Date(enddate)),			
			beforeShow: function(input, inst) {
				var widget = $(inst).datepicker('widget');
				var top = $(widget).outerHeight()+$(input).outerHeight();
				var right = $(input).outerWidth() - widget.outerWidth();
				widget.css( 'left-margin', right);
				widget.css( 'top-margin', -top);
				
			}
		});	 

		$( "#datePicker-end" ).datepicker( "setDate",  format(xScale.domain()[1]) );

		$( "#datePicker-start" ).datepicker({
			dateFormat: "yy-mm-dd",
			defaultDate: format(new Date(startdate)),
			onSelect: function() { // beacause the next date picker opens and closed right after that
				window.setTimeout($.proxy(function() {
				        	$( "#datePicker-end" ).focus();
				} , this), 10);  },
			beforeShow: function(input, inst) {
				var widget = $(inst).datepicker('widget');
				var top = $(widget).outerHeight()+$(input).outerHeight();
				var right = $(input).outerWidth() - widget.outerWidth();
				widget.css( 'left-margin', right);
				widget.css( 'top-margin', -top);				
			}
		});
		
		$( "#datePicker-start" ).datepicker( "setDate",  format(xScale.domain()[0]) );		

		$("#date-form").dialog( "open" );	
		
	});


	d3.select("#dated-data")
	.on("click", function(){					 
		var end = $( "#datePicker-end" ).datepicker('getDate');
		enddate = +end;

		var start = $( "#datePicker-start" ).datepicker('getDate');
		startdate = +start;  	 

		if(startdate>=enddate){
			alert("please select valid date range, your start date is greater than the end date");
		}

		else {
			$("#date-form").dialog('close');	
			getTimedData(startdate, enddate);	//also set the starting date , overload the function			  
		}
	});
}
