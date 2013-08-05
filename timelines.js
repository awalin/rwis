var colorScale = d3.scale.linear().range([0,9]);

var xScale= d3.time.scale(),
    xAxis = d3.svg.axis().ticks(10).tickSubdivide(true).orient("top"),   
    stationID,
    xWidth, 
    currenttime = new Date(),
    enddate = +currenttime,
    startdate = enddate-7*24*60*60*1000, 
    aspectRatio,
    p = d3.scale.category10(),
    oldExtent,
    individualData,
    topMargin=20,
    leftMargin=60,
    bottomMargin=10,
    rightMargin=20;

var format = d3.time.format("%Y-%m-%d %H:%M");
var parse = format.parse;
var length = 0;
var margin = [topMargin, leftMargin, bottomMargin, rightMargin],//the margin array for the main svg container
    width,	
    height = 800 - margin[0] - margin[2];

var eachHeight = 80; //height of each timeline

var zoom = d3.behavior.zoom()
             .scaleExtent([1,5])
             .on("zoom", function(){                                      
            	 var tx = d3.select(".x.axis").call(xAxis);   
            	 prevWeek = +(xScale.domain()[0]);//update prev week start time, upto milliseconds
            	 function transform (){
            		 return "scale(" + d3.event.scale +", 1)";
                  }
            	 d3.select("#parent").selectAll(".line").attr("transform", transform );             

               });

var line = d3.svg.area()
	.interpolate("linear")
	.x(function(d) { return xScale(d.tstamp); });	

function getTimedData(start, end){	 
	var end = new Date(end);
	var start = new Date(start);	
	enddate = startdate;
	startdate = (enddate - 7*24*60*60*1000); // if nothing specified bring data from just one week.
	
	 var parameters = {
			      	startTime: format(end),
			      	stationID: stationID,
			      	endTime: format(start)
		          	};
    parameters = JSON.stringify(parameters);
    
    // console.log(parameters); //prints out the parameters sent to the server
    
    $.ajaxSetup({    	
        crossDomain: false, // obviates need for sameOrigin test        
        beforeSend: function(xhr, settings) {
//        	console.log("token again "+csrftoken);
        	
            if (!csrfSafeMethod(settings.type)) {
                xhr.setRequestHeader("X-CSRFToken", csrftoken);
            }
            $('#loading').show();
            $("#loading").fadeIn(200);
            },
        complete: function(){
        	d3.select("#loading").transition().duration(300)        	
        	 .each('end', function(){
        	   	 $('#loading').hide();
        	 });
        	}        
    });

	$.ajax({
                type: 'POST',
                url: '/observe/',
                data: parameters, 
                cache: false,                
                success: function(data0){
   					timelineDataAll = data0; 	   					
	   				prepXaxis();  
	   				xAxis.scale(xScale);	   				  	
	   				var tx = d3.select(".x.axis").call(xAxis);	   				
	   				drawLines(timelineDataAll);   				
                    },
		error: function() {
			console.log('Error loading observations');
			}
        	});	
	
}

function sortDates(){
	 timelineDataAll.forEach(function(d, i){
			var timelineData = d.rows;
			
			timelineData.sort(function(a, b){
				return d3.ascending(a.tstamp, b.tstamp);
			});
		});
}

function drawLines(dataToDraw, animate){	
	
	timelineDataAll.forEach(function(d, i){
			
			var id = "#chart-" + i;
			var title = Stockpile.meta.obsType[d.title];
			   			
			var chart = d3.select("#frame-"+i);							
			var timelineData = d.rows;
			
			d3.select(id).select(".nodata").remove();
			
			if(timelineData.length<=0){			
					
				d3.select(id)
				  .insert("text").attr("class","nodata")
				  .attr("transform", "translate(" + margin[1] + ", 20 )")
				  .text("No data for this week");	
			}
//			else if(timelineData.length>0){						
				
			   var yMax = d3.max( timelineData, function(d) { return d.metric_value; });
			   var yMin = d3.min( timelineData, function(d) { return d.metric_value; });
			
			   var yScale = d3.scale.linear()
				.domain([yMin, yMax]).nice()
				.rangeRound([eachHeight, 0]).nice();
			   
			   var yAxis = d3.svg.axis().scale(yScale).ticks(5).orient("left");			   
			   line.y(function(d) { return yScale(d.metric_value); });		
		       timelineData = dataToDraw[i].rows; // the axis is always global, though sometimes we may need to draw only part of the line		
		       
			      
			if(animate) {
				var t = chart.transition().duration(200);
				t.select(".y.axis").call(yAxis);
				t.each("end", function(){
					d3.select(id)
		           	.select(".line")
		           	.transition().duration(250)
		           	    .attr("d", line(timelineData,function(d){
		           	    	                   return d.tstamp;}) );     
					
				});
			}  
			else{   
				chart.select(".y.axis").call(yAxis);
				
				d3.select(id)
		           	.select(".line")
//		           	.transition().duration(1000)
		           	    .attr("d", line(timelineData,function(d){
		           	    	                   return d.tstamp;}) );
			}           	    
                    	
//			}     		   	
						
	});//end of for each
}

function prepXaxis(){
	
	var xMax = Number.MIN_VALUE;
	var xMin = Number.MAX_VALUE;  
   
    timelineDataAll.forEach(function(d){  	    
   	 
	    var timelineData = d.rows;	    
	    if(timelineData.length > 0){
	    // Parse dates and numbers. 
		   	timelineData.forEach(function(d) {
//		   		console.log(d.tstamp);
		    	d.tstamp = parse(d.tstamp);
//		    	console.log(d.tstamp);
		    });   
		  
		   	xMax = d3.max( [xMax, d3.max( timelineData, function(d) { return d.tstamp; })] ); 
		   	xMin = d3.min( [xMin, d3.min( timelineData, function(d) { return d.tstamp; })]);
	    }else{
	    	
	    	xMax = new Date(enddate);
	    	xMin = new Date(startdate);
	    }
		}); 
	xScale.domain([xMin, xMax]);		
}

var position = 0;
//mouse drag behavior, drag may have to fetch more data if data of that time frame not available//
var drag = d3.behavior.drag()
			.origin(Object)
             .on("dragend",dragend)
             .on("drag", ondrag)
             .on("dragstart", function() {
            	 position = 0;//should be the initial point of the svg            	 
            	 oldExtent = xScale.domain();
            	 d3.event.sourceEvent.stopPropagation(); // silence other listeners
             	});

function ondrag(){	
	 position += d3.event.dx;  	 
	 drawLines(timelineDataAll);
	
}

function dragend(){				     
					var newExtent = xScale.domain(); // new domain of x scale 				    
//				    console.log(newExtent);
				    
				    if(newExtent[0] > oldExtent[0]){
				    	currenttime = newExtent[1];
				    	var timeBefore = oldExtent[1];    	
				    }else{
				    	var timeBefore = newExtent[0];
				    	currenttime = oldExtent[0];    
				    }
				    
				    oldExtent = newExtent;		
				    
					var parameters = {
							      	startTime: format(currenttime),
							      	stationID: stationID,
							      	endTime:   format(timeBefore)
						          	};
					parameters = JSON.stringify(parameters);
					
//					console.log(parameters);					
					$.ajaxSetup({    	
					 crossDomain: false, // obviates need for sameOrigin test        
					 beforeSend: function(xhr, settings) {        	
					     if (!csrfSafeMethod(settings.type)) {
					         xhr.setRequestHeader("X-CSRFToken", csrftoken);
					     }
					     $('#loading').show();
					     $("#loading").fadeIn(200);
					     },
					 complete: function(){
					 	d3.select("#loading").transition().duration(300)        	
					 	 .each('end', function(){
					 	   	 $('#loading').hide();
					 	 });
					 	}        
					});
					
					$.ajax({
					         type: 'POST',
					         url: '/observe/',
					         data: parameters, 
					         cache: false,                
					         success: function(data0){					              
					                
					        	  var timelineData = data0;  
								  drawAfterDrag(timelineData);
					         },				
							 error : function() {
							            console.log('Error loading observations');
							        }
					});
 }



function drawAfterDrag(data0){	
	
	enddate = +(xScale.domain()[0]);//update prev week start time, upto milliseconds	
	startdate = (enddate-7*24*60*60*1000);
	
	timelineDataAll.forEach(function( d, i){	
	    d.rows = d.rows.filter(function(d,i){
//			console.log(d.tstamp);//console.log(newExtent[1]);
	    	   return (( (+d.tstamp) < (+oldExtent[1]) ) && ( (+d.tstamp)>= (+oldExtent[0]) )); 
		     }); // d.rows;	       
//	    console.log("after " +d.rows.length);	
	    });
	
	var remainingData = timelineDataAll;
	
	data0.forEach(function(d, i){		
		var rows =  d.rows;	     
//		console.log("new points = "+ rows.length);
		
		if(rows.length>=0){
			rows.forEach(function(d){
	    			d.tstamp = parse(d.tstamp);
	    			timelineDataAll[i].rows.push(d);
			    	});
		}//if length gt zero
	});	
	
	drawLines(remainingData, true);//with animation=true
	sortDates(timelineDataAll);
	drawLines(timelineDataAll);//now draw all
}

function prepCanvas(){	 	
   d3.select("#prev")
	.on("click", function(){
		getTimedData(startdate, enddate);	
	     });  

    var xaxis= d3.select("#xAxis .series");	
    var parentWidth = $("#xAxis .series").width();
 	
	xWidth = parentWidth - margin[1] -margin[3];		
	xScale.range([0, xWidth]);		
	oldExtent = xScale.domain();
	
	var w = xWidth + margin[1]+ margin[3]; 
	var h = margin[0] + margin[2];	
	
	xAxis.scale(xScale);	
	zoom.x(xScale); //setting the scale of the	 zoom level
	
	console.log(margin[1]);
	console.log(margin[0]);
	
	xaxis
	    .append("svg:svg").attr("class","svg-container")
	      .attr("width", w)
	      .attr("height", h )     
	      .attr("viewBox","0 0 "+w+" "+ h+" ")
     	  .append("svg:g")
	      .attr("transform", "translate(" + margin[1] + "," + margin[0] + ")")	      
		  .attr("class", "x axis")
		  .call(xAxis);  
	
	//adding zoom behavior	
	xaxis.call(zoom);	
	xaxis.call(drag);    
	
	
	 $("#date-form").dialog({
//		 dialogClass: "no-close",
		 autoOpen: false,
		 height: 200,
//		    modal: true,
		  position: { 
		        my: 'right top',
		        at: 'left top',
		        of: $('#date-icon')
		    }
		});
			
	
	$("#date-icon").click(function(){
//		 console.log("click called");	 
		 
		 $( "#datePicker-start" ).datepicker({
			 dateFormat: "yy-mm-dd",
			 defaultDate: new Date(startdate),
			 beforeShow: function(input, inst) {
				 
			        var widget = $(inst).datepicker('widget');
			        var top = $(widget).outerHeight()+$(input).outerHeight();
			        console.log("ow="+ $(input).outerWidth());
			        var right = $(input).outerWidth() - widget.outerWidth();
			        console.log("rt="+right);
			        console.log("tp="+ top);			        
			        
			        widget.css( 'margin-left',right  );
			        widget.css( 'margin-top', -top );
			    }
		 });
		 
		 $( "#datePicker-start" ).datepicker( "setDate" ,  $(this).val() );
		 
		 //end date
		 
		 $( "#datePicker-end" ).datepicker({
			 dateFormat: "yy-mm-dd",
			 defaultDate: new Date(enddate)	 	
		 });	 
	
		 
		 $("#date-form").dialog( "open" );	
	});
	
//	 $( "#datePicker-end" ).datepicker( "setDate" ,  $(this).val() );
	
	d3.select("#dated-data")
	.on("click", function(){		
//		 console.log(datetext +" new date: " + $(this).datepicker('getDate'));					 
		  var pW = $( "#datePicker-end" ).datepicker('getDate');
//		  console.log("pW "+pW);					  
		  enddate = +pW;
		  
		  var start = $( "#datePicker-start" ).datepicker('getDate');
//		  console.log("pW "+pW);					  
		  var startdate = +start;  	 
		  
		  if(startdate>=enddate){
			  alert("please select valid date range, your start date is greater than the end date");
		  }
		  
		  else {
			  $( "#date-form").dialog('close');	
			  getTimedData( startdate, enddate);	//also set the starting date , overload the function			  
		  }
	     });
	
	$("#parent").sortable();	
	$(window).on("resize", function(){
		
	  $("#parent .svg-container").each(function(){
	  	var container = $(this).parent();
	  	var parentWidth = $("#xAxis .series").width();
	  	margin[2]= Math.round(parentWidth*0.02);	
		margin[0] = margin[2]*2;	
	  	
	  	var w = parentWidth;
	  	var h = w/aspectRatio;
	  	 
	  	d3.select(this).attr("width", w);
	  	d3.select(this).attr("height", h);	     
	  	//d3.select(this).attr( "viewBox","0 0 "+w+" "+ h+" ");  
	  });	
	  
	  	$("#xAxis .svg-container").each(function(){
	  	var container = $(this).parent();
	  	var parentWidth = $("#xAxis .series").width();
	  	margin[2]= Math.round(parentWidth*0.02);		
	  	//margin[3]=margin[2];	
		margin[0] = margin[2]*2;	  	
	  	var w = parentWidth;	  	
	  	var h = margin[0]+margin[2];
	  	 
	  	d3.select(this).attr("width", w);
	  	d3.select(this).attr("height", h);	       
	  });
	  	
	}).trigger("resize");
}   

/****************
* sends ajax request to the view to call database *
* gets data from the request, and passes to the drawing function *
****************/

function getTimelineData(station_id) {	
	 
	d3.select("#analyzeContainer").style("visibility","visible");
	$('#loading').hide();	
	$("#date-form").hide();//initially hide, show if ivon is clicked
	
	stationID = new Array();
//	stationID.push(2886); 
    stationID.push(2866); //station_id;
	    
    var currenttime = new Date(2013, 6, 15);
    enddate = +currenttime;
    startdate = (enddate-7*24*60*60*1000);//keep the globals in millisec
    
    var start = new Date(startdate);
    
    var parameters = {startTime: format(currenttime),
    		          stationID: stationID,
    		          endTime:   format(start)  		          
    		          };
    parameters = JSON.stringify(parameters);
//    console.log(parameters);
    
    $.ajaxSetup({    	
        crossDomain: false, // obviates need for sameOrigin test        
        beforeSend: function(xhr, settings) {   
//        	console.log("token again "+csrftoken);
        	
            if (!csrfSafeMethod(settings.type)) {
                xhr.setRequestHeader("X-CSRFToken", csrftoken);
            }
            $('#loading').show();
            },
        complete: function(){
        	
        	
        	d3.select("#loading").transition().duration(300)
        	 .each('end', function(){
        	   	 $('#loading').hide();	
        	 });
//        	 $("#loading").fadeOut(200);       	
        	}        
    });  
    
    $.ajax({
        type : 'POST',
        url : '/observe/',
        data : parameters,
        contentType: 'application/json; charset=utf-8',
        cache : false,          
        success : function(data0) {
            timelineDataAll = data0;     
            d3.select("#prev").style("visibility","visible");
            d3.select(".date-picker").style("visibility","visible");
            d3.select("#timeline").style("visibility","visible");
            prepXaxis(); 
            prepCanvas();      
            drawTimeSeries(timelineDataAll);
            
//            wrapUpDrawing();     
            },
        error : function() {//
//            d3.select("#analyzeContainer").style("visibility","visible");
            $('#loading').hide();            
            console.log('Error loading observations');
        }
    });
}

function wrapUpDrawing(){
    var nav = new FlexibleNavMaker("#parent div h4").make().prependTo('#navigation');
	new FlexibleNav(nav);
//	d3.selectAll(".anchors").style("display","none");
//    
//    $("#outline").fracs("outline", {
//    	crop: true,
//    	styles: [
//    			selector: 'h4',
//    			fillStyle: 'rgb(240,140,060)'
//    		}
//    	]
//    });
    
//    $("#navigation").hover(function(){    	
    	
//    });
}


function drawTimeSeries(data){

  var w = xWidth+margin[1]+margin[3];
  var h = eachHeight+margin[0];	
  
  aspectRatio = w/h;      
           
//now draw each timeline     
 data.forEach(function(d,i){	
	
    var timelineData = d.rows;
    var color = p(i);
    var title = Stockpile.meta.obsType[d.type];
    
    var svg = d3.select("#parent");	
    
	var div1=svg.append("div").attr("class","series");
	
	if(title.metric==null){
			title.metric="";
		}
    else {
			title.metric=", in "+title.metric+"";
		}	
//	div1.attr("data-navtext", title);
	
	div1.append("div").attr("class","title")
	     .html("<h4>"+title.name+"</h4>"
	      + "<small>"+title.description+ " "+ title.metric + "</small>");
	//static elements       
	var id = "chart-"+i;		
	
	var g1= div1.append("div").attr("id","frame-"+i)	   
	     .append("svg:svg").attr("class","svg-container")
		 .attr("width", w)
	     .attr("height", h)
	      .attr("viewBox","0 0 "+w+" "+ h+" ")
		 .append("svg:g")
		 .attr("transform", "translate(" + margin[1] + ", 20 )")	;	 
		 
  // Add the clip path.
	g1.append("svg:clipPath")
	      .attr("id", "clip")
	    .append("svg:rect")
	     .attr("x", 0)
	     .attr( "y", -15)
	      .attr("width", xWidth+5)
	      .attr("height", eachHeight+15);	
	 
	
	
	 if(timelineData.length>0){  
		 
		// Add the x-axis line
		g1.append("svg:rect")
			  .attr("class","rect")
			  .attr("x", 0)
			  .attr( "y", eachHeight)
			  .attr ("width", xWidth)
			  .attr("height",1);
		    //now dyamic elements
		var yMax = d3.max( timelineData, function(d) { return d.metric_value; });
		var yMin = d3.min( timelineData, function(d) { return d.metric_value; });	 
	// Add the y-axis.
		var yScale = d3.scale.linear().domain([yMin, yMax]).nice();	
		yScale.rangeRound([eachHeight, 0]).nice();
		var yAxis = d3.svg.axis().scale(yScale).ticks(4).orient("left");
		
		g1.append("svg:g")
	      .attr("class", "y axis")
	      .attr("transform", "translate(-2, 0)")	      
	      .call(yAxis);     
			
		line.y(function(d) { return yScale(d.metric_value); });
		
		var strokes = g1.append("svg:svg")
        .attr("id",id)
        .attr("clip-path", "url(#clip)")
        .append("svg:path")
        .attr("class","line")
        .attr("d", line( timelineData ,function(d){return d.tstamp;} ));       
		
	
		
 } else {
	 
//	 console.log("no data returned from database for this type of observation in this time frame");	 
	 g1.insert("text").attr("class","nodata")	   						 
	    .attr("transform", "translate(" + margin[1] + ", 20 )")	
		.text("No data for this week");
 }	  
	 
});

}
