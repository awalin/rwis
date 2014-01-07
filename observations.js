function Observations(){	
	
	this.populatedIDs = new Array(); // list of all stations for the current view, fixed size
	this.stationID = new Array();
	this.timelineDataAll = [];
	this.observationTypes = [];
	this.currenttime = new Date();
	this.enddate = +this.currenttime;
	this.startdate;	
	this.format = d3.time.format("%Y-%m-%d %H:%M");
	this.parse = this.format.parse;	
	
	//data related variables	
	
	
	this.timelineview;

};

Observations.prototype.init = function(station_id, timeline){	
	
	
	this.populatedIDs["all"]=false;
	
	var curObject = this;
	
	this.timelineview = timeline;
	
	station_id.forEach(function(d){
		curObject.stationID.push(d);		
		curObject.populatedIDs[""+d]=false;	
	});	
	this.currenttime = new Date(2013, 6, 25);//use just Date();
	this.enddate = +this.currenttime;
	this.startdate = (this.enddate-7*24*60*60*1000);//keep the globals in millisec	
};

Observations.prototype.getTimelineData = function() {
	var obs = this;

	$.ajaxSetup({    	
		crossDomain: false, // obviates need for sameOrigin test        
		beforeSend: function(xhr, settings) {  
			if (!csrfSafeMethod(settings.type)) {
				xhr.setRequestHeader("X-CSRFToken", csrftoken);
			}
			//<move
			obs.timelineview.$loading.html("Loading observations for all stations");
			obs.timelineview.$loading.show();
			//>move
		},
		complete: function(){
			//<move
			d3.select("#loading").transition().duration(300)
			.each('end', function(){
				obs.timelineview.$loading.hide();	
			});
			//>move
//			$("#loading").fadeOut(200);       	
		}        
	});  
	
	var lines = _.keys(obs.timelineview.selectedIDs);
	lines.reverse();
	var start = new Date(obs.startdate);
	var parameters = {
			startTime: obs.format(start),
			stationID: obs.stationID,
			endTime:   obs.format(obs.currenttime),
			obs: obs.observationTypes
	};
	parameters = JSON.stringify(parameters);
	
	$.ajax({
		type : 'POST',
		url : '/observe/',
		data : parameters,
		contentType: 'application/json; charset=utf-8',
		cache : false,          
		success : function(data) {	
			obs.timelineDataAll["all"]=[];	
			data.forEach(function(d,i){
				obs.observationTypes.push({'observation_type':d.type});
				obs.timelineDataAll["all"][""+d.type] = data[i]; 
			});	
			obs.timelineDataAll["all"].forEach(function(d){		//each type			
				obs.parseDates(d.rows);				
			});	
			obs.populatedIDs["all"]= true;						
			obs.timelineview.wrapUpDrawing();		
			
		},
		error : function() {
			obs.timelineview.$loading.hide();   
			obs.timelineview.error();
//			console.log('Error loading observations');
		}
	});
};



/**
 * 
 * functions for individual stations
 * mostly deal with observation, data model
 */
Observations.prototype.getStationData = function (stationId, stationOnly){	//also pass the yScale
	
	var station = new Array();	
	station.push(stationId); //stationid;
	var obs = this;
	
	var start = new Date(obs.startdate);
	var end = new Date(obs.enddate);	
	
	var parameters = {
			startTime: obs.format(start),
			stationID: station,
			endTime:   obs.format(end),
			obs: obs.observationTypes
	};
	parameters = JSON.stringify(parameters);

	$.ajaxSetup({    	
		crossDomain: false, // obviates need for sameOrigin test        
		beforeSend: function(xhr, settings) {  
			if (!csrfSafeMethod(settings.type)) {
				xhr.setRequestHeader("X-CSRFToken", csrftoken);
			}			
			obs.timelineview.$loading.html("Loading observations for the selected stations");
			obs.timelineview.$loading.show();
			obs.timelineview.disableTooltip();			
		},
		complete: function(){ 			
			d3.select("#loading").transition().duration(300)
			.each('end', function(){
				obs.timelineview.$loading.hide();	
			}); 
			obs.timelineview.renderTooltip();		
		}        
	});  

	return $.ajax({
		type : 'POST',
		url : '/observe/',
		data : parameters,
		contentType: 'application/json; charset=utf-8',
		cache : false,          
		success : function(data) {
			
			obs.timelineDataAll[""+stationId]=[];		
			data.forEach(function(d, i){//for each station	
				obs.parseDates(d.rows);				
				obs.timelineDataAll[""+stationId][""+d.type] = data[i];	
			});			

			obs.populatedIDs[""+stationId]= true;
			if(stationOnly==true){				
				obs.timelineview.drawStationOnly(stationId);	
				
				if(obs.timelineview.firsttime[""+stationId]==true){
					obs.timelineview.firsttime[""+stationId]=false;					
				}
			}
		},
		error : function() {
			obs.timelineview.$loading.hide();   
			obs.populatedIDs[""+stationId]= false;
			console.log('Error loading observations');
		}
	});
};

/*
 * filter remaining data
 * get new data after dragging
 * **/

Observations.prototype.filterRemainingandGetNewData = function(newExtent, begin, finish){	
	
	var obs = this;
	obs.startdate = +(newExtent[0]);//update start time, upto milliseconds
	
	var remaining = [];
	var keys = _.keys(obs.populatedIDs);
	keys.reverse();

	keys.forEach(function(d){		
		var curr_station = d;
		if( obs.populatedIDs[curr_station]==false){
			return;
		}
		else{			
			remaining[curr_station] = [];			
			var data = obs.timelineDataAll[curr_station];			
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
				remaining[curr_station][otype] = values;
			});	
		}
	});
	
	var deferred = [];
    var curObject = this;
	
	var parameters = {
			startTime: curObject.format(begin),
			stationID: curObject.stationID,
			endTime:   curObject.format(finish),
			obs: curObject.observationTypes
	};
	parameters = JSON.stringify(parameters);

	$.ajaxSetup({    	
		crossDomain: false, // obviates need for sameOrigin test        
		beforeSend: function(xhr, settings) {        	
			if (!csrfSafeMethod(settings.type)) {
				xhr.setRequestHeader("X-CSRFToken", csrftoken);
			}
			
			curObject.timelineview.showMultipleLoading(begin, finish);
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
				curObject.parseDates(d.rows);				
			});			
			curObject.populatedIDs["all"]= true;			
			curObject.mergeDataAfterDrag(data, "all");	
		},				
		error : function() {
//			console.log('Error loading observations');
		}
	})
	);	

	curObject.stationID.forEach( function(d){	//this should be for item in the stations array, then check if they are selected
		var stationId= ""+d;	
		if(curObject.timelineview.selectedIDs[stationId]==true || curObject.populatedIDs[stationId]==true){ 
			deferred.push(curObject.getStationDataOnDrag(d, begin, finish, false));					
		}		
	});			

	$.when.apply($, deferred).then( function(){ 
		$(".load").fadeOut(300, function() { $(this).remove(); });
		curObject.timelineview.drawLines(remaining, true, true);//redraw y-axis= true,with draw in two step=true	
	});	
};


Observations.prototype.getStationDataOnDrag = function (stationId, starttime, endtime) {	
	
	var station = new Array();	
	station.push(stationId); //stationid;	
	var start = new Date(starttime);
	var end = new Date(endtime);

	var parameters = {
			startTime: this.format(start),
			stationID: station,
			endTime:   this.format(end),
			obs: this.observationTypes
	};
	parameters = JSON.stringify(parameters);

	$.ajaxSetup({    	
		crossDomain: false, // obviates need for sameOrigin test        
		beforeSend: function(xhr, settings) {  
			if (!csrfSafeMethod(settings.type)) {
				xhr.setRequestHeader("X-CSRFToken", csrftoken);
			}
		},
		complete: function(){ 	
		}        
	});  
	
	var curObject = this;

	return $.ajax({
		type : 'POST',
		url : '/observe/',
		data : parameters,
		contentType: 'application/json; charset=utf-8',
		cache : false,          
		success : function(data) {
			data.forEach(function(d){//for each station
				curObject.parseDates(d.rows);				
			});		
//			console.log("query success drag with station "+stationId);
			curObject.mergeDataAfterDrag(data, stationId);			
			curObject.populatedIDs[""+stationId]= true;

		},
		error : function() {
			//<move
//			curObject.$loading.hide();
			//>move
			
			curObject.populatedIDs[""+stationId]= false;
			console.log('Error loading observations');
		}
	});
};

Observations.prototype.mergeDataAfterDrag = function(data, stationId){	
//	console.log("merge after drag");	
	var curObject = this;
	data.forEach(function(d){		//for each obs type
		var rows =  d.rows;	   
		var type= d.type;
//		console.log("new points = "+ rows.length);
		if(rows.length>=0){
			rows.forEach(function(d){				
				curObject.timelineDataAll[stationId][type].rows.push(d);
			});
		}//if length gt zero
	});	

	curObject.timelineDataAll[stationId].forEach(function(data){//for each type		
		curObject.sortDates(data.rows);					
	});	

};


//move to data class file
Observations.prototype.getTimedData = function(start, end){

		this.enddate = +end;
		this.startdate = +start;
	
		var endp = new Date(end);
		var startp = new Date(start);
		
		var parameters = {
				startTime: this.format(startp),
				stationID: this.stationID,
				endTime: this.format(endp),
				obs: this.observationTypes
		};
		parameters = JSON.stringify(parameters);
		
		var curObject = this;

		$.ajaxSetup({    	
			crossDomain: false, // obviates need for sameOrigin test        
			beforeSend: function(xhr, settings) {
				if (!csrfSafeMethod(settings.type)) {
					xhr.setRequestHeader("X-CSRFToken", csrftoken);
				}				
				curObject.timelineview.$loading.html("Loading observations for the selected timeframe");				
				curObject.timelineview.$loading.show();
			},
			complete: function(){					
				//UI
//				$(".load").fadeOut(300, function() { $(this).remove(); });
			}        
		});
		
		
		var deferred = [];	

		deferred.push($.ajax({
			type: 'POST',
			url: '/observe/',
			data: parameters, 
			cache: false,                
			success: function(data){			
				data.forEach(function(d,i){
					curObject.timelineDataAll["all"][""+d.type] = data[i]; 
				});	

				curObject.timelineDataAll["all"].forEach(function(d){		//each type			
					curObject.parseDates(d.rows);				
				});							
				
			},
			error: function() {
				console.log('Error loading observations, database returned empty');
			}
		})//end of ajax call
		);	

		curObject.stationID.forEach(function(d){	//this should be for item in the stations array, then check if they are selected
			var stationId= ""+d;			
			if( curObject.timelineview.selectedIDs[stationId]==true){		
				deferred.push(curObject.getStationData(d, false));			
			}else if(curObject.timelineview.selectedIDs[stationId]==false){
				curObject.populatedIDs[stationId]=false;//no data for this time frame			
			}		
		});	   					
		$.when.apply($, deferred).done(
				function(){					
					curObject.timelineview.drawAfterDateChange(curObject.timelineDataAll);	
					//this has some problem, look carefully, may just insert the code here				
				}); //redraw y-axis, and indv station is integrated inside drawing		

};


/**
 * parse the date strings to date object
 */
Observations.prototype.parseDates = function (data ){ 
	var timeline= this;
	var rows = data;
	if(rows.length<=0){
		return;
	}
	rows.forEach(function(d){
		d.tstamp = timeline.parse(d.tstamp);
	});		
};

Observations.prototype.sortDates = function (dataToSortbyDate){
	var timelineData = dataToSortbyDate;
	timelineData.sort(function(a, b){
		return d3.ascending(a.tstamp, b.tstamp);
	});
};
