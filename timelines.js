var csrftoken = $.cookie('csrftoken');
  
function csrfSafeMethod(method) {
	        return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
	    }

var colorScale = d3.scale.linear().range([0,9]);
	
var xScale= d3.time.scale();
var xAxis = d3.svg.axis().ticks(10).tickSubdivide(true).orient("top");   
var prevWeek;
var stationID;
var xWidth;
var currenttime = new Date();
prevWeek = +currenttime;
var observationTypes; 
var aspectRatio ;

//color category
var xScale= d3.time.scale(),
    xAxis = d3.svg.axis().ticks(10).tickSubdivide(true).orient("top"),
    prevWeek,
    stationID,
    xWidth, 
    currenttime = new Date(),
    prevWeek = +currenttime,
    observationTypes,
    aspectRatio,
    p = d3.scale.category10();

var format=d3.time.format("%Y-%m-%d %H:%M:%S");
var parse =format.parse;
var length = 0;
var m = [20, 60, 10, 60],
    width,	
    height = 800 - m[0] - m[2];

    
var eachHeight = 80; //change so that margin is always 5% of the height

var timelineDataAll='';

// A line generator, for the dark stroke.
var line = d3.svg.line()
    .interpolate("linear")
    .x(function(d) { return xScale(d.tstamp); });  

var zoom = d3.behavior.zoom() 	
 	.on("zoom", zoomTimeline);

function zoomTimeline(){
	
	console.log("on zoom "+xScale.domain()[0]);	
	var domMin = +(xScale.domain()[0]) + 1*24*60*60*1000;
	//console.log(domMin);	
	var domMax =  +(xScale.domain()[1]) - 1*24*60*60*1000;
	//console.log(domMax);	
	if(domMax<=domMin){
		return;		
	}
	
	domMin = new Date(domMin);
	domMax = new Date(domMax);
	
	xScale.domain([domMin, domMax]);
	
	console.log(xScale.domain()[0]);	
	console.log(xScale.domain()[1]);	
	xAxis.scale(xScale);	
	var tx = d3.select(".x.axis").call(xAxis); 	
	
	timelineDataAll.forEach(function(d, i){
		
         //console.log("zooming circles");
         var id = "#chart-" + i;
      	 var circles =  d3.select(id).selectAll("circle")            
		      .transition()
	    		.delay(function(d,i){ return i*2;})		 		
		 		.attr("cx", function(d){return xScale(d.tstamp);})
		 		.attr("r", 2);                 	         
	});   	
}

function getPrevWeekData(prevWeek){
	 var dt= new Date(prevWeek);	    
	 var currenttime = new Date();
	 prevWeek = +currenttime;
	 //console.log(observationTypes);
	    
	 var parameters = {
			      	startTime: format(dt),
			      	stationID: stationID,
			      	obsType: observationTypes
		          	};
    parameters = JSON.stringify(parameters);
    
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
//        	 $("#loading").fadeOut(200);        	
//      
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
	   				xScale.rangeRound([0, xWidth]); 
	   				xAxis.scale(xScale);
	   				
	   				//line.x(function(d) { return xScale(d.tstamp); });  	
	   				var tx = d3.select(".x.axis").call(xAxis); 	   									
	   					
	   				timelineDataAll.forEach(function(d, i){  
	   					
	   					var color = p(i); 					
	   					var id = "#chart-" + i;
	   					var title = Stockpile.meta.obsType[d.title];
	   					//var elem = d3.select("#parent")
	   					//   	.selectAll(".series").select(function(d,i2){
	   					   		//     return (i==i2)?this:null;});
	   					   			
	   					var t = d3.select(id).transition().duration(750);							
	   					var timelineData = d.rows;
	   					//circles from current chart disappear
	   					var ctr = d3.select(id).selectAll("circle")
							   .transition()
							   .delay(function(d,i){return i*2; })
							   .remove();                           
	   					
	   					if(timelineData.length<=0){				
	   						
	   						console.log("no data");
	   						d3.select(id)
	   						  .attr("class","title")
	   						  .insert("text")
	   						  .attr("transform", "translate(" + m[1] + ", 20 )")
	   						  .text("No data for this week");
	   						 						
	   					}
	   					else if(timelineData.length>0){						
	   						
	   						var yMax = d3.max( timelineData, function(d) { return d.metric_value; });
							var yMin = d3.min( timelineData, function(d) { return d.metric_value; });
							
							var yScale = d3.scale.linear()
								.domain([yMin, yMax]).nice()
								.rangeRound([eachHeight, 0]).nice();
							
							colorScale.domain([yMin, yMax]).nice();								
							var yAxis = d3.svg.axis().scale(yScale).ticks(5).orient("left");								
										      
							//line.y(function(d) { return yScale(d.metric_value); });						 
						    //var line1 = t.select(".line");						    
						    //line1.attr("d", line(timelineData));							    					    
							
                          t.select(".y.axis").call(yAxis);
                          
                          t.each("end", function(){
                        	  
                          	 var circles =  d3.select(id).selectAll("circle")
                                 .data(timelineData, function(d){ return d.tstamp; })			
						      .enter().append("circle")
//						        .attr("class", function(d){	 		
//						        	console.log("circle  "+Math.round(colorScale(d.metric_value)));
//						        	return "circle-color-"+Math.round(colorScale(d.metric_value));
//						        		})
						      	.attr("stroke", color).attr("fill", color)
						      .transition()
					    		.delay(function(d,i){
							   			 return i*2;	})		 		
						 		.attr("cx", function(d){return xScale(d.tstamp);})
								.attr("cy", function(d){return yScale(d.metric_value);})
								.attr("r", 3);
								
							d3.select(id).selectAll("circle")
								.append("title")
								.attr("class","title")
								.text( function(d){
										return "at: "+d.tstamp + ", value= " 
										+ d.metric_value+" "+title.metric;});                           	
                          });  		   	
					   }					
				});
                     },
		error: function() {
			console.log('Error loading observations');
			}
        	});	
	
}

function prepXaxis(){
	
	var xMax = Number.MIN_VALUE;
	var xMin = Number.MAX_VALUE;  
   
    timelineDataAll.forEach(function(d){  	    
   	 
	    var timelineData = d.rows;	    
	    if(timelineData.length > 0){
	    // Parse dates and numbers. We assume values are sorted by date.
		   	timelineData.forEach(function(d) {
		    	d.tstamp = parse(d.tstamp);
		    // console.log(d.tstamp);  
		    });   
		  
		   	xMax = d3.max( [xMax, d3.max( timelineData, function(d) { return d.tstamp; })] ); 
		   	xMin = d3.min( [xMin, d3.min( timelineData, function(d) { return d.tstamp; })]);
	    }
		}); 
	//console.log(prevWeek);
	prevWeek -= 7*24*60*60*1000;//upto milliseconds
	//console.log(prevWeek);
	xScale.domain([xMin, xMax]);	
	
}

function prepCanvas(){
	
	d3.select("#prev")
	.on("click", function(){
		getPrevWeekData(prevWeek);	
	});  
	var xaxis= d3.select("#timeline").select("#xAxis")	             
	             .attr("class","series");	
	// xaxis.attr("id","zoom").attr("class","btn btn-mini btn-info").append("text").text("zoom");
	
	//adding zoom behavior	
	d3.select("#xAxis").call(zoom);	
	var parentWidth = $("#xAxis").width();
 	
	xWidth = parentWidth - m[1] -m[3];		
	xScale.range([0, xWidth]);	
	
	var w = xWidth + m[1]+ m[3]; 
	var h = m[0]+m[2];	
	
	xAxis.scale(xScale);
	
	xaxis
	    .append("svg:svg").attr("class","svg-container")
	      .attr("width", w)
	      .attr("height", h )     
	      .attr("viewBox","0 0 "+w+" "+ h+" ")
     	  .append("svg:g")
	      .attr("transform", "translate(" + m[1] + "," + m[0] + ")")   
		  .attr("class", "x axis")
		  .call(xAxis);     
	
	$("#parent").sortable();	
	$(window).on("resize", function(){
		
	  $("#parent .svg-container").each(function(){
	  	var container = $(this).parent();
	  	var parentWidth = $("#xAxis").width();
	  	m[2]= Math.round(parentWidth*0.02);	
		m[0] = m[2]*2;	
	  	
	  	var w = parentWidth;
	  	var h = w/aspectRatio;
	  	 
	  	d3.select(this).attr("width", w);
	  	d3.select(this).attr("height", h);	     
	  	//d3.select(this).attr( "viewBox","0 0 "+w+" "+ h+" ");  
	  });	
	  
	  	$("#xAxis .svg-container").each(function(){
	  	var container = $(this).parent();
	  	var parentWidth = $("#xAxis").width();
	  	m[2]= Math.round(parentWidth*0.02);		
	  	//m[3]=m[2];	
		m[0] = m[2]*2;	  	
	  	var w = parentWidth;	  	
	  	var h = m[0]+m[2];
	  	 
	  	d3.select(this).attr("width", w);
	  	d3.select(this).attr("height", h);	       
	  });
	  	
	}).trigger("resize");
}   


function getTimelineData(station_id) {	
	
	 d3.select("#analyzeContainer").style("visibility","visible");
	 $('#loading').hide();
	
	stationID = new Array();
//	stationID.push(2886); 
    stationID.push(2866); //station_id;    
    //it will change later to read observation types from the input   
    observationTypes = new Array();
    observationTypes.push(206);
    observationTypes.push(575);
    observationTypes.push(5733); 
    
    
	    
    var currenttime = new Date();
    prevWeek = +currenttime;
//    console.log(observationTypes);    
    
    var parameters = {startTime: format(currenttime),
    		          stationID: stationID,
    		          obsType: observationTypes,    		          
    		          };
    parameters = JSON.stringify(parameters);
    console.log(parameters);
    
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
            drawTimeSeries(timelineDataAll);
        },
        error : function() {
            console.log('Error loading observations');
        }
    });
}


function drawTimeSeries(data){
	
  timelineDataAll = data;
  prepXaxis(); 
//  console.log("in drawline");
  prepCanvas();
//  console.log("after prep canvas");
 
  var w = xWidth+m[1]+m[3];
  var h = eachHeight+m[0];	
  
  aspectRatio = w/h;      
           
//now draw each timeline     
timelineDataAll.forEach(function(d,i){	
	
   var timelineData = d.rows;
    var color = p(i);
    var title = Stockpile.meta.obsType[d.title];
    var svg = d3.select("#parent");	
    
	var div1=svg.append("div").attr("class","series");
	
	if(title.metric==null){
			title.metric="";
		}
   else {
			title.metric="<small> in "+title.metric+"</small>";
		}
	
	
	div1.append("div").attr("class","title")
	     .html("<strong>"+title.name+"</strong>"
	      + title.metric
	      + "<br/>"
	      + title.description);
	//static elements       
	var id = "chart-"+i;		
	
	var g1= div1.append("div")	   
	     .append("svg:svg").attr("class","svg-container")
		 .attr("width", w)
	     .attr("height", h)
	      .attr("viewBox","0 0 "+w+" "+ h+" ")
		 .append("svg:g")
		 .attr("transform", "translate(" + m[1] + ", 20 )")	;
	 
		 
  // Add the clip path.
	g1.append("svg:clipPath")
	      .attr("id", "clip")
	    .append("svg:rect")
	     .attr("x", 0)
	     .attr( "y", -15)
	      .attr("width", xWidth+5)
	      .attr("height", eachHeight+15);
	
	 
	// Add the x-axis line
	g1.append("svg:rect")
	  .attr("class","rect")
	  .attr("x", 0)
	  .attr( "y", eachHeight)
	  .attr ("width", xWidth)
	  .attr("height",1);		
	
//	 var line1 = g1.append("svg:path")
//		         .attr("class", "line")
//		         .attr("clip-path", "url(#clip)");  
	 
	 if(timelineData.length>0){  		 
		    //now dyamic elements
		var yMax = d3.max( timelineData, function(d) { return d.metric_value; });
		var yMin = d3.min( timelineData, function(d) { return d.metric_value; });	 
	// Add the y-axis.
		var yScale = d3.scale.linear().domain([yMin, yMax]).nice();		
		colorScale.domain([yMin, yMax]).nice();		
		yScale.rangeRound([eachHeight, 0]).nice();
		var yAxis = d3.svg.axis().scale(yScale).ticks(4).orient("left");
		
		g1.append("svg:g")
	      .attr("class", "y axis")
	      .attr("transform", "translate(-5, 0)")	      
	      .call(yAxis);   
	
	 //console.log("after y axis");
	 // Add the line path.
	//line.y(function(d) { return yScale(d.metric_value); }); 
	//line1.attr("d", line(timelineData));        
	      
	 //var totalLength = line1.node().getTotalLength();
	 //length = totalLength ; 
	 
	//  line1.attr("stroke-dasharray", totalLength + " " + totalLength)
	       //  .attr("stroke-dashoffset", totalLength)
	      //  .transition()
	        //  .duration(1000)
	        //  .ease("linear")
	        //  .attr("stroke-dashoffset", 0) ;	        
		
	var circles = g1.append("svg:svg")
	             .attr("id",id).attr("clip-path", "url(#clip)")
	    .selectAll("circle")
	        .data(timelineData ,function(d){return d.tstamp;})						
	 		.enter().append("svg:circle")
	 			.attr("stroke",color)
	 			.attr("fill", color)	
//	 			.attr("class", function(d){
//	 				console.log("circle-color-"+Math.round(colorScale(d.metric_value)) );	 				
//	 				return "circle-color-"+Math.round(colorScale(d.metric_value));
//	 			})
	 	   .transition()
	       .delay(function(d){ return xScale(d.tstamp)*2;	})		 			 		
	 		.attr("cx", function(d){return xScale(d.tstamp);})
			.attr("cy", function(d){return yScale(d.metric_value);})			
			.attr("r", 3);  
	
	g1.selectAll("circle")
		.append("title")
		.attr("class","title") 
			.text( function(d){
				return "at: "+d.tstamp + ", value= " + d.metric_value+" "+title.metric;});	
 } else {
	 
	 console.log("no data");		   												   					    
	 g1.attr("class","title")	   						
		.insert("text")	   						 
		 .attr("transform", "translate(" + m[1] + ", 20 )")	
		.text("No data for this week");
 }	  
	 
});

}
