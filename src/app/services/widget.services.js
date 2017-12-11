'use strict';

var widgets = angular.module('ozpWebtop.services.widgets',[
    'ozp.common.utilities', 'ozpWebtop.constants', 'ozpWebtop.services.iwcInterface',
    'ozpWebtop.services.restInterface', 'ozpWebtop.models']);

  widgets.factory('widgetService', function($log, $rootScope, $window, Utilities, iwcConnectedClient, models, dashboardStateChangedEvent, dashboardMaxWidgets, restInterface){
    var _this = this;
    var client;

    iwcConnectedClient.getClient().then(function(_client) {
      client = _client;
      registerInternalOpen();
    });

    function registerInternalOpen() {
      var registrationData = {
        contentType: 'application/vnd.ozp-iwc-intent-handler-v1+json',
        entity: {
          label: 'Webtop\'s open widget'
        }
      };

      client.intents()
        .register('/application/iwc.internal/open', registrationData, openWidget);
    }

    function openWidget(intentData) {
      var data = intentData.entity.data;
      var inFlightIntent = intentData.entity.inFlightIntent;
      var entity = data.entity;
      var errors = openWidgetInDashboard(entity.id, entity.applicationId.replace(/^\/application\//, ''), inFlightIntent.resource);

      if (errors) {
        launchNewWindow(entity);
      } else {
        broadcastDashboardChanged();
      }
    }

    function openWidgetInDashboard(appId,applicationId, inFlightIntent) {
    	//TODO this app variable should needs to get the actual information about the app. Needs to be brought in from the list of all the apps.
      var app = { 
    		  inFlightIntent: inFlightIntent, 
    		  uniqueName: applicationId, 
    		  id: appId,
    		  uiHints: {
    	            width: 200,
    	            height: 200,
    	            singleton: true
    	          }
      };
      var errors = _this.addAppToDashboard(app);

      return errors.noDashboard;
    }

    function broadcastDashboardChanged() {
      var currentDashboard = models.getCurrentDashboard();

      $rootScope.$broadcast(dashboardStateChangedEvent, {
        dashboardId: currentDashboard.id,
        layout: currentDashboard.layout
      });
    }

    function launchNewWindow(entity) {
      var launchData = entity.launchData;
      var ref = new client.system.Reference(entity.applicationId);

      launchData.openInNewWindow = true;
      ref.launch(launchData);
    }

    this.addAppToDashboard = function addAppToDashboard(app, dashboardId) {
      var errors = {};
      var dashboard;

      if (!dashboardId) {
        dashboard = models.getCurrentDashboard();
        dashboardId = dashboard && dashboard.id;
      }

      errors.noDashboard = !dashboardId;
      errors.singleton = checkIsSingletonOnDashboard(dashboardId, app);

      if (!errors.singleton) {
        errors.maxWidgets = addNewAppToDashboard(dashboardId, app);
      }

      return errors;
    };

    function checkIsSingletonOnDashboard(dashboardId, app) {
      var isOnDashboard = _this.isAppOnDashboard(dashboardId, app.id);
      
      //  return isOnDashboard && app.singleton;
      return isOnDashboard && app.uiHints.singleton; // app's singleton value in stored in uiHints currently.
    }

    function addNewAppToDashboard(dashboardId, app) {
      var overMaxWidgets = _this.overMaxWidgets(dashboardId);

      if (!overMaxWidgets) {
        _this.createFrame(dashboardId, app);
      }

      return overMaxWidgets;
    }

    this.overMaxWidgets = function(dashboardId){
      var dashboard = models.getDashboardById(dashboardId);

      if (dashboardMaxWidgets <= dashboard.frames.length) {
        // TODO: handle error
        $log.error('ERROR: cannot add frame, too many widgets');
        return true;
      }
      else {
        return false;
      }
    };
    /**
     * Create a new frame in a dashboard for a given application
     * Creates a frame with with both grid and desktop layout data
     * Creates frame based on UUID as appId
     * @method createFrame
     * @param dashboardId
     * @param appId
     * @returns {new frame}
     */
    this.createFrame = function(dashboardId, app) {
      var dashboard = models.getDashboardById(dashboardId);

      if(this.overMaxWidgets(dashboardId) === true) {
        return null;
      }
      else {
        // by default, new frames will have minimal size
        var col = 0;
        var sizeX = 2;
        var sizeY = 2;

        // for the desktop layout, just put it on and let the user move it
        var zIndex = 0;
        var top = 75;
        var left = 75;
        var width = 500;
        var height = 500;

        var MaxArray = [];
        MaxArray.max =  function(){
          return Math.max.apply(null, this);
        };

        // empty arrays built every time createFrame is called
        var maxTopArray = MaxArray;
        var maxLeftArray = MaxArray;
        var maxZindexArray = MaxArray;

        // loop through and populate arrays with the top, left, and zindex of all frames
        for(var frame in dashboard.frames){
          if(dashboard.frames.length > 0){
            if(dashboard.frames[frame].desktopLayout){
              maxTopArray.push(dashboard.frames[frame].desktopLayout.top);
              maxLeftArray.push(dashboard.frames[frame].desktopLayout.left);
              maxZindexArray.push(dashboard.frames[frame].desktopLayout.zIndex);
            }
          }
        }

        // set the top, left, and zindex based on the maximum values on screen
        if (maxTopArray.length > 0){
          top = maxTopArray.max() + 32;
        }
        if (maxLeftArray.length > 0){
          left = maxLeftArray.max() + 32;
        }
        if (maxZindexArray.length > 0){
          zIndex = maxZindexArray.max() + 10;
        }
        var utils = new Utilities();
        var frameId = utils.generateUuid();

        // get the name for this app (if this app is later deleted, at least
        // we can tell the user what it is called)
        var appId = app.id;
        var appUniqueName = app.uniqueName;
        var appName = 'unknown';
        var applicationData = models.getApplicationData();
        for (var a=0; a < applicationData.length; a++) {
          if (applicationData[a].id === app || (applicationData[a].uniqueName && applicationData[a].uniqueName === appUniqueName)) {
            appId = applicationData[a].id;
            appName = applicationData[a].name;
          }
        }
        // update the dashboard with this app
        var newApp = {
          'appId': appId,
          'id': frameId,
          'name': appName,
          'gridLayout': {
            'sm': {
              'col': col,
              'sizeX': 3,
              'sizeY': 1
            },
            'md': {
              'col': col,
              'sizeX': sizeX,
              'sizeY': sizeY
            }
          },
          'desktopLayout': {
            'zIndex': zIndex,
            'top': top,
            'left': left,
            'width': width,
            'height': height
          }
        };

        if (app.inFlightIntent) {
          newApp.inFlightIntent = app.inFlightIntent;
        }

        dashboard.frames.push(newApp);
        models.saveDashboard(dashboard);
        return newApp;
      }
    };
    /**
     * Check to see if an application is already on a given dashboard
     * @method isAppOnDashboard
     * @param dashboardId
     * @param applicationId
     * @returns {Promise}
     */
    this.isAppOnDashboard = function(dashboardId, applicationId) {
      var dashboard = models.getDashboardById(dashboardId);
      for (var i=0; i < dashboard.frames.length; i++) {
        if (dashboard.frames[i].appId === applicationId) {
          return true;
        }
      }
      return false;
    };

    this.bookmarkWidget = function(widgetId) {
      return restInterface.createLibraryEntry(widgetId);
    };

    return this;
});
