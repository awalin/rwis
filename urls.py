from django.conf.urls import patterns, include, url
#from django.views.generic import TemplateView
from django.views.decorators.cache import cache_page

from server.timeline.views import FetchObservations, LoadCanvas
from server.exports.views import TestExportView, SubmitQueuedRequest, FetchDownload

from api import handlers

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
admin.autodiscover()

urlpatterns = patterns('',


    url(r'^$', LoadCanvas.as_view(template_name="index.html")), 
    
    url(r'^timelines$', LoadCanvas.as_view(template_name="index.html")),     
    url(r'^observe/', FetchObservations.as_view(), name='fetch_observations'),    
    # Exports
    url(r'^data/test/$',  TestExportView.as_view()),
    url(r'^data/request/$', SubmitQueuedRequest.as_view()),
    url(r'^download/(.*)/$', FetchDownload.as_view(), name="fetchDownload"),
    
    # API
    url(r'^api/stations', cache_page(60 * 60 * 12)(handlers.getStations)),
    url(r'^api/obsType', cache_page(60 * 60 * 12)(handlers.getObsType)),
    # Uncomment the admin/doc line below to enable admin documentation:
    # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
    url(r'^admin/', include(admin.site.urls)),

)
