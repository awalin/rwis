/**
 * Map Module 
 */

var RwisMap = function($, _, document, window) {

/***********************************************
 * Initialization
 ***********************************************/
    
    var $document,
        $window,
        
        // Configuration options
        mapConfig,
        $mapDiv,
        $mapSidebar,
        $analyzeSidebar,
        $mapSidebarCover,
        
        // Map, Layers, and Controls
        map,
        baseLayer,
        labelsLayer,
        zoomBL,
        zoomToSelectionControl,
        zoomToBox,
        drawToSelect,
        markers,
        highlightMarker,
        selectionMask,
        
        incidentMarkers,
        incidentMask,
        
        // Menus and Popups
        stationPopup,
        contextMenu,
        
        // Icons
        RwisIcon,
        stationIcon,
        stationSelectedIcon,
        smallStationIcon,
        smallStationSelectedIcon,
        
        // Selection State
        selectionBounds;


    function init(config) {

        mapConfig = config;
        $document = $(document);
        $window = $(window);
        $mapDiv = $(mapConfig.mapDiv);
        $mapSidebar = $(mapConfig.mapSidebar);
        $analyzeSidebar = $('#analyzeSidebar');
        $mapSidebarCover = $('#mapSidebarCover');
        
        createParts();
        render();
        bindEvents();
    };


    /**
     * Initialize the map layers, layergroups, controls, icons, and popups. 
     */
    function createParts() {
        // Map tiles
        baseLayer = new L.RitisTileLayer('http://tile-{s}.ritis.org/?h=256&w=256&t={y}&l={x}&s={z}&g=__base__&i=AGGA&map={params}', {
            subdomains : mapConfig.tileDomains.base,
            params : mapConfig.currentMap,
        });

        // Road label tiles
        labelsLayer = new L.RitisTileLayer('http://tile-{s}.ritis.org/?h=256&w=256&t={y}&l={x}&s={z}&g=__base__&i=AGGA&map={params}', {
            subdomains : mapConfig.tileDomains.labels,
            params : 'world_navteq_labels'
        });
        
        // Scale control.
        scaleControl = L.control.scale();

        // Zoom control.
        zoomBL = L.control.zoomslider({
            position : 'topleft',
            stepHeight: 6,
            knobHeight: 20,
        });
        
        // Zoom to selection control.
        zoomToSelectionControl = new L.Control.SingleButton({
            html: '<img src="/static/img/zoom-to-selection.png" width="30"></img>',
            title: 'Zoom to selection',
            action: function() {if (selectionBounds) map.fitBounds(selectionBounds);}
        });

        // Zoom to box
        zoomToBox = new L.Control.SingleButton({
            html: '<img src="/static/img/zoombox.gif" width="30"></img>',
            title: 'Draw to zoom',
            action: function() {alert("draw to zoom");}
        });
        
        // Draw to select.
        drawToSelect = new L.Control.SingleButton({
            html: '<img src="/static/img/select_box.png" width="30"></img>',
            title: 'Draw to select',
            action: function() {alert("draw on map to select");}
        });
        
        stationIcon = L.divIcon({
                        //html : '<svg width="30" height="30"><g transform="translate(15, 15)"><text text-anchor="middle" y=".35em">1</text></g></svg>',
                        html : '<svg width="20" height="20"><g transform="translate(10, 10)"><text text-anchor="middle" y=".35em">1</text></g></svg>',
                        className : 'cluster',
                        iconSize : L.point(20, 20)
                    });
                        
        stationSelectedIcon = L.divIcon({
                        //html : '<svg width="30" height="30"><g transform="translate(15, 15)"><path d="M0,15A15,15 0 1,1 0,-15A15,15 0 1,1 0,15Z"></path><text text-anchor="middle" y=".35em">1</text></g></svg>',
                        html : '<svg width="20" height="20"><g transform="translate(10, 10)"><text text-anchor="middle" y=".35em">1</text></g></svg>',
                        className : 'cluster cluster1',
                        iconSize : L.point(20, 20)
                    });
                    
        smallStationIcon = L.divIcon({
                        html : '<svg width="12" height="12"><g transform="translate(6, 6)"><text text-anchor="middle" y=".35em">1</text></g></svg>',
                        className : 'cluster',
                        iconSize : L.point(12, 12)
                    });
                       
        smallStationSelectedIcon = L.divIcon({
                        html : '<svg width="12" height="12"><g transform="translate(6, 6)"><text text-anchor="middle" y=".35em">1</text></g></svg>',
                        className : 'cluster cluster1',
                        iconSize : L.point(12, 12)
                    });

        // Station MarkerClusterGroup
        markers = L.markerClusterGroup({
            maxClusterRadius : 45,
            zoomToBoundsOnClick : false,
            iconCreateFunction : generateClusterIcon
        });
        
        // Create the markers
        fillClusterGroup(markers, Stockpile.meta.stations, {
            defaultIcon: stationIcon,
            storeMarker: 'marker'
        });
        
        // MarkerClusterGroup for minimap
        miniMarkers = L.markerClusterGroup({
            maxClusterRadius : 21,
            showCoverageOnHover : false,
            zoomToBoundsOnClick : false,
            iconCreateFunction : generateSmallClusterIcon
        });

        // Create a popup to use for displaying basic station data.
        // The offset displays the popup above the marker icon.
        stationPopup = L.popup({
            offset : [0, -20]
        });
        
        // Create context menu for clusters.
        contextMenu = new L.ContextMenu();
        
        // Create rectangle selection mask to bound the selection on the minimap.
        selectionMask = new L.RectMask();
        
        // mockup incident icons
        
        incidentMarkers = L.markerClusterGroup({
            maxClusterRadius : 45,
            zoomToBoundsOnClick : false,
            iconCreateFunction : function() {
                return L.icon({
                    iconUrl: '/static/img/incident/incident.png',
                    iconSize: [35, 35],
                    iconAnchor: [17, 17],
                });
            }
        });
       
        // Leaflet icon for displaying incident sprite icons
        var IncidentIcon = L.DivIcon.extend({
            options: {
                iconSize: [35, 35],
                iconAnchor: [17, 17],
            },
            initialize: function(type) {
                L.setOptions(this, { className: 'incident-icon ' + type });
            }
        });

        // Load some incidents.
        var incList = Stockpile.meta.inc,
            inc, incMarker;
        for (var i = 0, l = incList.length; i < l; i++) {
            inc = incList[i];
            incMarker = inc.marker = L.marker([inc.lat, inc.lng], {
                icon: new IncidentIcon(inc.type),
                riseOnHover: true,
                riseOffset: 2000,
            });
            incMarker.incId = inc.id;
            incidentMarkers.addLayer(incMarker);
        }
        
        // Setup mask to highlight incidents on hover.
        incidentMask = L.marker([0, 0], {
            icon: L.icon({
                iconUrl: '/static/img/incidentMask.png',
                iconSize: [600, 600],
                iconAnchor: [300, 300],
            }),
            zIndexOffset: 1000
        });
        
    };


    /**
     * Create the map. 
     */
    function render() {
        
        map = new L.RitisMap('mapDiv', {
            minZoom : 0,
            maxZoom : mapConfig.aScales.length - 1,
            doubleClickZoom : false,
            scrollWheelZoom : true,
            attributionControl : false,
            zoomsliderControl : false, // must be added separately so it can be removed later.
            crs : new L.CRS.RitisCRS(mapConfig),
            center : mapConfig.initLatLng,
            zoom : mapConfig.initZoom
        });

        // Add layers and controls.
        map.addLayer(baseLayer)
            .addLayer(labelsLayer)
            .addControl(scaleControl)
            .addControl(zoomBL)
            .addControl(zoomToSelectionControl)
            .addControl(zoomToBox)
            .addControl(drawToSelect)
            .addLayer(selectionMask)
            .addLayer(markers);

        // Publish end of map load.
        $document.trigger('mapLoaded');
    };
    
    function bindEvents() {
        
        // Popup
        markers.on('click', handleShowPopup);

        $mapDiv.on('click', '#selectStation', selectStation);
        $mapDiv.on('click', '#deselectStation', deselectStation);
        
        $("#goback").on("click", function() {
            $document.trigger('mapView');
        });
        
        // Context Menu
        markers.on('clusterclick', showClusterMenu);
        $mapDiv.on('click', '.leaflet-contextMenu li', contextMenuClick);
        
        // Events that switch to analysis view
        $('#explore').on('click', exploreHandler);
        $mapDiv.on('click', '#analyzeStation', analyzeHandler);
        
        // Incidents (on mini map)
        incidentMarkers.on('mouseover', function(e) {
            $document.trigger('incidentMouseover', e.layer.incId);
        });
        incidentMarkers.on('mouseout', function(e) {
            $document.trigger('incidentMouseout', e.layer.incId);
        });
        
        // Subscriptions
        $document.on('selectionUpdate', updateSelection);
        $document.on('mapView', maximizeMap);
        
        // Set the function to call on map resize, and call it to set up the page.
        $window.resize(resizer);
        resizer();
    };


/***********************************************
 * View Changing Functions
 ***********************************************/
    
    /**
     * Slide the sidebar out and move the map to the sidebar to make space
     * for analysis.
     * 
     * @param {number} [stationId] If analyzing a single station, include its station id.
     */
    function minimizeMap(station) {
        
        var selection = RwisTree.getSelected();

        // Turn off interactions on the sidebar
        $mapSidebarCover.show();

        // Save state so that maximize knows how to return.
        minimizeMap.fullMapCenter = map.getCenter();
        minimizeMap.fullMapZoom = map.getZoom();
        minimizeMap.station = station;

        // Remove controls and popups.
        disableMap();

        // Animate everything.
        animateList([
            
            // Check to make sure observation metadata is loaded (it will only load once)
            function(c) {
                if (!Stockpile.meta.obsType) {
                    // load metadata
                    Stockpile.loadMeta('obsType', c);
                } else {
                    c();
                }
            },
            
            // Zoom/Pan to selection before being hidden (if exploring)
            function(c) {
                
                if (!station) {
                    map.once('moveend', c);
                    map.fitBounds(selectionBounds, {animate: true, pan: {duration: 1}});
                } else {
                    c();
                }
            },
            
            // Only pause for explore mode.
            getTimeoutFn(600, function() { return !station; }),
            
            // Slide the map off the page and remove markers.
            function(c) {
                $mapDiv.hide('slide', 1000, c);
            },
            
            // Minimize map and pan/zoom to selection while hidden (if exploring)
            function(c) {
                $mapDiv
                    .css({
                        height : '300px',
                        width : '300px',
                        top: '80px',
                        left: '-301px'
                    })
                    .addClass('sidebar')
                    .show();
                    
                map.removeLayer(markers);

                map.invalidateSize({reset: true});
                
                map.once('moveend', c);
                
                if (!station) {
                    map.fitBounds(selectionBounds, {reset: true});
                } else {
                    map.setView([station.lat, station.lon], map.getMaxZoom() - 3, {reset: true});
                }
            },
            
            // Enforce a minimum zoom level.
            function(c) {
                
                if (map.getMaxZoom() - map.getZoom() < 3) {
                    map.once('zoomend', c);
                    map.setZoom(map.getMaxZoom() - 3, {animate: false});
                } else {
                    c();
                }
            },
            
            // Fill map with stations and slide it and the sidebar in.
            function(c) {
                
                var mapBounds = map.getBounds();
                
                var d = _.filter(Stockpile.meta.stations, function(s) {
                    return (s.lat && s.lon && mapBounds.contains([+s.lat, +s.lon]));
                });

                if (!station && selection.length > 1) {
                    selectionMask.enable(selectionBounds);
                }

                var fillOptions = {
                    defaultIcon: smallStationIcon,
                    selectedIcon: smallStationSelectedIcon,
                    selection: selection
                };
                
                if (station || selection.length == 1) {
                    fillOptions.defaultIcon = stationIcon;
                    fillOptions.selectedIcon = stationSelectedIcon;
                }
                
                fillClusterGroup(miniMarkers, d, fillOptions);
                map.addLayer(miniMarkers)
                    .addLayer(incidentMarkers);
                    
                $document.on('incidentMouseover', showIncidentMask);
                $document.on('incidentMouseout', hideIncidentMask);
                
                $mapDiv.animate({
                    left: 0
                }, 500);
                $analyzeSidebar.animate({
                    left: 0
                }, 500);
                
                $('#banner').slideDown(500, c);
            },
            
            // Hide the map sidebar so it won't show through margins.
            function(c) {
                $mapSidebar.hide();
                c();
            }
        ], requestData, station);

        
    };
    
    function requestData(station){
    	
        var station_ids = new Array();
        station_ids.push(station.id);
        //a call to RWIS time line to show the timeline       
        RwisTimeline.init(station_ids);
    }; 
    

    /**
     * Slide in the sidebar and make the map fullsize. This grabs state data
     * from minimizeMap.
     */
    function maximizeMap() {

        // Grab saved state from minimizeMap
        var station = minimizeMap.station,
            fullMapCenter = minimizeMap.fullMapCenter,
            fullMapZoom = minimizeMap.fullMapZoom;

        //$window.resize(resizer);
        selectionMask.disable();

        animateList([
           
           // Slide analyze sidebar and map off screen.
           function(c) {
                $mapSidebar.show();
                $('#banner').slideUp(500);
                $analyzeSidebar.animate({ left: '-303px' }, 500);
                $mapDiv.hide('slide', 500, c);
           },
           
           // Resize the map offscreen and zoom to selection
           function(c) {
                $mapDiv
                   .css({
                       height: 'auto',
                       width: ($window.innerWidth() - $mapSidebar.outerWidth() - 9) + 'px',
                       top: 0,
                       bottom: 0,
                       left: -($window.innerWidth() - $mapSidebar.outerWidth()) + 'px'
                   })
                   .removeClass('sidebar')
                   .show(); // Operations on the map require not "display: none".
                
                map.invalidateSize({reset: true});
                map.removeLayer(miniMarkers)
                    .removeLayer(incidentMarkers)
                    .addLayer(markers);
                    
                $document.off('incidentMouseover', incidentMouseover);
                $document.off('incidentMouseout', incidentMouseout);
                
                map.once('viewreset', c);
                
                if (!station) {
                    map.fitBounds(selectionBounds, {reset: true});
                } else {
                    map.setView([station.lat, station.lon], map.getMaxZoom() - 3, {reset: true});
                }
           },
           
           // Slide fullsize map onto the screen.
           function(c) {
               $mapDiv
                    .hide() // Map must be hidden again to slide out under sidebar.
                    .css({
                        left : '' //$mapSidebar.outerWidth() + 3 + 'px'
                    })
                    .delay(0) // makes the sliding animation smooth...I don't know why.
                    .show('slide', 750, c);
           },
           
           // Now that the map is shown again, invalidate size.
           function(c) {
                $mapDiv.css({
                    width : ''
                });
                map.invalidateSize();
                c(); 
           },
           
           // Pause to see selected view.
           getTimeoutFn(500),
           
           // Change map to the saved view.
           function() {
                map.setView(fullMapCenter, fullMapZoom);
               
                enableMap();

                $mapSidebarCover.hide();
           }
        ]);
    };
    
    /**
     * Bring up popup for station.
     *
     * @param {number} id Station id to display popup for.
     */
    function showStationPopup(id) {

        var s = Stockpile.getStation(id),
            marker = s.marker;
        
        var buttonId = 'selectStation', buttonText = 'Add to Selection';
        if (RwisTree.isSelected(s.id)) {
            buttonId = 'deselectStation';
            buttonText = 'Remove from Selection';
        }

        stationPopup.setContent(
            '<div id="stationPopup">' +
                '<ul>' +
                    '<li>Station ID: ' + s.id + '</li>' +
                    '<li>Station Code: ' + s.code + '</li>' +
                    '<li>Latitude: ' + s.lat + '</li>' +
                    '<li>Longitude: ' + s.lon + '</li>' +
                    '<li>Contributor: ' + s.contributor_id + '</li>' +
                    '<li>Description: ' + s.description + '</li>' +
                '</ul>' +
                '<button id="analyzeStation" data-station_id="' + s.id + '" type="button">Analyze</button>' +
                '<button id="' + buttonId + '" data-station_id="' + s.id + '" type="button">' + buttonText + '</button>' +
            '</div>').setLatLng(marker.getLatLng()).addTo(map);
    };


/***********************************************
 * Handlers
 ***********************************************/

    /**
     * Handle clicks on Explore button in map sidebar.
     * 
     * @param {object} e jQuery Event object
     */
    function exploreHandler(e) {
        minimizeMap();
    };
    
    /**
     * Handle clicks on Analyze button found in individual station popups.
     * 
     * @param {object} e jQuery Event object
     */
    function analyzeHandler(e) {
    
        var station = Stockpile.getStation(+e.target.getAttribute('data-station_id'));
    
        minimizeMap(station);
    
        // Set all the basic station info
        $('span#station_id').text(station.id);
        $('span#code').text(station.code);
        $('span#lat').text(station.lat);
        $('span#lon').text(station.lon);
        $('span#contrib').text(station.contributor_id);
        $('span#desc').text(station.description);   

       
    };

    /**
     * Update the selection shown on the map.
     *
     * @param {event} e Event
     * @param {array} selected An array of station ids currently selected.
     */
    function updateSelection(e) {
        // Clear all map selections        
        markers.eachLayer(function(l) {
            l.setIcon(stationIcon);
        });
        
        var selected = RwisTree.getSelected();

        // Set selection icons
        
        var m,
            points = [];
        _.each(selected, function(s) {
            m = Stockpile.getStation(s).marker;
            m.setIcon(stationSelectedIcon);
            points.push(m.getLatLng());
        });

        // Update cluster icons
        var gc = markers._gridClusters;
        for (var z in gc) {
            if (gc.hasOwnProperty(z)) {
                gc[z].eachObject(function(c) {
                    c._updateIcon();
                });
            }
        }
        
        // Update selection bounds. If nothing is selected then the bounds are null.
        // Also, make sure explore button is enabled if there is a selection, disabled
        // if not.
        var $xButton = $('#explore');
        var $dButton = $('#download');
        if (points.length > 0) {
            selectionBounds = L.latLngBounds(points);
            $xButton.removeAttr('disabled').attr('title', "Explore selected stations.");
            $dButton.removeAttr('disabled').attr('title', "Download data from selected stations.");
        } else {
            selectionBounds = null;
            $xButton.attr('disabled', "true").attr('title', "Select some stations to explore first.");
            $dButton.attr('disabled', "true").attr('title', "Select some stations to download first.");
        }

    };
    
    /**
     * Select a single station.
     * 
     * @param {event} e Event 
     */
    function selectStation(e) {
        var id = +e.target.getAttribute('data-station_id');
        
        RwisTree.select(id);
        showStationPopup(id);
    };
    
    /**
     * Deselect a single station.
     * 
     * @param {event} e Event 
     */
    function deselectStation(e) {
        var id = +e.target.getAttribute('data-station_id');
        
        RwisTree.deselect(id);
        showStationPopup(id);
    };
    
    /**
     * Handle a click on a station marker.
     *
     * @param {object} le Leaflet event containing marker.
     */
    function handleShowPopup(le) {
        showStationPopup(+le.layer.options.title);
    };
    
    /**
     * Bring up context menu for cluster.
     * 
     * @param {object} cluster Cluster to display menu for. 
     */
    function showClusterMenu(cluster) {
        contextMenu._source = cluster.layer;
        var stations = cluster.layer.getAllChildMarkers(),
            select = 0,
            html = '<ul><li data-action="zoom">Zoom to this region</li>';
            
        _.forEach(stations, function(v) {
            if (RwisTree.isSelected(+v.options.title)) {
                select++;
            }
        });
        
        var diff = stations.length - select;
        if (diff > 0) {
            html += '<li data-action="add">Add ' + diff + ' station' + (diff == 1 ? '': 's') + ' to selection</li>';
        }
        if (select > 0) {
            html += '<li data-action="remove">Remove ' + select + ' station' + (select == 1 ? '': 's') + ' from selection</li>';
        }
        html += '</ul>';
            
        contextMenu.setContent(html).setLatLng(cluster.layer.getLatLng()).openOn(map);
    };
    
    
    /**
     * Event Handler for clicks on the context menu.
     * 
     * @param {object} e jQuery event object
     */
    function contextMenuClick(e) {
        var action = e.target.getAttribute('data-action'),
            cluster = contextMenu._source;

        if (action == 'zoom') {
            cluster.zoomToBounds();
        } else {
            var stations = cluster.getAllChildMarkers();
            stations = _.map(stations, function(m) {
                return +m.options.title;
            });
            
            if (action == 'add') {
               RwisTree.select(stations);
            } else if (action == 'remove') {
               RwisTree.deselect(stations);
            }
        }
        contextMenu._close();
    };
    
    function showIncidentMask(e, id) {
        var latlng = Stockpile.getIncident(id).marker.getLatLng();
        incidentMask.setLatLng(latlng).addTo(map);
    };
    
    function hideIncidentMask() {
        map.removeLayer(incidentMask);
    };
    
    function incidentMouseover() {
        
    };
    
    function incidentMouseout() {
        
    };


/***********************************************
 * Markercluster
 ***********************************************/

    /**
     * This fills a cluster group with markers. There are a few options so that 
     * this can be used on both initial load as well as for filling the minimap.
     * 
     * @param {object} clusterGroup Markercluster group to fill
     * @param {array} data Array of objects (table) that contain lat and lon properties, 
     *                  and if a selection and selectedIcon are included, an id property
     *                  must also be present.
     * @param {object} options
     * @param {object} options.defaultIcon Default icon to use
     * @param {object} [options.selectedIcon] Secondary icon for use with selection.
     * @param {array} [options.selection] Array of ids containing a selection. These markers will 
     *                  use selectedIcon.
     * @param {string} [options.storeMarker] If this is included, then the markers will be 
     *                  stored in the data table under the property passed.
     */
    function fillClusterGroup(clusterGroup, data, options) {
        var defaultIcon = options.defaultIcon,
            selectedIcon = options.selectedIcon,
            selection = options.selection,
            property = options.storeMarker,
            markerList = [],
            marker,
            icon,
            station;
            
        if (!clusterGroup || !data || !defaultIcon)
            return false;
        if (selection && selection.length == 0)
            selection = null;

        // Reset the group.
        clusterGroup.clearLayers();

        for (var i = 0, l = data.length; i < l; i++) {
            
            station = data[i];
            
            if (!station.lat || !station.lon)
                continue;
            
            if (selectedIcon && selection && _.contains(selection, station.id)) {
                icon = selectedIcon;
            } else {
                icon = defaultIcon;
            }

            marker = L.marker([station.lat, station.lon], {
                    title : station.id,
                    icon : icon
            });
                
            if (property)
                station[property] = marker;

            markerList.push(marker);
        }

        clusterGroup.addLayers(markerList);
    };

    
    /**
     * Create the icon for a cluster. A cluster shows how many of its stations
     * are selected out of the total contained stations.
     * 
     * @param {object} cluster Markercluster object.
     * @return {object} A L.DivIcon to display.
     */
    function generateClusterIcon(cluster) {
        
        var html,
            children = cluster.getAllChildMarkers(), 
            selected = RwisTree.getSelected(),
            childCount = cluster.getChildCount(),
            numSelected = _.reduce(children, function(memo, m) {
                var sid = +m.options.title;
                if (_.contains(selected, sid)) {return memo + 1;}
                return memo;
            }, 0);

        // This section utilizes D3 in an atypical way. Leaflet.markercluster
        // takes an html string to display the marker. D3 usually appends html to a selection.
        // Instead of making a temporary DOM element and taking the raw html from that,
        // we just generate the raw string with the arc method.
        
        if (childCount > 0 && childCount < 10) {
            circleSize = 26;
            color = 'c2';
        } else if (childCount >= 10 && childCount < 100) {
            circleSize = 30;
            color = 'c10';
        } else {
            circleSize = 32;
            color = 'c100';
        }
        
        circleRad = circleSize / 2;
        
        html = '<svg width="' + circleSize + '" height="' + circleSize + '"><g transform="translate(' + circleRad + ', ' + circleRad + ')">';
        if (numSelected > 0) {
            var arc = d3.svg.arc()
                .innerRadius(0)
                .outerRadius(circleRad)
                .startAngle(0)
                .endAngle( (numSelected / childCount)*(2*Math.PI) );
                
            html += '<path d="' + arc() + '"></path>';
        }
        
        html += '<text text-anchor="middle" y=".35em">' + childCount + '</text></g></svg>';
        
        return L.divIcon({
            html : html,
            className : 'cluster ' + color,
            iconSize : L.point(circleSize, circleSize)
        });
    };
    

    /**
     * Temporary Function for creating small clusters. TODO 
     */
    function generateSmallClusterIcon(cluster) {
        
        var html,
            children = cluster.getAllChildMarkers(), 
            selected = RwisTree.getSelected(),
            childCount = cluster.getChildCount(),
            numSelected = _.reduce(children, function(memo, m) {
                var sid = +m.options.title;
                if (_.contains(selected, sid)) {
                    return memo + 1;
                }
                return memo;
            }, 0);

        // This section utilizes D3 in an atypical way. Leaflet.markercluster
        // takes an html string to display the marker. D3 usually appends html to a selection.
        // Instead of making a temporary DOM element and taking the raw html from that,
        // we just generate the raw string with the arc method.
        
        html = '<svg width="12" height="12"><g transform="translate(6, 5)">';
        if (numSelected > 0) {
            var arc = d3.svg.arc()
                .innerRadius(0)
                .outerRadius(6)
                .startAngle(0)
                .endAngle( (numSelected / childCount)*(2*Math.PI) );
                
            html += '<path d="' + arc() + '"></path>';
        }
        
        html += '<text text-anchor="middle" y=".35em">' + childCount + '</text></g></svg>';
        
        return L.divIcon({
            html : html,
            className : 'cluster small',
            iconSize : L.point(12, 12)
        });
    };
    
    
/***********************************************
 * Utility
 ***********************************************/
    
    /**
     * Event listener function to allow the map to fill the window and 
     * resize when the window changes.
     */
    function resizer() {
        setTimeout(function() {
            map.invalidateSize();
        }, 250);
    };
    
    /**
     * This helps to execute animations in order without having a mess of callbacks.
     * Items in the list are functions to be executed in order. The functions take a 
     * callback function. Multiple animations can be put in a function to have them 
     * execute at the same time. Run the callback at then end of the longest animation.
     * 
     * Inspired by http://stackoverflow.com/a/11210424
     * 
     * @param {array} list Array of functions.
     * @param {function} callback Called once all the animations have finished.
     */
    function animateList(list, callback, args) {
        if (!callback) { callback = $.noop; }
        if (list.length == 0) {
        	callback(args);
            return;
        }
        var fn = list.shift();
        fn(function() {
            animateList(list, callback, args);
        });
    };
    
    /**
     * This helper returns a function that sets a timeout to a given argument. This works
     * well with animateList above. The checkFn function can be used to turn the timeout off
     * for certain conditions.
     * 
     * @param {number} delay Milliseconds of timeout
     * @param {function} [checkFn] Returns true or false. If false, skip the timeout.
     */
    function getTimeoutFn(delay, checkFn) {
        return function(callback) {
            if (checkFn) {
                setTimeout(callback, delay);
            } else {
                callback();
            }
            
        };
    };
    
    function enableMap() {
        
        $window.resize(resizer);
        
        map
            .addControl(zoomBL)
            .addControl(zoomToSelectionControl)
            .addControl(zoomToBox)
            .addControl(drawToSelect);
        
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
        
        markers.on('click', handleShowPopup);
        markers.on('clusterclick', showClusterMenu);
    };
    
    function disableMap() {
        
        $window.off('resize', resizer);
        
        map
            .removeControl(zoomBL)
            .removeControl(zoomToSelectionControl)
            .removeControl(zoomToBox)
            .removeControl(drawToSelect)
            .removeLayer(stationPopup);
        
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
        
        markers.off('click', handleShowPopup);
        markers.off('clusterclick', showClusterMenu);
    };
    
    function getMapBounds() {
    	return map.getBounds();
    };
    
    

/***********************************************
 * Return Public
 ***********************************************/

    return {
        init: init,
        getMapBounds: getMapBounds
    };

}(jQuery, _, document, window);
