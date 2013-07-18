from django.http import HttpResponse
from django.shortcuts import render_to_response
from django.core.context_processors import csrf
from django.views.generic.base import View, TemplateView
from django.views import generic
from django.shortcuts import  render_to_response
from django.template import RequestContext, loader, Context
from django.utils import simplejson
from settings import CLARUS_DBCONN_STRING
import psycopg2, sys, pprint, json
from datetime import datetime
from django.views.decorators.csrf import ensure_csrf_cookie
import logging
from array import *

# logger = logging.getLogger('print')

class LoadCanvas(View):
    template_name= "index.html"
    def get(self, request, *args, **kwargs):
        c = {}
        c.update(csrf(request))
        return render_to_response(self.template_name, c)
    
    
    
class FetchObservations(View):
#     template_name = "timeline/timelines.html"  
    obsType = array('i'); # 575
    startTime = '' ;      
    stationID ='';
    
    #@route ('/observe', method='POST')
    def post(self, request, *args, **kwargs):   
        try: 
            
            json_data = simplejson.loads(request.body)   
            print 'Raw Data: "%s"' % request.body
#             print json_data
            self.startTime = str(json_data['startTime'])
#             self.startTime = '2013-07-09 00:00:00';           
#             print self.startTime
            self.stationID = json_data['stationID']
            stationList = ",".join([str(x) for x in self.stationID])
#             print stationList
            self.obsType = json_data['obsType']            
#             print self.obsType
      
            conn_string = CLARUS_DBCONN_STRING    # get a connection, if a connect cannot be made an exception will be raised here
            conn = psycopg2.connect(conn_string) # conn.cursor will return a cursor object, you can use this cursor to perform queries
            cursor = conn.cursor()  
            r = [];
#             print self.obsType[0]
#             print self.obsType[1]
            
            for obs in self.obsType:                 
            # execute our Query
                data = {}                
                obsStr = str(obs)                
                
                cursor.execute("SELECT "+
                            "TO_CHAR( (date_trunc('hour', tstamp) + INTERVAL '15 min' * ROUND(date_part('minute', tstamp) / 15.0)), 'YYYY-MM-DD HH24:MI' ) AS tstamp, "+ 
                            "AVG( metric_value ) AS metric_value " +
                            "FROM clarus.observation, clarus.sensor "+
                            "WHERE clarus.observation.sensor_id=clarus.sensor.sensor_id "+
                            "AND station_id IN (" + stationList + ") AND observation_type = " + obsStr + " "+ 
                            "AND tstamp >= (timestamp '"+self.startTime+"' - INTERVAL '1 week') AND tstamp < timestamp '"+self.startTime+"' " +  
                            "GROUP BY date_trunc('hour', tstamp) + INTERVAL '15 min' * ROUND(date_part('minute', tstamp) / 15.0) "+
                            "ORDER BY tstamp asc"  );
                                                
                data['rows'] = [dict((cursor.description[i][0], value) 
                    for i, value in enumerate(row)) for row in cursor.fetchall()]   
                  
                # this query is no longer needed as the metadata is all loaded separately
                #cursor.execute("SELECT name, description, metric_abbreviation "+  
                #               "FROM clarus.observation_type_lkp "+
                #               "WHERE clarus.observation_type_lkp.observation_type= "+ obs +"");
                  
                #data['title'] = ([dict((cursor.description[i][0], value) 
                #    for i, value in enumerate(row)) for row in cursor.fetchall()])
                
                data['title'] = obs
                  
                r.append(data);           
             
            cursor.connection.close();
    #         now process it
            json_output = simplejson.dumps(r)
            return HttpResponse(json_output, content_type="application/json")    
        
        except:            
            return HttpResponse("<h1>Error in running query</h1>")
#             logger.error('Getting observation data failed')
            
