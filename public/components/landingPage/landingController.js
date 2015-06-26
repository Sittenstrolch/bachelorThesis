var landingPage = angular.module("landingPage", [])

landingPage.controller("landingPageCtrl", ['$scope', '$location', '$http', function($scope, $location, $http){
    $scope.tokenAvailable = null
    $scope.name = ""
    $scope.register = function(){
        var apikey      = '77vg9x70197uwd'
        var state = 'register'
        window.location.href = 'https://www.linkedin.com/uas/oauth2/authorization?response_type=code&client_id=' + apikey +
                                '&scope=r_fullprofile%20r_emailaddress%20r_network%20rw_groups%20rw_nus&state=DCEEFWF45453sdffef424&redirect_uri=http://localhost/api/linkedin/callback'

    }

    var queryParams = $location.search(),
        token = {}


    if(Object.keys(queryParams).length > 0) {
        $scope.tokenAvailable = true
        $scope.name = queryParams.firstname
        console.log(queryParams)

        $http.post("/api/newToken", queryParams)
    }
}])