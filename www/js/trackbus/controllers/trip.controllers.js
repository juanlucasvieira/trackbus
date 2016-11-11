(function() {
    'use strict';

    angular
        .module('trackbus')
        .controller('TripController', TripController);

    TripController.$inject = [
        '$scope', 'uiGmapGoogleMapApi', '$interval',
        'spatialService', 'alertService', 'stopService',
        'stopsPromise', 'configPromise',
        'TRACKBUS', 'PERSON_ICON', 'BUS_STOP_ICON', 'ERROR_MESSAGES'
    ];

    function TripController(
        $scope, uiGmapGoogleMapApi, $interval,
        spatialService, alertService, stopService,
        stopsPromise, configPromise,
        TRACKBUS, PERSON_ICON, BUS_STOP_ICON, ERROR_MESSAGES
    ) {
        var vm = this;
        var notifyStops = [];
        var options = configPromise;
        var updateWatch;
        var currentStop;
        var nextStop;

        vm.stops = stopsPromise;
        vm.addProximityListener = addProximityListener;
        vm.setPosition = setPosition;

        // Google Maps
        vm.stopsMarkers = [];
        vm.userMarker = {
            coords: {latitude: 0, longitude: 0},
            options: {icon: PERSON_ICON}
        };
        vm.map = {
            center: {latitude: 0, longitude: 0},
            zoom: 15
        };
        vm.searchbox = {
            template:'searchbox.tpl.html',
            events:{
                places_changed: function (searchBox) {
                    var location = searchBox.getPlaces()[0].geometry.location;
                    var coords = {latitude: location.lat(), longitude: location.lon()};
                    setPosition(coords);
                }
            },
            position:"top-right"
        };
        // Google Maps

        activate();

        function activate() {
            function mapSetup(){
                return uiGmapGoogleMapApi.then(function(maps) {
                    return setCurrentPosition();
                });
            };
            function setUpdateInterval() {
                updateWatch = $interval(notifyProximity, TRACKBUS.TIME_TO_UPDATE_STOPS);
                $scope.$on('$destroy', function() {
                    $interval.cancel(updateWatch);
                });
            };

            vm.stops = stopService.sortStops(vm.stops);
            return mapSetup().then(function(){
                setUpdateInterval();
                initializeStopsMarkers();
                return spatialService.watchPosition(watchUserPosition);
            });
        };

        function getNextStop() {
            return vm.stops[currentStop.index + 1];
        };

        function setCurrentPosition(zoom) {
            return spatialService.getCurrentPosition().then(
                function success(result) {
                    var coords = {latitude: result.latitude, longitude: result.longitude};
                    setPosition(coords, zoom);
                },
                function error(result) {
                    console.error(result);
                    alertService.showAlert("Erro", ERROR_MESSAGES.NAVIGATOR_FAILURE);
                }
            );
        };

        function watchUserPosition(lat, lng){
            var coords = {latitude: lat, longitude: lng}
            if(!currentStop){
                currentStop = stopService.getClosestStop(vm.stops, coords);
                nextStop = getNextStop();
                console.log(currentStop, nextStop);
            }
            setUserPosition(coords);
            notifyProximity();
        };

        function setPosition(coords, zoom) {
            vm.map.refresh({latitude: coords.latitude, longitude: coords.longitude});
            if(zoom){
                vm.map.zoom = zoom;
            }
        };

        function setUserPosition(coords) {
            vm.userMarker.coords = coords;
        };

        function initializeStopsMarkers(){
            var result = [];
            vm.stopsMarkers = [];
            angular.forEach(vm.stops, function(stop) {
                result.push(new StopMarker(stop));
            });
            vm.stopsMarkers = result;
        };

        function StopMarker(stop){
            //must contain coords: {latitude: number, longitude: number}
            this.id = stop.sequencia;
            this.options = {icon: BUS_STOP_ICON};
            this.description = stop.descricao_ponto;
            this.coords = {
                latitude: stop.latitude,
                longitude: stop.longitude
            };
        };

        function indexOfStop(stop) {
            var index = -1;
            angular.forEach(notifyStops, function(s, key) {
                if(s.sequencia ==  stop.sequencia){
                    return index = key;
                }
            });
            return index;
        };

        function addProximityListener(stop) {
            notifyStops.push(stop);
            notifyProximity();
            alertService.showAlert("Notificação", SUCCESS_MESSAGES.STOPS_NOTIFICATION);
        };

        function removeProximityListener(stop, index) {
            var idx = index ? index:indexOfStop(stop);
            if(idx != -1){
                notifyStops.splice(idx, 1);
            }
        };

        function toggleProximityListener(stop){
            var index = indexOfStop(stop);
            (index != -1) ? removeProximityListener(stop, index):addProximityListener(stop);
        };

        function notifyProximity() {
            if(!nextStop){
                return;
            }
            var distance = getDistance(nextStop);
            if(distance <= TRACKBUS.STOP_NOTIFICATION_DISTANCE){
                notificationService.scheduleStopNotification(nextStop);
                currentStop = nextStop;
                nextStop = getNextStop();
            }
        };

        function getDistance(stop) {
            var _stop = angular.copy(stop);
            if(!_stop.coords){
                _stop.coords = {
                    latitude: _stop.latitude,
                    longitude: _stop.longitude
                }
            }
            return spatialService.getDistance(_stop.coords, vm.userMarker.coords);
        };
    };

})();