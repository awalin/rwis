//the view component
function Timeline(){
	this.colorScale = d3.scale.ordinal().range(d3.scale.category10().range());
	this.xScale = d3.time.scale();
	this.xAxis = d3.svg.axis().ticks(15).tickSubdivide(true).orient("top");// tickPaddin(10).tickSize(6,2,)	
	this.stationColors = new Array();
	this.xWidth;
	
	this.nformat = d3.format("3,.2g");
	this.bisectDate = d3.bisector(function(d) { return d.tstamp; }).left;
	this.interval = 15*60*1000;
	
	this.aspectRatio;
	this.currentExtent;	
	this.firsttime = [];
	this.yScale = [];
	this.selectedIDs = new Array(); // list of selected stations, value true or false, if all false, then no station is highlighted in time line, fixed size, indexed by station id
	
	this.margin = {
		    top: 10,
		    left: 35,
		    bottom: 5,
		    right: 18}, 
	//the margin array for the main svg container
	this.width;
	this.height = 800 - this.margin.top - this.margin.bottom;
	this.eachHeight = 70; //height of each timeline	, can be parameterized.
	this.zoomBehaviour;
	//html elements
	this.svgparent = d3.select("#parent");
	this.pleft = $("#parent").offset().left;
	this.$loading = $('#loading');
	

	this.line = d3.svg.line()
	.interpolate("linear")
	.x(function(d) { return this.xScale(d.tstamp); });
	
	this.observations;
		

};

/*
 * creating zoom behaviour
 */
Timeline.prototype.initZoom = function(){	

	var curObject = this;
	
	this.zoomBehaviour = d3.behavior.zoom()
	.scaleExtent([1,20]) 	
	.on("zoom", function(){				
		var tx = d3.select(".x.axis").call(curObject.xAxis)
		.selectAll("text") 
		.attr("transform", function(d, i){
			if(d.getHours()==0){
				return "translate(0, -6)" 
			}
		});			
		if(d3.event.sourceEvent.type =='wheel' || d3.event.sourceEvent.type =='DOMMouseScroll'){			
//			console.log(d3.event.sourceEvent.type);
			if(curObject.zoomBehaviour.scale()!=1){
				curObject.drawLines(curObject.observations.timelineDataAll, true, false);//zoom on wheel
			} 	
		}else  {			
//			console.log(d3.event.sourceEvent.type);
			curObject.drawLines(curObject.observations.timelineDataAll, false);	//drag on pan				
		}		
//		curObject.lastZoomLevel = d3.event.scale;
	})
	.on("zoomend", function(){
		curObject.renderTooltip();	
		if(d3.event.sourceEvent != null ){				
	         if( d3.event.sourceEvent.type =='mouseup' ){	
	        	 curObject.changeAfterDrag();			
//	        	 console.log("drag only");
	         }
	   } else {//zoom
       	 curObject.currentExtent = curObject.xAxis.scale().domain(); //extent of x axis // curObject.xScale.domain();
//       	 console.log("zoom end "+curObject.currentExtent );
        }
//		curObject.currentZoomLevel =  curObject.lastZoomLevel ;
	})
	.on("zoomstart", function(){
		curObject.disableTooltip();	          	 
//		curObject.currentExtent = curObject.xAxis.scale().domain(); //extent of x axis // curObject.xScale.domain();
		d3.event.sourceEvent.stopPropagation(); // silence other listeners		

	});	
};



Timeline.prototype.init = function (station_ids) {	
	
	this.observations = new Observations();	//the model
	
	$(".manager").empty();
	//should be iteration of selection	
	var anchorElem = document.createElement('a');	
	anchorElem.innerHTML = "stations";	 
	$(".manager").append(anchorElem);// will move to another function later

	d3.select("#analyzeContainer").style("visibility","visible");		
	this.$loading.hide();		
	$("#date-form").hide();//initially hide, show if icon is clicked
	//empty the containers in case something was drawn before
	this.svgparent.html("");		
	$("#xAxis .series").html("");
	d3.select("#analyzeContainer").style("visibility","visible");
	this.$loading.hide();	
	$("#date-form").hide();//initially hide, show if icon is clicked
	
	var station_id = new Array();
	station_id.push(2866); //station_id;
	station_id.push(2867);
	this.observations.init(station_id, this);		
	station_id.push("all");	
	this.colorScale.domain(station_id);
	
	var curObject = this;	
	station_id.forEach(function(d){		 
		curObject.selectedIDs[""+d] = false;
		curObject.stationColors[""+d]= curObject.colorScale(""+d);			
	});	
	curObject.selectedIDs["all"] = true;
	
	d3.select("#timeline-axis").style("visibility","visible");	
	this.prepScale();
	this.drawXAxis();
	//TODO::
	this.drawIncidentTimeline();	//have error in get map bounds
	
	d3.select(".date-picker").style("visibility","visible");
	d3.select("#timeline").style("visibility","visible");
	this.prepCanvas();	
	
	this.observations.getTimelineData();
};

Timeline.prototype.error = function() {
	
	this.svgparent
	.append("svg:rect")
	.attr("class","nodata")
	.attr("x",0)
	.attr("y", 0)
	.attr("width", this.xWidth)
	.attr("height", this.height)
	.append("text")
	.attr("class","warning").text("no data for this timeframe");
	
	
};

/***
 * get remaining data after dragging the timeline
 */	
Timeline.prototype.changeAfterDrag = function() {
	
	var newExtent = this.xAxis.scale().domain(); // new domain of x scale 	
	
	console.log(this.currentExtent );
	console.log(this.xScale.domain() );
	console.log(newExtent);
	
	if(newExtent[0] > this.currentExtent[0]){
		var dragright = true;
//		console.log("right");
		var finish = newExtent[1];
		var begin = this.currentExtent[1];    	
	}else{
//		console.log("left");
		var begin = newExtent[0];
		var finish = this.currentExtent[0];    
	}
	console.log(begin);
	console.log(finish);
	
	this.currentExtent = newExtent;			
	this.observations.filterRemainingandGetNewData(newExtent, begin, finish);
	this.renderTooltip();
};


Timeline.prototype.drawAfterDateChange = function(dataToDraw){
	
	var curObject = this;
	curObject.prepScale();	
	
	curObject.xAxis.scale(curObject.xScale);	
	curObject.zoomBehaviour.x(curObject.xScale); //resetting the scale of the zoom level
	
	var tx = d3.select(".x.axis").call(curObject.xAxis);			
	curObject.$loading.hide();	
	curObject.drawLines(dataToDraw, true, false);

};

/***
 * before drawing the time series
 * prepare the x axis, date picker
 */


Timeline.prototype.prepCanvas = function() {

	var curObject = this;
	curObject.makeCalendar();   

	//make charts rearrangeable
    var width= $("#timeline").width();
	
	$("#parent").sortable({ 
				axis: "y",				
				delay:300,
				revert: true,
				forcePlaceholderSize: true,
				handle:".dragicon", // move only using the drag icon
				placeholder: "ui-sortable-placeholder",
				containment:"parent",
				scroll:true,
				start: function( event, ui ) {		
					if(ui.item.attr("id")=="tipline"){
						console.log("line, so nothing");
						return;			
					}
					
					$( "#parent" ).sortable( "option", "cursor", "move" );
					curObject.disableTooltip();			
				},	
				stop: function( event, ui ) {				            	
					d3.selectAll(".tipcircle").attr("opacity",1);										
					curObject.renderTooltip();						
				}
			});
	
	$("#parent").disableSelection();
		
	//resizing window
	$(window).on("resize", function(){
		$("#parent .svg-container").each(function(){			
			var parentWidth = $("#xAxis .series").width();
			var w = parentWidth;
			var h = w/curObject.aspectRatio;	
			d3.select(this).attr("width", w);
			d3.select(this).attr("height", h);	
		});

		$("#xAxis .svg-container").each(function(){
			var container = $(this).parent();
			var parentWidth = $("#xAxis .series").width();
			var w = parentWidth;	  	
			var h = Math.max(25,curObject.margin.top+curObject.margin.bottom);

			d3.select(this).attr("width", w);
			d3.select(this).attr("height", h);				
			d3.select(".x.axis").call(curObject.xAxis);
		});

	}).trigger("resize");

	curObject.createStationList();
};


//preparing the extent of x- axis based on the query start and end date
Timeline.prototype.prepScale = function(){	

	var xMax = new Date(this.observations.enddate);
	var xMin = new Date(this.observations.startdate);		 
	this.xScale.domain([xMin, xMax]);	
	this.currentExtent = this.xScale.domain();	

};


Timeline.prototype.showMultipleLoading = function(begin, finish){
	
	console.log(begin);
	console.log(finish);
	
	var xstart = this.xScale(new Date(begin));
	var xend = this.xScale(new Date(finish));	
	var rwidth = xend - xstart - 4;
	var left = xstart + this.margin.left+4;
	var top = this.margin.top+20;
	
	var curObject = this;	
	//show multiple loading, one in each timeline
	d3.select("#parent").selectAll(".series")
	.insert("div", function(d,i){ return "#frame-"+i;})		// or append?	  
	.attr("class","load")
	.html("<span class='label'>Loading new observations</span>")
	.style("width", rwidth+"px")
	.style("height", curObject.eachHeight+"px")
	.style("left",left+"px" )
	.style("top", top+"px");
	
	
	
};

Timeline.prototype.drawXAxis = function() {

	var xaxis= d3.select("#xAxis .series");	
	var parentWidth = $("#xAxis .series").width();
	this.xWidth = parentWidth - this.margin.left -this.margin.right;		

	this.xScale.range([0, this.xWidth]);
	this.xAxis.scale(this.xScale);

	this.currentExtent = this.xScale.domain();
	var h = Math.max(25, this.margin.top + this.margin.bottom);

	this.initZoom();
	this.zoomBehaviour.x(this.xScale); //setting the scale of the zoom level
	
//	this.initDrag();	
	var shift = h-2;

	xaxis
	.append("svg:svg").attr("class","svg-container")
	.attr("width", parentWidth)
	.attr("height", h )     
	.attr("viewBox","0 0 "+parentWidth+" "+ h+" ")
	.attr("preserveAspectRatio", "none")
	.append("svg:g")
	.attr("transform", "translate(" + this.margin.left + "," + shift + ")")	      
	.attr("class", "x axis")
	.call(this.xAxis)
	.selectAll("text")  
	.attr("transform", function(d, i){
		if(d.getHours()==0){
			return "translate(0, -6)" 
		}
	});    

	//adding zoom behavior	
	xaxis.call(this.zoomBehaviour);
};

Timeline.prototype.wrapUpDrawing = function(){	
  	
	this.drawTimeSeries(this.observations.timelineDataAll["all"]);
};

/**
 * drawing the aggregated time serieses for the first time
 */

Timeline.prototype.drawTimeSeries = function(data) {
	
	var curObject = this;
	var w = curObject.xWidth + curObject.margin.left + curObject.margin.right;
	var h = curObject.eachHeight + curObject.margin.top + curObject.margin.bottom;
	this.aspectRatio = w/h;     
//	now draw each timeline     
	data.forEach(function(d,i){
		var timelineData = d.rows;		
		var title = Stockpile.meta.obsType[d.type];
		var pathid ="stp"+d.type+"-"+"all";
		var type = d.type;

		curObject.yScale[type] = d3.scale.linear()
		.domain([-1000, 1000]).nice()
		.rangeRound([curObject.eachHeight, 0]).nice();
		//need to remove the previous timelines on arrival to the page

		//need to remove the previous timelines on arrival to the page
		var div1 = curObject.svgparent.append("div")
		.attr("class","series  ui-state-default");

		if(title.metric==null){
			var unit = metric="";
		}else {
			var unit = "("+title.metric+")";
		}
		div1.append("div").attr("class","dragicon");

		div1.append("div").attr("class","title")
		.html("<h4>"+title.description
				+ unit
				+"</h4>");

		var id = "chart-"+d.type;		

		var g1= div1.append("div")
		.attr("id","frame-"+d.type)	   
		.append("svg:svg")
		.attr("class","svg-container")
		.attr("width", w)
		.attr("height", h)
		.attr("viewBox","0 0 "+w+" "+ h+" ")
		.attr("preserveAspectRatio", "xMidYMid")			
		.append("g")
		.attr("id",id)
		.attr("transform", "translate(" + curObject.margin.left + ","+curObject.margin.top+")");		
		
		// Add the x-axis line
		g1.append("svg:rect")
		.attr("class","rect")
		.attr("x", 0)
		.attr( "y", curObject.eachHeight)
		.attr ("width", curObject.xWidth)
		.attr("height",0.5);
		
		// Add the y-axis line
		g1.append("svg:rect")
		.attr("class","rect")
		.attr("x", -2 )
		.attr( "y", 0)
		.attr ("width", 0.5 )
		.attr("height", curObject.eachHeight);
		
		// Add the clip path.
		g1.append("svg:clipPath")
		.attr("id", "clip-"+type)
		.append("svg:rect")
		.attr("x", 0)
		.attr( "y", -15)
		.attr("width", curObject.xWidth)
		.attr("height", curObject.eachHeight+15);
		
		//this part is for it to work in IE8 properly, shows black background
		g1.append("svg:g").attr("class","chartplace")
		.append("svg:rect")
		.attr("class","nodata")
		.attr("x",0)
		.attr("y", -15)
		.attr("width", curObject.xWidth)
		.attr("height", curObject.eachHeight+15);

		if(timelineData.length>0){			
			//now dyamic elements
			var yMax = d3.max( timelineData, function(d) { return d.metric_value; });
			var yMin = d3.min( timelineData, function(d) { return d.metric_value; });	 


			// Add the y-axis.
			curObject.yScale[type].domain([yMin, yMax]).nice();
			var yAxis = d3.svg.axis().scale(curObject.yScale[type]).ticks(6).orient("left");
			
			g1.append("svg:g")
			.attr("class", "y axis")
			.attr("transform", "translate(-2, 0)")	      
			.call(yAxis);
			
			var strokes =  g1.select(".chartplace")		
			.attr("clip-path", "url(#clip-"+type+")")
			.append("svg:path")
			.attr("class","line")
			.attr("id",pathid)
//			.attr("clip-path", "url(#clip-"+type+")") // where should I actually add the clip path
			.attr("stroke", curObject.colorScale("all"))
			.attr("d", function( ){ 
				curObject.line.y(function(d) { 
					return curObject.yScale[type](d.metric_value); });
				return curObject.line(timelineData,function(d){return curObject.xScale(d.tstamp);}) }); 
			
			d3.select("#chart-"+type)
			.select(".chartplace")		
				.append("circle")
				.attr("class","tipcircle")
				.attr("id","tipcircle-"+type)
				.attr("cx",0)
				.attr("cy",0)
				.attr("r",0)
				.attr("stroke", curObject.stationColors["all"])
				.attr("opacity", 0.001);
		
		} else {
//			console.log("no data returned from database for this type of observation in this time frame");	 
			g1
			.select(".chartplace")		
			.append("text")
			.attr("class","warning")
			.attr("transform", "translate(" + 
					curObject.margin.left + ","+ curObject.margin.top+")")			
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
			
	d3.select("#timeline").append("hr")
			.attr("class","tooltipline")
			.attr("id","tipline")
			.attr("width",1)
			.attr("size", h)
			.style("height",h+"px")	
			.style("left","0px");	
			
	d3.select("#timeline")
			.append("div")
			.attr("id","tipdate")	
			.html("");
			
			
	d3.selectAll(".series")
			.on("mouseover", function(){			
				d3.select(this).select(".dragicon").style("visibility","visible");
			})
			.on("mousemove", function(){			
				d3.select(this).select(".dragicon").style("visibility","visible");
			})
			.on("mouseout", function(){
				d3.select(this).select(".dragicon").style("visibility","hidden");
			});
			
			
   curObject.renderTooltip();
};


/**
 * draw only the stations, keep it in view/ui component.
 **/

Timeline.prototype.drawStationOnly = function (stn){	//draw data from just one station, in each type 
    var curObject = this;
	var datastn =  curObject.observations.timelineDataAll[""+stn];
	var keys=_.keys(curObject.selectedIDs);
	keys.reverse();	
	
	curObject.observations.observationTypes.forEach(function(d){
		// the axis is always global, though sometimes we may need to draw only part of the line	
		var type= d.observation_type;
		var id = "#chart-" + type;
		var data = datastn[type].rows;
		var yMax = -Number.MIN_VALUE;
		var yMin = Number.MAX_VALUE;
		if(curObject.observations.timelineDataAll["all"][type].rows.length<=0){
			return;}		
		else{					
			keys.forEach(function(value){	
				var curr_station=value;
				if( curObject.selectedIDs[curr_station]==true && 
						curObject.observations.populatedIDs[curr_station]==true){//visible and has data					
					var rows = curObject.observations.timelineDataAll[curr_station][type].rows;//all data
					yMax= d3.max([yMax, d3.max( rows, function(d) { return d.metric_value; })]);
					yMin= d3.min([yMin, d3.min( rows, function(d) { return d.metric_value; })]);
				}				
			});	

			curObject.yScale[type].domain([yMin, yMax]).nice();		
			
			var pathid ="stp"+type+"-"+stn;

			if(curObject.firsttime[""+stn]==true){
				d3.select(id)
				.select(".chartplace")		
				.insert("svg:path",".y.axis")
				.attr("class","line")
				.attr("id",pathid)									
				.attr("d",function(){ 					
					curObject.line.y(function(d) { return curObject.yScale[type](d.metric_value); });					
					return curObject.line(data, function(d){ return curObject.xScale(d.tstamp) ;}) } )
					.attr("stroke", curObject.stationColors[""+stn])//change it to color from color picker
					.attr("opacity", 1);				
			}
			else{
				d3.select(id)
				.select(".chartplace")		
				.select("#"+pathid)	
				.attr("opacity", 1)	
				.attr("d",function(){ 					
					curObject.line.y(function(d) { return curObject.yScale[type](d.metric_value); });					
					return curObject.line(data, function(d){ return curObject.xScale(d.tstamp) ;}) } );					

			}
		}		
	});
	
	curObject.renderTooltip();
};


///move to data class
Timeline.prototype.mergeDataAfterDrag = function(data, stationId){	
	var curObject = this;
	data.forEach(function(d){		//for each obs type
		var rows =  d.rows;	   
		var type= d.type;
		if(rows.length>=0){
			rows.forEach(function(d){				
				curObject.timelineDataAll[stationId][type].rows.push(d);
			});
		}//if length gt zero
	});	

	curObject.timelineDataAll[stationId].forEach(function(data){//for each type		
		curObject.observations.sortDates(data.rows);					
	});	

};

/**
 * drawing the timelines
 * keep in UI class file
 */
Timeline.prototype.drawLines = function drawLines(dataToDraw, redrawaxis, rest){	

	var curObject = this;
	var dataToDraw = dataToDraw;		
	var keys = _.keys( curObject.selectedIDs);
	keys.reverse();
	d3.selectAll(".warning").remove();

	curObject.observations.observationTypes.forEach(function(d, i){			
		// the axis is always global, though sometimes we may need to draw only part of the line
		var yMax = -Number.MIN_VALUE;
		var yMin = Number.MAX_VALUE;
		var type = d.observation_type;
		var id = "#chart-" + type;
//		var title = Stockpile.meta.obsType[d.title];

		var chart = d3.select("#frame-"+type);	
//		console.log("points to draw = "+ data.length);
		d3.select(".x.axis").selectAll("text") 
		.attr("transform", function(d){
//			console.log(d);
			if(d.getHours()==0){
				return "translate(0, -6)";}
		});

      if(curObject.observations.timelineDataAll["all"][type].rows.length<=0){	
			
			d3.select(id)
			.select(".chartplace")		
			.append("rect")
			.attr("class","nodata")
			.attr("width", curObject.xWidth)
			.attr("height", curObject.eachHeight)
			.attr("x", 0)
			.attr("y", -15);

			d3.select(id)
			.select(".chartplace")		
			.append("text")
			.attr("class","warning")
			.attr("transform", "translate(" + curObject.margin.left + ","+curObject.margin.top+")")				
			.text("No data for this time frame");
			return;
		}else{ // data is not empty	
			keys.forEach(function(value){	
				var curr_station = ""+value;					
				if(  curObject.selectedIDs[curr_station]==true &&  
						curObject.observations.populatedIDs[curr_station]==true){//visible and has data					
					var rows =  curObject.observations.timelineDataAll[curr_station][type].rows;//all data
					yMax= d3.max([yMax, d3.max( rows, function(d) { return d.metric_value; })]);
					yMin= d3.min([yMin, d3.min( rows, function(d) { return d.metric_value; })]);
				}				
			});

			curObject.yScale[type].domain([yMin, yMax]).nice();			

			var yAxis = d3.svg.axis().scale(curObject.yScale[type]).ticks(6).orient("left");
			// for each station or all, d = datatoDraw["all"] or datatToDraw["station"]					
			if(rest==true) {		//draw remaining data and whole data with staged animation				
				var y = chart.select(".y.axis")
				.transition().duration(500)
				.call(yAxis);			

				y.each("end", function(){					
					var t = d3.select(id)
					.select(".chartplace")		
					.selectAll(".line") 			        
					.transition().duration(500).delay(400)
					.attr("d",function(d, i2){//i=type, i2= station serial or all, aka index of the line in this obs type	
						var station = ""+keys[i2];							
						curObject.line.y(function(d) { 
							return curObject.yScale[type](d.metric_value); });					
						if(curObject.selectedIDs[station]==true)
							return curObject.line(dataToDraw[station][type].rows, function(d){ return curObject.xScale(d.tstamp) ;}) } );			
					//now everything
//					console.log("now drawing the all");
					t.each("end", function(d,i2){
						var station = ""+keys[i2];
						d3.select(this)
						.attr("d", function(d){
							curObject.line.y(function(d) { return curObject.yScale[type](d.metric_value); });	
							if(curObject.selectedIDs[station]==true)
								return curObject.line( curObject.observations.timelineDataAll[station][type].rows, function(d){ 
									return curObject.xScale( d.tstamp) ;}); 

						});
					});
				});//each of trans y
			}else { //calendar or on drag, drawing in one stage 			
				d3.select(id)
				.select(".chartplace")		
				.selectAll(".line")										
				.attr("d", function(d, i2){
					var station = ""+keys[i2];
					curObject.line.y(function(d) { return curObject.yScale[type](d.metric_value); });		
					if(curObject.selectedIDs[station]==true)
						return curObject.line( curObject.observations.timelineDataAll[station][type].rows, 
							function(d){ return curObject.xScale( d.tstamp) ;}) 
				});

				if(redrawaxis==true){ //redraw axis					
//					console.log("drawing axis, no animation in timeline");
					chart.select(".y.axis").transition().duration().delay().call(yAxis);				
				}			
			} // end of drag, calendar
		}//data not empty end		
	});//end of for each obs type
};


/**
 * creating the date pickers
 */
Timeline.prototype.makeCalendar = function (){
	
	var timeline= this;

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
			defaultDate: timeline.observations.format(new Date(timeline.xScale.domain()[1])),
			beforeShow: function(input, inst) {
				var widget = $(inst).datepicker('widget');
				var top = $(widget).outerHeight()+$(input).outerHeight();
				var right = $(input).outerWidth() - widget.outerWidth();
				widget.css( 'left-margin', right);
				widget.css( 'top-margin', -top);
			}
		});	 

		$( "#datePicker-end" ).datepicker( "setDate",  timeline.observations.format(timeline.xScale.domain()[1]) );

		$( "#datePicker-start" ).datepicker({
			dateFormat: "yy-mm-dd",
			defaultDate: timeline.observations.format(new Date(timeline.xScale.domain()[0])),
			onSelect: function() {
				$( "#datePicker-end" ).datepicker('widget').focus(); 
			},

			beforeShow: function(input, inst) {
				var widget = $(inst).datepicker('widget');
				var top = $(widget).outerHeight()+$(input).outerHeight();
				var right = $(input).outerWidth() - widget.outerWidth();
				widget.css( 'left-margin', right);
				widget.css( 'top-margin', -top);
			}
		});
		$( "#datePicker-start" ).datepicker( "setDate",  timeline.observations.format( timeline.xScale.domain()[0]) );

		$("#date-form").dialog( "open" );	
	});


	d3.select("#dated-data")
	.on("click", function(){				 
		var end = $( "#datePicker-end" ).datepicker('getDate');		
		var start = $( "#datePicker-start" ).datepicker('getDate');
		
		if( (+start) >= (+end)){
			alert("please select valid date range, your start date is greater than the end date");
		}

		else {
			$("#date-form").dialog('close');			
			
			timeline.disableTooltip();
			
			if( (timeline.observations.enddate> +end) && (timeline.observations.startDate< +start) ){
				timeline.observations.enddate = +end;
				timeline.observations.startdate = +start;
				timeline.drawAfterDateChange(timeline.observations.timelineDataAll);	
				return;// it is like zooming
				// no need to fetch new data. just redraw				
			}else {
				timeline.observations.getTimedData(start, end);				
				timeline.prepScale();			
				timeline.xAxis.scale(timeline.xScale);	   				  	
				var tx = d3.select(".x.axis").call(timeline.xAxis);			
			}				  
			timeline.renderTooltip();
		}
	});
};



/**
 * @param this.timeline the this.timeline object
 */		
Timeline.prototype.createStationList = function(){	
	var timeline = this;
	
	$(".manager a").click(function(e){
		
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
		timeline.stationColors['all'] = timeline.colorScale("all");
		tabheader.append(
				$(document.createElement('input'))
				.attr({	
					id: 'color-all',						
					name: 'colorpicker'
				})
				.data("station", "all")			//"all" should be parameterized
				.prop( "disabled", false)//enable by default
		);
		
		if(timeline.stationColors["all"]==null){
			timeline.stationColors["all"] = timeline.colorScale("all");			
		}

		tabheader.append(
				$(document.createElement('input'))
				.attr({
					id:    'hidden-all',	
					value:	timeline.stationColors['all'],						
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

		timeline.observations.stationID.forEach(function(d,i){		
			timeline.firsttime[""+d]=true;		
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
						value:	timeline.stationColors[d],						
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
			timeline.stationColors[curr_station]="#"+inputVal;	

			timeline.observations.observationTypes.forEach(function(d){
				var type= d.observation_type;
				var id = "#chart-" + type;							
				var pathid ="#stp"+type+"-"+curr_station;
				d3.select(id)
				.select(pathid)
				.attr("stroke", timeline.stationColors[curr_station]);		
			});				
		});	

		$( "#station_ids input[name='colorpicker']" ).each(function(){
			var input = $(this);		
			input.addClass("colorPicker-disable");	
		});	

		$( "#station_ids button" ).each(function(){				
				var input = $(this);			
				var curr_station = ""+input.data("station");				
				if( timeline.selectedIDs[curr_station]==true){ 
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
						timeline.selectedIDs[curr_station]=false;						
						//make this.timeline invisible	
						timeline.observations.observationTypes.forEach(function(d){
							var type= d.observation_type;
							var id = "#chart-" + type;	
							if(timeline.observations.populatedIDs[curr_station]==true){//has data, so make invisible
								d3.select(id)
								.select("#stp"+type+"-"+curr_station)
								.attr("opacity", 0);	
							}		
						}); 	
					} else {//show them
						$input.removeClass("off").addClass("on");	
						timeline.selectedIDs[curr_station]=true;
						$("#color-"+curr_station).prop( "disabled", false );//enable color picker
						$("#color-"+curr_station).removeClass("colorPicker-disable");

						if(timeline.observations.populatedIDs[curr_station]==false){
							timeline.observations.startdate = +(timeline.xScale.domain()[0]);//update start time, up to milliseconds	
							timeline.observations.getStationData(curr_station, true);								
						}else{//already populated, make it visible
							timeline.observations.observationTypes.forEach(function(d){
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
};




Timeline.prototype.renderTooltip = function(){    

	d3.select("#tipline").style("visibility", "visible");	
	
	$( "#tipline").unbind( "click" );
	var timeline = this; 
	
	d3.selectAll(".nodata")
	.on("mousemove", function(){		
		var eventthis = this;		
		var x0 = timeline.xScale.invert(d3.mouse(this)[0]);		
		var index = parseInt( (+x0-(+timeline.xScale.domain()[0])) /(timeline.interval));
		//if zoom applied, start index can be different from xSaxis start date
		var startindex = parseInt( (+timeline.xScale.domain()[0] - timeline.observations.startdate ) /timeline.interval);
		var endindex = parseInt( (+timeline.xScale.domain()[1] - timeline.observations.startdate) /timeline.interval) ;
			
		var tooltipdate = +timeline.xScale.domain()[0]+(index*timeline.interval);
		x0 = new Date(tooltipdate);
		
		var x = d3.event.pageX-timeline.pleft+0.5;		
		d3.select("#tipline")
		.style("left", x+"px" ); 
		
		d3.select("#tipdate")
		.style("left",  (d3.event.pageX)+"px" )
		.html(timeline.observations.format(x0)); 	
		
		timeline.observations.observationTypes.forEach(function(d){		//for each type
			
			var type = d.observation_type;			
			
			if( timeline.observations.timelineDataAll["all"][type].rows.length>0 ){				

				if( endindex > timeline.observations.timelineDataAll["all"][type].rows.length-1 ){
					endindex = timeline.observations.timelineDataAll["all"][type].rows.length-1;					
				}
				var arr = timeline.observations.timelineDataAll["all"][type].rows.slice(startindex, endindex);//the data in view now	
							
				var i = timeline.bisectDate(arr, x0);//low, high end of the array
				
				if(i<1){ 
					return;
				}

				var dp;
			    var d0 = arr[i - 1];
			    var d1 = arr[i];
			    //check null
			    if(!d0 || !d1){
			    	return;
			    	
			    }
			   
			    if( (x0 - d0.tstamp) > (d1.tstamp - x0)  ){
			    	dp = d1;		    	
			    }else {
			    	dp = d0;
			    }
			    
			    
			    if( Math.abs(dp.tstamp-x0) <=  timeline.interval )    {			    	
			    	
			    	if(Stockpile.meta.obsType[type].metric==null){
						var unit1 = "";
			    	}else {
						var unit1 = " ("+Stockpile.meta.obsType[type].metric+")";
			    	}			    	
			    	
			    	var yval = dp.metric_value;			    	
					var cy = timeline.yScale[type](yval);
					var cx = timeline.xScale(dp.tstamp);		
					
					d3.select("#chart-"+type)
					.select(".tipcircle")
					.attr("cx",cx)
					.attr("cy",cy)
					.attr("r", 4)
					.attr("stroke", timeline.stationColors["all"])
					.attr("opacity", 0.001);
					
					var html = timeline.nformat(yval)+""+unit1;
					
					timeline.observations.stationID.forEach(function(d){	//this should be for item in the stations array, then check if they are selected
						var stationId= ""+d;			
						if(    (timeline.selectedIDs[stationId]==true) 
							&& (timeline.observations.populatedIDs[stationId]==true) 
							&& (timeline.observations.timelineDataAll[stationId][type].rows.length>0) ){
							
							
							var dat2 = timeline.observations.timelineDataAll[stationId][type].rows.slice(startindex, endindex);							
							i = timeline.bisectDate(dat2, x0);
							
							if(i<1){ return;}
						    d0 = dat2[i - 1];
						    d1 = dat2[i];			    
						    if( (x0 - d0.tstamp) > (d1.tstamp - x0)  ){
						    	dp = d1;		    	
						    }else {
						    	dp = d0;				    
						    }						    						    	
						    if( Math.abs(dp.tstamp-x0)<= timeline.interval ){
						    	html = html + "</br><span style='color:"+timeline.stationColors[stationId]+";'>"
						    				+timeline.nformat(dp.metric_value)
						    				+""+unit1+"</span>";
						    }
						}	
					});												
					
					var x2= x+5;
					d3.select("#tip-"+type)
							.style("left", x2+"px")
							.style("top", 12+"px" )
							.html(html);						
						
					d3.select("#tipcircle-"+type).attr("opacity", 1);			
				    d3.select("#tip-"+type).style("visibility","visible");	
				   		    
			    }
			    else{
			    	d3.selectAll(".tipcircle").attr("opacity", 0.001);						
				    d3.selectAll(".tipdiv").style("visibility","hidden");				    
//				    console.log("not in interval");
			    }    
			} else{ // no data
				 d3.select("#tipcircle-"+type).attr("opacity", 0.001);	
				 d3.select("#tip-"+type).style("visibility","hidden");				 
//				 console.log("not data for "+type);
				 }		
	});
		
		
	})
	.on("mouseout", function(){
	})
	.on("mouseover",function(d){
		d3.select("#tipdate").style("visibility","visible");	
		d3.select("#tiplilne").style("visibility","visible");	
		
	});	
	
};



Timeline.prototype.disableTooltip = function (){
	
	d3.selectAll(".tipdiv").style("visibility", "hidden");	
	d3.selectAll("#tipdate").style("visibility", "hidden");					
	d3.select("#tipline").style("visibility", "hidden");
	d3.selectAll(".tipcircle").attr("opacity",0.001);		
	
	d3.selectAll(".nodata")
	.on("mousemove", function(){ return ;})
	.on("mouseover", function (){ return ;});
	
};


Timeline.prototype.drawIncidentTimeline = function() {
	//timeScale defined for mockup purposes
	var iconCenterShift = 35/2;
	var timeScale = d3.time.scale();	
	
	timeScale.domain(this.xScale.domain());
	timeScale.range([this.margin.left, $("#xAxis .series").width() - this.margin.right]);

	var parentWidth = $("#xAxis .series").width() + this.margin.left + this.margin.right;
	
	//clear div from previous svg
	d3.select("#timeline-incident .series").selectAll("svg").remove();
	
	
	var svg = d3.select("#timeline-incident .series").append("svg:svg")
				.attr("viewBox","0 0 "+parentWidth+" 1")
				.attr("preserveAspectRatio", "none");

	svg.append("svg:line")
	    .attr("x1", this.margin.left)
	    .attr("x2", parentWidth - this.margin.right)
	    .attr("y1", 0.5)
	    .attr("y2", 0.5)
	    .attr("vector-effect", "non-scaling-stroke")
	    .attr("class", "axisLine");
	
	//add incident icon mockup
	d3.select("#timeline-incident .series").selectAll("a")
		.data( Stockpile.meta.inc.filter(
				function(d){ return RwisMap.getMapBounds().contains([d.lat, d.lng]); } ))
		.enter()
		.append("a")
		.attr("class", function(d){ return "incident-icon " + d.type; })
		.style("top", "0px")
		.style("left", function(d){ return timeScale(d.tstamp) + "px"; })
		.on("click", function(d,i){ alert(d.type + " " + d.id + " clicked!"); })
		.on("mouseover", function(d) {
		    $document.trigger('incidentMouseover', d.id);
		})
		.on("mouseout", function() {
		    $document.trigger('incidentMouseout');
		});
	//add incident+ mockup to showcase expand panel	
};


