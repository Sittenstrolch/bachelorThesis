'use strict'

/* App Module */
var ba = angular.module('ba', [
	'graphAnalyser',
    'ui.router',
])

// register the interceptor as a service
ba.factory('authInterceptor', ['$q', '$location', '$injector', function($q, $location, $injector) {
    return {
        // optional method
        'responseError': function(rejection) {
            $injector.invoke(['$http', '$state', function($http, $state) {
                if(rejection.status == 401 && $location.path().substring(0,13) != '/registration')
                    $state.go('login')
            }])
            // do something on error
            return $q.reject(rejection)
        }
    }
}])

ba.config(["$httpProvider", '$locationProvider',function($httpProvider, $locationProvider){
    $httpProvider.interceptors.push('authInterceptor')
    $locationProvider.html5Mode(true)
}])

//On Init of webapp
ba.run(['$rootScope', '$location', '$http', function ($rootScope, $location, $http) {

}])
